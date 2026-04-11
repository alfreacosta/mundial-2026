"""
Fase 5: Cargar stats_json para todos los jugadores con api_player_id.
Estrategia: consultar por liga (20 jugadores/página) para minimizar API calls.
Matchea por api_player_id y guarda stats compactas en ambas DBs.
"""
import psycopg2
import psycopg2.extras
import requests
import json
import time
import sys
import os
from datetime import datetime

API_KEY = os.environ["API_FOOTBALL_KEY"]
HEADERS = {"x-apisports-key": API_KEY}
BASE    = "https://v3.football.api-sports.io"

LOCAL   = dict(host='localhost', dbname='mundial', user='postgres',
               password=os.environ.get("DB_PASS", "changeme"))
RAILWAY = dict(host=os.environ.get("RAILWAY_DB_HOST", "maglev.proxy.rlwy.net"),
               port=int(os.environ.get("RAILWAY_DB_PORT", "32738")),
               dbname=os.environ.get("RAILWAY_DB_NAME", "railway"),
               user=os.environ.get("RAILWAY_DB_USER", "postgres"),
               password=os.environ["RAILWAY_DB_PASS"])

# Ligas a consultar (league_id, season, label)
LEAGUES = [
    # UEFA
    ( 39, 2025, "Premier League"),
    (140, 2025, "La Liga"),
    ( 78, 2025, "Bundesliga"),
    (135, 2025, "Serie A"),
    ( 61, 2025, "Ligue 1"),
    (  2, 2025, "Champions League"),
    ( 88, 2025, "Eredivisie"),
    ( 94, 2025, "Primeira Liga"),
    (144, 2025, "Belgian Pro League"),
    (103, 2025, "Eliteserien"),
    (119, 2025, "Allsvenskan"),
    (345, 2025, "Czech First League"),
    (204, 2025, "Süper Lig"),
    (  3, 2025, "Europa League"),
    # CONMEBOL
    (128, 2025, "Liga Argentina 2025"),
    (128, 2026, "Liga Argentina 2026"),
    ( 71, 2025, "Brasileirão 2025"),
    ( 71, 2026, "Brasileirão 2026"),
    (239, 2025, "Liga BetPlay 2025"),
    (239, 2026, "Liga BetPlay 2026"),
    (242, 2025, "LigaPro Ecuador 2025"),
    (242, 2026, "LigaPro Ecuador 2026"),
    (268, 2025, "Primera Uruguay 2025"),
    (268, 2026, "Primera Uruguay 2026"),
    (250, 2025, "APF Apertura 2025"),
    (250, 2026, "APF Apertura 2026"),
    (252, 2025, "APF Clausura 2025"),
    (252, 2026, "APF Clausura 2026"),
    # CONCACAF
    (253, 2025, "MLS 2025"),
    (253, 2026, "MLS 2026"),
    (262, 2025, "Liga MX"),
    # AFC / CAF
    (307, 2025, "Saudi Pro League"),
    (233, 2025, "Egyptian Premier"),
    (289, 2025, "PSL South Africa"),
    ( 98, 2025, "J1 League 2025"),
    ( 98, 2026, "J1 League 2026"),
    (292, 2025, "K League 2025"),
    (292, 2026, "K League 2026"),
    # Internacionales
    (  1, 2026, "World Cup 2026"),
    ( 34, 2026, "WCQ South America"),
    ( 32, 2026, "WCQ Europe"),
]

def build_compact_stats(player_data):
    """Construye JSON compacto a partir de la respuesta de API-Football."""
    player = player_data.get("player", {})
    stats_arr = player_data.get("statistics", [])

    compact = {}
    compact["altura"] = player.get("height", "") or ""
    compact["peso"] = player.get("weight", "") or ""
    compact["nacimiento"] = (player.get("birth") or {}).get("date", "") or ""
    compact["lugar_nacimiento"] = (player.get("birth") or {}).get("place", "") or ""
    compact["nacionalidad"] = player.get("nationality", "") or ""

    if stats_arr:
        # Tomar la primera liga con partidos > 0, o la primera disponible
        s = stats_arr[0]
        for st in stats_arr:
            if (st.get("games") or {}).get("appearences", 0):
                s = st
                break

        games = s.get("games") or {}
        goals = s.get("goals") or {}
        shots = s.get("shots") or {}
        passes = s.get("passes") or {}
        dribbles = s.get("dribbles") or {}
        cards = s.get("cards") or {}

        compact["club"] = (s.get("team") or {}).get("name", "")
        compact["club_logo"] = (s.get("team") or {}).get("logo", "")
        compact["liga"] = (s.get("league") or {}).get("name", "")
        compact["temporada"] = str((s.get("league") or {}).get("season", ""))
        compact["partidos"] = games.get("appearences") or 0
        compact["minutos"] = games.get("minutes") or 0
        compact["rating"] = games.get("rating") or ""
        compact["goles"] = goals.get("total") or 0
        compact["asistencias"] = goals.get("assists") or 0
        compact["disparos"] = shots.get("total") or 0
        compact["disparos_arco"] = shots.get("on") or 0
        compact["pases_clave"] = passes.get("key") or 0
        compact["regates_ok"] = dribbles.get("success") or 0
        compact["regates_int"] = dribbles.get("attempts") or 0
        compact["amarillas"] = cards.get("yellow") or 0
        compact["rojas"] = cards.get("red") or 0

    return compact


