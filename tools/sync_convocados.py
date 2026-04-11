#!/usr/bin/env python3
"""
Sync convocado_eliminatoria: for each of the 48 WC countries,
fetch all fixtures (seasons 2024/2025/2026), get lineups,
collect player IDs, and UPDATE jugador SET convocado_eliminatoria = true.
"""
import requests, time, psycopg2, sys, os
from collections import Counter

API_KEY = os.environ["API_FOOTBALL_KEY"]
HEADERS = {'x-apisports-key': API_KEY}
SEASONS = [2024, 2025, 2026]

DB_LOCAL = dict(host='localhost', port=5432, dbname='mundial', user='postgres',
                password=os.environ.get("DB_PASS", "changeme"))
DB_RAILWAY = dict(host=os.environ.get("RAILWAY_DB_HOST", "maglev.proxy.rlwy.net"),
                  port=int(os.environ.get("RAILWAY_DB_PORT", "32738")),
                  dbname=os.environ.get("RAILWAY_DB_NAME", "railway"),
                  user=os.environ.get("RAILWAY_DB_USER", "postgres"),
                  password=os.environ["RAILWAY_DB_PASS"])

def get_db(target='local'):
    cfg = DB_LOCAL if target == 'local' else DB_RAILWAY
    return psycopg2.connect(**cfg)


def fetch_fixtures(team_id):
    """Get all finished fixtures for a team across seasons 2024-2026."""
    fixtures = []
    for season in SEASONS:
        r = requests.get('https://v3.football.api-sports.io/fixtures', headers=HEADERS, params={
            'team': team_id, 'season': season
        })
        data = r.json()
        for f in data.get('response', []):
            status = f['fixture']['status']['short']
            if status in ('FT', 'AET', 'PEN'):
                fixtures.append(f['fixture']['id'])
        time.sleep(0.35)
    return fixtures


def fetch_lineups(fixture_id, team_id):
    """Get all player IDs (XI + subs) for a team in a fixture."""
    r = requests.get('https://v3.football.api-sports.io/fixtures/lineups', headers=HEADERS, params={
        'fixture': fixture_id
    })
    data = r.json()
    player_ids = set()
    for team_data in data.get('response', []):
        if team_data['team']['id'] == team_id:
            for p in team_data.get('startXI', []) + team_data.get('substitutes', []):
                if p['player']['id']:
                    player_ids.add(p['player']['id'])
    return player_ids


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else 'local'
    print(f"=== Sync convocado_eliminatoria → {target.upper()} ===\n")

    conn = get_db(target)
    cur = conn.cursor()

    # Ensure column exists
    cur.execute("""
        ALTER TABLE jugador ADD COLUMN IF NOT EXISTS convocado_eliminatoria BOOLEAN DEFAULT false
    """)
    conn.commit()

    # Reset all to false first
    cur.execute("UPDATE jugador SET convocado_eliminatoria = false")
    conn.commit()

    # Get all 48 countries with their api_team_id
    cur.execute("SELECT internal_id, nombre, api_team_id FROM pais WHERE activo = true ORDER BY nombre")
    paises = cur.fetchall()
    print(f"Países activos: {len(paises)}\n")

    total_convocados = 0
    total_matched = 0
    total_fixtures = 0
    total_api_calls = 0

    for idx, (pais_id, nombre, api_team_id) in enumerate(paises, 1):
        if not api_team_id:
            print(f"[{idx:2}/{len(paises)}] {nombre:25s} — SIN api_team_id, skip")
            continue

        # 1) Get fixtures
        fixtures = fetch_fixtures(api_team_id)
        total_api_calls += len(SEASONS)
        print(f"[{idx:2}/{len(paises)}] {nombre:25s} team={api_team_id:>5}  fixtures={len(fixtures):>3}", end='')

        # 2) Get lineups
        all_player_ids = set()
        for fix_id in fixtures:
            pids = fetch_lineups(fix_id, api_team_id)
            all_player_ids.update(pids)
            time.sleep(0.25)
        total_api_calls += len(fixtures)
        total_fixtures += len(fixtures)

        # 3) Update DB
        if all_player_ids:
            id_list = list(all_player_ids)
            cur.execute("""
                UPDATE jugador SET convocado_eliminatoria = true
                WHERE api_player_id = ANY(%s)
            """, (id_list,))
            matched = cur.rowcount
            conn.commit()
        else:
            matched = 0

        total_convocados += len(all_player_ids)
        total_matched += matched
        print(f"  convocados={len(all_player_ids):>4}  matched_db={matched:>4}")

    print(f"\n{'='*60}")
    print(f"RESUMEN:")
    print(f"  Países procesados:       {len(paises)}")
    print(f"  Fixtures procesados:     {total_fixtures}")
    print(f"  Player IDs encontrados:  {total_convocados}")
    print(f"  Matched en DB:           {total_matched}")
    print(f"  API calls usadas:        ~{total_api_calls}")

    # Show final counts per country
    cur.execute("""
        SELECT p.nombre, COUNT(*) FILTER (WHERE j.convocado_eliminatoria = true), COUNT(*)
        FROM jugador j JOIN pais p ON j.pais_id = p.internal_id
        WHERE p.activo = true
        GROUP BY p.nombre ORDER BY p.nombre
    """)
    print(f"\nConvocados por país:")
    for pais, conv, total in cur.fetchall():
        pct = (conv * 100 // total) if total > 0 else 0
        print(f"  {pais:25s}: {conv:>4} / {total:>4} ({pct}%)")

    conn.close()

    # API status
    time.sleep(1)
    r = requests.get('https://v3.football.api-sports.io/status', headers=HEADERS)
    status = r.json()['response']['requests']
    print(f"\nAPI calls: {status['current']}/{status['limit_day']}")
    print("Done!")


if __name__ == '__main__':
    main()
