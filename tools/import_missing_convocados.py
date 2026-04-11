#!/usr/bin/env python3
"""
Import missing convocados: re-scan fixtures/lineups for all 48 countries,
find player IDs NOT in our DB, fetch their details from API, and insert them.
"""
import requests, time, psycopg2, sys, os

API_KEY = os.environ["API_FOOTBALL_KEY"]
HEADERS = {'x-apisports-key': API_KEY}
SEASONS = [2024, 2025, 2026]

DB_LOCAL = dict(host='localhost', port=5432, dbname='mundial', user='postgres',
                password=os.environ.get("DB_PASS", "changeme"))

# Position mapping from API to our DB codes
POS_MAP = {'Goalkeeper': 'ARQ', 'Defender': 'DEF', 'Midfielder': 'MED', 'Attacker': 'DEL'}


def main():
    conn = psycopg2.connect(**DB_LOCAL)
    cur = conn.cursor()

    # Get all existing api_player_ids
    cur.execute("SELECT api_player_id FROM jugador WHERE api_player_id IS NOT NULL")
    existing_ids = {r[0] for r in cur.fetchall()}
    print(f"Jugadores existentes en DB: {len(existing_ids)}")

    # Get position IDs
    cur.execute("SELECT internal_id, codigo FROM posicion_jugador")
    pos_db = {r[1]: r[0] for r in cur.fetchall()}
    print(f"Posiciones: {pos_db}")

    # Get all countries
    cur.execute("SELECT internal_id, nombre, api_team_id FROM pais WHERE activo = true ORDER BY nombre")
    paises = cur.fetchall()
    print(f"Países: {len(paises)}\n")

    # Phase 1: Collect ALL missing player IDs per country
    print("=" * 60)
    print("FASE 1: Recolectar IDs faltantes de fixtures/lineups")
    print("=" * 60)
    
    missing_by_country = {}  # pais_id -> set of missing api_player_ids
    total_api_calls = 0

    for idx, (pais_id, nombre, api_team_id) in enumerate(paises, 1):
        if not api_team_id:
            continue

        # Get fixtures
        all_fixture_ids = []
        for season in SEASONS:
            r = requests.get('https://v3.football.api-sports.io/fixtures', headers=HEADERS, params={
                'team': api_team_id, 'season': season
            })
            total_api_calls += 1
            data = r.json()
            for f in data.get('response', []):
                if f['fixture']['status']['short'] in ('FT', 'AET', 'PEN'):
                    all_fixture_ids.append(f['fixture']['id'])
            time.sleep(0.3)

        # Get lineups
        country_player_ids = set()
        for fix_id in all_fixture_ids:
            r = requests.get('https://v3.football.api-sports.io/fixtures/lineups', headers=HEADERS, params={
                'fixture': fix_id
            })
            total_api_calls += 1
            data = r.json()
            for team_data in data.get('response', []):
                if team_data['team']['id'] == api_team_id:
                    for p in team_data.get('startXI', []) + team_data.get('substitutes', []):
                        if p['player']['id']:
                            country_player_ids.add(p['player']['id'])
            time.sleep(0.25)

        missing = country_player_ids - existing_ids
        if missing:
            missing_by_country[pais_id] = missing

        print(f"[{idx:2}/{len(paises)}] {nombre:25s}  fixtures={len(all_fixture_ids):>3}  players={len(country_player_ids):>3}  missing={len(missing):>3}")

    total_missing = sum(len(v) for v in missing_by_country.values())
    print(f"\nTotal faltantes a importar: {total_missing}")
    print(f"API calls fase 1: {total_api_calls}")

    # Phase 2: Fetch and insert missing players
    print("\n" + "=" * 60)
    print("FASE 2: Importar jugadores faltantes")
    print("=" * 60)

    # Build country name lookup
    cur.execute("SELECT internal_id, nombre FROM pais WHERE activo = true")
    pais_nombres = {r[0]: r[1] for r in cur.fetchall()}

    # Get or create a default "unknown" club? No - club can be NULL
    inserted = 0
    failed = 0
    
    for pais_id, missing_ids in missing_by_country.items():
        nombre = pais_nombres.get(pais_id, '?')
        
        for pid in missing_ids:
            try:
                r = requests.get('https://v3.football.api-sports.io/players', headers=HEADERS, params={
                    'id': pid, 'season': 2025
                })
                total_api_calls += 1
                data = r.json()
                
                if not data.get('response'):
                    # Try season 2024
                    r = requests.get('https://v3.football.api-sports.io/players', headers=HEADERS, params={
                        'id': pid, 'season': 2024
                    })
                    total_api_calls += 1
                    data = r.json()
                
                if not data.get('response'):
                    print(f"  SKIP: id={pid} not found in API")
                    failed += 1
                    time.sleep(0.3)
                    continue
                
                p = data['response'][0]
                player = p['player']
                stats = p['statistics'][0] if p.get('statistics') else {}
                
                # Parse name
                first = player.get('firstname') or ''
                last = player.get('lastname') or ''
                if not first and not last:
                    name = player.get('name', 'Unknown')
                    parts = name.split(' ', 1)
                    first = parts[0]
                    last = parts[1] if len(parts) > 1 else parts[0]
                
                # Position
                api_pos = stats.get('games', {}).get('position') or player.get('position') or 'Attacker'
                pos_code = POS_MAP.get(api_pos, 'DEL')
                pos_id = pos_db.get(pos_code, pos_db.get('DEL'))
                
                # Photo
                foto = player.get('photo')
                
                # Age & birth
                edad = player.get('age')
                birth = player.get('birth', {}).get('date')  # "1990-01-15"
                
                # Club (try to find in our DB)
                club_name = stats.get('team', {}).get('name')
                club_id = None
                if club_name:
                    cur.execute("SELECT internal_id FROM club WHERE nombre ILIKE %s LIMIT 1", (club_name,))
                    row = cur.fetchone()
                    if row:
                        club_id = row[0]
                
                # Shirt number
                numero = stats.get('games', {}).get('number')
                
                # Insert
                cur.execute("""
                    INSERT INTO jugador (pais_id, posicion_id, club_id, nombre, apellido, 
                                        fecha_nacimiento, edad, numero_camiseta, url_foto, 
                                        api_player_id, convocado_eliminatoria)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true)
                    ON CONFLICT (api_player_id) DO NOTHING
                """, (pais_id, pos_id, club_id, first, last, birth, edad, numero, foto, pid))
                
                if cur.rowcount > 0:
                    inserted += 1
                    existing_ids.add(pid)
                
                conn.commit()
                time.sleep(0.3)
                
            except Exception as e:
                print(f"  ERROR: id={pid} → {e}")
                conn.rollback()
                failed += 1
                time.sleep(0.3)
        
        cur.execute("""
            SELECT COUNT(*) FILTER (WHERE convocado_eliminatoria = true), COUNT(*)
            FROM jugador WHERE pais_id = %s
        """, (pais_id,))
        conv, total = cur.fetchone()
        print(f"  {nombre:25s}  imported {len(missing_ids):>3} → now {conv}/{total} convocados/total")

    print(f"\n{'='*60}")
    print(f"RESUMEN FINAL:")
    print(f"  Insertados: {inserted}")
    print(f"  Fallidos:   {failed}")
    print(f"  API calls:  {total_api_calls}")

    # Final per-country summary
    cur.execute("""
        SELECT p.nombre, 
               COUNT(*) FILTER (WHERE j.convocado_eliminatoria = true) as conv,
               COUNT(*) as total
        FROM jugador j JOIN pais p ON j.pais_id = p.internal_id
        WHERE p.activo = true
        GROUP BY p.nombre ORDER BY p.nombre
    """)
    print(f"\nConvocados por país (final):")
    for nombre, conv, total in cur.fetchall():
        print(f"  {nombre:25s}: {conv:>4} / {total:>4}")

    conn.close()

    # API status
    time.sleep(1)
    r = requests.get('https://v3.football.api-sports.io/status', headers=HEADERS)
    status = r.json()['response']['requests']
    print(f"\nAPI calls today: {status['current']}/{status['limit_day']}")


if __name__ == '__main__':
    main()