def load_stats():
    lconn = psycopg2.connect(**LOCAL)
    rconn = psycopg2.connect(**RAILWAY)
    lcur = lconn.cursor()
    rcur = rconn.cursor()

    # Cargar todos los api_player_id que tenemos en la DB
    lcur.execute("SELECT api_player_id FROM jugador WHERE api_player_id IS NOT NULL")
    our_ids = {r[0] for r in lcur.fetchall()}
    print(f"Jugadores en DB con api_player_id: {len(our_ids)}")

    # Cargar los que ya tienen stats
    lcur.execute("SELECT api_player_id FROM jugador WHERE stats_json IS NOT NULL AND api_player_id IS NOT NULL")
    already_done = {r[0] for r in lcur.fetchall()}
    print(f"Ya con stats: {len(already_done)}")
    need_stats = our_ids - already_done
    print(f"Necesitan stats: {len(need_stats)}")

    total_api_calls = 0
    total_matched = 0
    total_updated = 0
    now = datetime.now()

    for league_id, season, label in LEAGUES:
        page = 1
        total_pages = 1
        league_matched = 0

        while page <= total_pages:
            # Rate limit: 10 req/min → esperar 7s entre calls
            if total_api_calls > 0 and total_api_calls % 10 == 0:
                print(f"    [pausa 5s por rate limit, {total_api_calls} calls hechas]")
                time.sleep(5)

            try:
                r = requests.get(f"{BASE}/players",
                    headers=HEADERS,
                    params={"league": league_id, "season": season, "page": page},
                    timeout=20)
                total_api_calls += 1
                data = r.json()
            except Exception as e:
                print(f"    ⚠ Error en {label} p{page}: {e}")
                time.sleep(10)
                continue

            if data.get("errors"):
                print(f"    ⚠ API error en {label} p{page}: {data['errors']}")
                if "Too many requests" in str(data["errors"]):
                    print("    Esperando 60s...")
                    time.sleep(60)
                    continue
                break

            total_pages = data.get("paging", {}).get("total", 1)

            if page == 1:
                print(f"\n📋 {label} (league={league_id}, season={season}) — {total_pages} páginas")

            for pd in data.get("response", []):
                api_id = pd.get("player", {}).get("id")
                if api_id and api_id in need_stats:
                    compact = build_compact_stats(pd)
                    stats_json = json.dumps(compact, ensure_ascii=False)

                    # Guardar en LOCAL
                    lcur.execute("""UPDATE jugador SET stats_json = %s, ultima_stats_sync = %s
                                    WHERE api_player_id = %s""",
                                 (stats_json, now, api_id))
                    # Guardar en RAILWAY
                    rcur.execute("""UPDATE jugador SET stats_json = %s, ultima_stats_sync = %s
                                    WHERE api_player_id = %s""",
                                 (stats_json, now, api_id))

                    league_matched += 1
                    total_matched += 1
                    need_stats.discard(api_id)

            page += 1
            time.sleep(1)  # 1s entre páginas

        if league_matched > 0:
            lconn.commit()
            rconn.commit()
            total_updated += league_matched
            print(f"  ✅ {league_matched} jugadores actualizados")

        # Status cada liga
        if total_api_calls % 50 == 0:
            print(f"\n  --- Status: {total_api_calls} calls, {total_updated} actualizados, {len(need_stats)} pendientes ---\n")

    # Commit final
    lconn.commit()
    rconn.commit()

    print(f"\n{'='*50}")
    print(f"✅ COMPLETADO")
    print(f"  API calls: {total_api_calls}")
    print(f"  Jugadores con stats: {total_updated}")
    print(f"  Pendientes sin stats: {len(need_stats)}")

    # Verificar
    lcur.execute("SELECT COUNT(*) FROM jugador WHERE stats_json IS NOT NULL")
    print(f"  Stats en LOCAL: {lcur.fetchone()[0]}")
    rcur.execute("SELECT COUNT(*) FROM jugador WHERE stats_json IS NOT NULL")
    print(f"  Stats en RAILWAY: {rcur.fetchone()[0]}")

    lconn.close()
    rconn.close()

if __name__ == "__main__":
    load_stats()
