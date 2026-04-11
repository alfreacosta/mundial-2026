#!/usr/bin/env python3
"""
sync_wc2026.py - Sincronización completa del Mundial 2026
==========================================================

Fases:
  1 - Países y grupos  (actualiza api_team_id, grupo, inserta 5 países nuevos)
  2 - Partidos 2026    (horario Paraguay/Argentina UTC-4, fixture completo)
  3 - Planteles        (GET /players?team={id}&season=2026, paginado por equipo)
  4 - Ligas de clubes  (enriquecimiento: ~38 ligas top, deduplica por api_player_id)
  5 - Clubs            (rellena club_id, fecha_nacimiento y edad en jugadores existentes)

Uso:
    python3 tools/sync_wc2026.py --fase 1
    python3 tools/sync_wc2026.py --fase 1 --fase 2 --fase 3
    python3 tools/sync_wc2026.py --all          (fases 1-4)

Requiere: pip install requests psycopg2-binary
"""

import sys
import os
import argparse
import time
import requests
import psycopg2
from datetime import datetime

# ──────────────────────────────────────────────────────────
# CONFIGURACIÓN
# ──────────────────────────────────────────────────────────
API_KEY  = os.environ["API_FOOTBALL_KEY"]
BASE_URL = "https://v3.football.api-sports.io"
HEADERS  = {"x-apisports-key": API_KEY}
DELAY    = 2.0   # segundos entre llamadas (Pro plan: 30 req/min → 2s)

DB = {
    "host":     os.environ.get("DB_HOST", "localhost"),
    "port":     int(os.environ.get("DB_PORT", "5432")),
    "dbname":   os.environ.get("DB_NAME", "mundial"),
    "user":     os.environ.get("DB_USER", "postgres"),
    "password": os.environ.get("DB_PASS", "changeme"),
}

# ──────────────────────────────────────────────────────────
# MAPPING: api_team_id → código FIFA nuestro
# ──────────────────────────────────────────────────────────
API_ID_TO_CODIGO = {
    # Grupo A
    770:  "CZE",   16: "MEX",  1531: "RSA",    17: "KOR",
    # Grupo B
     15:  "SUI", 1113: "BIH",  5529: "CAN",  1569: "QAT",
    # Grupo C
   1108:  "SCO",    6: "BRA",  2386: "HAI",    31: "MAR",
    # Grupo D
    777:  "TUR",  2380: "PAR",  2384: "USA",    20: "AUS",
    # Grupo E
     25:  "GER",  2382: "ECU",  1501: "CIV",  5530: "CUW",
    # Grupo F
      5:  "SWE",  1118: "NED",    28: "TUN",    12: "JPN",
    # Grupo G
      1:  "BEL",    32: "EGY",    22: "IRN",  4673: "NZL",
    # Grupo H
      9:  "ESP",     7: "URU",  1533: "CPV",    23: "SAU",
    # Grupo I
      2:  "FRA",  1090: "NOR",    13: "SEN",  1567: "IRQ",
    # Grupo J
    775:  "AUT",    26: "ARG",  1532: "ALG",  1548: "JOR",
    # Grupo K
     27:  "POR",     8: "COL",  1508: "COD",  1568: "UZB",
    # Grupo L
      3:  "CRO",    10: "ENG",  1504: "GHA",    11: "PAN",
}

API_ID_TO_GROUP = {
    770:"A",  16:"A", 1531:"A",   17:"A",
     15:"B", 1113:"B", 5529:"B", 1569:"B",
   1108:"C",    6:"C", 2386:"C",   31:"C",
    777:"D", 2380:"D", 2384:"D",   20:"D",
     25:"E", 2382:"E", 1501:"E", 5530:"E",
      5:"F", 1118:"F",   28:"F",   12:"F",
      1:"G",   32:"G",   22:"G", 4673:"G",
      9:"H",    7:"H", 1533:"H",   23:"H",
      2:"I", 1090:"I",   13:"I", 1567:"I",
    775:"J",   26:"J", 1532:"J", 1548:"J",
     27:"K",    8:"K", 1508:"K", 1568:"K",
      3:"L",   10:"L", 1504:"L",   11:"L",
}

# 5 equipos reales que NO estaban en la BD (reemplazan a los placeholders)
NEW_TEAMS = [
    {"codigo": "SWE", "nombre": "Suecia",               "api_id":    5, "confed_id": 1},
    {"codigo": "CZE", "nombre": "República Checa",      "api_id":  770, "confed_id": 1},
    {"codigo": "TUR", "nombre": "Turquía",              "api_id":  777, "confed_id": 1},
    {"codigo": "BIH", "nombre": "Bosnia y Herzegovina", "api_id": 1113, "confed_id": 1},
    {"codigo": "COD", "nombre": "Congo DR",             "api_id": 1508, "confed_id": 4},
]

# Placeholders a desactivar
PLACEHOLDER_CODES = ["UEFAPA", "UEFAPB", "UEFAPC", "UEFAPD", "ICP1", "ICP2"]

# Mapeado de round → fase_id
ROUND_TO_FASE = {
    "group":        1,   # GRUPOS
    "round of 32":  7,   # TREINTAIDOSAVOS
    "round of 16":  2,   # OCTAVOS
    "1/8":          2,
    "8th":          2,
    "quarter":      3,   # CUARTOS
    "semi":         4,   # SEMIFINAL
    "3rd":          5,   # TERCER_PUESTO
    "third":        5,
}

# Mapeado de posición (inglés API) → posicion_id
POS_MAP = {
    "Goalkeeper": 1,
    "Defender":   2,
    "Midfielder": 3,
    "Attacker":   4,
    "Forward":    4,
}
POS_DEFAULT = 3  # Mediocampista

# Ligas de clubes para Fase 4
CLUB_LEAGUES = [
    # UEFA — temporada 2025-26 (season=2025 en la API)
    ( 39, 2025, "Premier League"),
    (140, 2025, "La Liga"),
    ( 78, 2025, "Bundesliga"),
    (135, 2025, "Serie A"),
    ( 61, 2025, "Ligue 1"),
    (  2, 2025, "UEFA Champions League"),
    ( 88, 2025, "Eredivisie"),
    ( 94, 2025, "Primeira Liga"),
    (144, 2025, "Belgian Pro League"),
    (103, 2025, "Eliteserien"),
    (119, 2025, "Allsvenskan"),
    (345, 2025, "Czech First League"),
    (204, 2025, "Süper Lig"),
    (  3, 2025, "UEFA Europa League"),
    # CONMEBOL — año calendario, 2025 y 2026
    (128, 2025, "Primera División Argentina"),
    (128, 2026, "Primera División Argentina 2026"),
    ( 71, 2025, "Brasileirão Série A"),
    ( 71, 2026, "Brasileirão Série A 2026"),
    (239, 2025, "Liga BetPlay Colombia"),
    (239, 2026, "Liga BetPlay Colombia 2026"),
    (242, 2025, "LigaPro Ecuador"),
    (242, 2026, "LigaPro Ecuador 2026"),
    (268, 2025, "Primera División Uruguay"),
    (268, 2026, "Primera División Uruguay 2026"),
    # Paraguay — Apertura (250) y Clausura (252), año calendario
    (250, 2025, "APF Apertura 2025"),
    (250, 2026, "APF Apertura 2026"),
    (252, 2025, "APF Clausura 2025"),
    (252, 2026, "APF Clausura 2026"),
    # CONCACAF — MLS año calendario (2026 disponible), Liga MX máx=2025
    (253, 2025, "MLS"),
    (253, 2026, "MLS 2026"),
    (262, 2025, "Liga MX"),
    # CAF / AFC — temporada actual en la API
    (307, 2025, "Saudi Pro League"),
    (233, 2025, "Egyptian Premier League"),
    (289, 2025, "PSL South Africa"),
    ( 98, 2025, "J1 League 2025"),
    ( 98, 2026, "J1 League 2026"),
    (292, 2025, "K League 1 2025"),
    (292, 2026, "K League 1 2026"),
]

# Nationality name (API) → código FIFA nuestro
NAT_TO_CODE = {
    # UEFA
    "Belgium": "BEL", "France": "FRA", "Croatia": "CRO",
    "Spain": "ESP", "England": "ENG", "Portugal": "POR",
    "Netherlands": "NED", "Austria": "AUT", "Switzerland": "SUI",
    "Scotland": "SCO", "Norway": "NOR", "Germany": "GER",
    "Czech Republic": "CZE", "Türkiye": "TUR", "Turkey": "TUR",
    "Bosnia": "BIH", "Bosnia & Herzegovina": "BIH", "Herzegovina": "BIH",
    "Sweden": "SWE",
    # CONMEBOL
    "Argentina": "ARG", "Brazil": "BRA", "Colombia": "COL",
    "Ecuador": "ECU", "Uruguay": "URU", "Paraguay": "PAR",
    # CONCACAF
    "United States": "USA", "United States of America": "USA",
    "Canada": "CAN", "Mexico": "MEX", "Panama": "PAN",
    "Haiti": "HAI", "Curaçao": "CUW", "Curacao": "CUW",
    # CAF
    "Morocco": "MAR", "Senegal": "SEN", "Egypt": "EGY",
    "Ghana": "GHA", "Tunisia": "TUN", "South Africa": "RSA",
    "Ivory Coast": "CIV", "Côte d'Ivoire": "CIV", "Cote d'Ivoire": "CIV",
    "Algeria": "ALG", "Cape Verde": "CPV", "Cape Verde Islands": "CPV",
    "Congo DR": "COD", "DR Congo": "COD", "Congo": "COD",
    # AFC
    "Japan": "JPN", "South Korea": "KOR", "Korea Republic": "KOR",
    "Australia": "AUS", "Iran": "IRN", "Saudi Arabia": "SAU",
    "Qatar": "QAT", "Iraq": "IRQ", "Jordan": "JOR", "Uzbekistan": "UZB",
    # OFC
    "New Zealand": "NZL",
}


# ──────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────
_call_count = 0

def api_get(path, retries=4):
    global _call_count
    url = BASE_URL + path
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=60)
            resp.raise_for_status()
            _call_count += 1
            remaining = resp.headers.get("x-ratelimit-requests-remaining", "?")
            print(f"  [API #{_call_count}] {path[:90]}  (restantes hoy: {remaining})")
            time.sleep(DELAY)
            return resp.json()
        except Exception as e:
            wait = 10 * (attempt + 1)
            print(f"  !! Error en llamada (intento {attempt+1}/{retries}): {e}")
            if attempt < retries - 1:
                print(f"     Reintentando en {wait}s...")
                time.sleep(wait)
            else:
                raise


def map_round_to_fase(round_str: str) -> int:
    low = round_str.lower()
    for key, fid in ROUND_TO_FASE.items():
        if key in low:
            return fid
    if "final" in low and "semi" not in low and "quarter" not in low and "3rd" not in low and "third" not in low:
        return 6  # FINAL
    return 1  # default: GRUPOS


def parse_local_dt(iso_str: str) -> str | None:
    """
    Convierte '2026-06-11T15:00:00-04:00' → '2026-06-11 15:00:00'
    La API ya devuelve el horario en la timezone solicitada (America/Asuncion = -04:00)
    asi que simplemente quitamos el offset para guardar la hora local paraguaya.
    """
    if not iso_str:
        return None
    try:
        dt = datetime.fromisoformat(iso_str)
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except ValueError:
        return None


def safe_name(firstname, lastname, full_name):
    """Devuelve (nombre, apellido) nunca vacíos."""
    fn = (firstname or "").strip()
    ln = (lastname or "").strip()
    if not fn and not ln:
        parts = (full_name or "Desconocido").strip().split(" ", 1)
        fn = parts[0]
        ln = parts[1] if len(parts) > 1 else parts[0]
    elif not fn:
        fn = ln
    elif not ln:
        ln = fn
    return fn, ln


# ══════════════════════════════════════════════════════════
# FASE 1: Países y grupos
# ══════════════════════════════════════════════════════════
def fase1_paises(conn):
    print("\n" + "═" * 60)
    print("  FASE 1: Países y grupos")
    print("═" * 60)
    cur = conn.cursor()

    # Cargar mapa codigo → internal_id actual
    cur.execute("SELECT codigo, internal_id FROM pais")
    codigo_to_id = {r[0]: r[1] for r in cur.fetchall()}

    # 1) Actualizar api_team_id y grupo para todos los 48 equipos
    updated = 0
    missing = []
    for api_id, codigo in API_ID_TO_CODIGO.items():
        grupo = API_ID_TO_GROUP[api_id]
        if codigo in codigo_to_id:
            cur.execute(
                "UPDATE pais SET api_team_id=%s, grupo=%s, activo=true WHERE codigo=%s",
                (api_id, grupo, codigo)
            )
            updated += 1
            print(f"    ✔ UPDATE  {codigo:4}  grupo={grupo}  api_team_id={api_id}")
        else:
            missing.append((api_id, codigo, grupo))

    conn.commit()
    print(f"\n  Actualizados: {updated}")

    # 2) Insertar equipos que faltan (5 nuevos)
    new_inserted = 0
    for api_id, codigo, grupo in missing:
        team_def = next((t for t in NEW_TEAMS if t["codigo"] == codigo), None)
        if team_def:
            cur.execute("""
                INSERT INTO pais (nombre, codigo, confederacion_id, grupo, activo, api_team_id, pj, pg, pe, pp, pts)
                VALUES (%s, %s, %s, %s, true, %s, 0, 0, 0, 0, 0)
                ON CONFLICT (codigo) DO UPDATE SET
                    api_team_id = EXCLUDED.api_team_id,
                    grupo       = EXCLUDED.grupo,
                    activo      = true
            """, (team_def["nombre"], codigo, team_def["confed_id"], grupo, api_id))
            new_inserted += 1
            print(f"    ✚ INSERT  {codigo:4}  grupo={grupo}  api_team_id={api_id}  nombre={team_def['nombre']}")
        else:
            print(f"    !! Sin definición para {codigo} (api_id={api_id})")

    conn.commit()
    print(f"  Nuevos insertados: {new_inserted}")

    # 3) Desactivar placeholders
    cur.execute(
        "UPDATE pais SET activo=false, grupo=NULL WHERE codigo = ANY(%s)",
        (PLACEHOLDER_CODES,)
    )
    conn.commit()
    print(f"  Placeholders desactivados: {PLACEHOLDER_CODES}")
    print(f"\n  ✅ Fase 1 completa: {updated} actualizados, {new_inserted} nuevos")


# ══════════════════════════════════════════════════════════
# FASE 2: Partidos con horario Paraguay
# ══════════════════════════════════════════════════════════
def fase2_partidos(conn):
    print("\n" + "═" * 60)
    print("  FASE 2: Partidos 2026 (horario Paraguay)")
    print("═" * 60)
    cur = conn.cursor()

    # Agregar columna api_fixture_id si no existe
    cur.execute("ALTER TABLE partido ADD COLUMN IF NOT EXISTS api_fixture_id BIGINT")
    conn.commit()

    # Agregar constraint UNIQUE (ignorar si ya existe)
    try:
        cur.execute("""
            ALTER TABLE partido
            ADD CONSTRAINT uq_partido_api_fixture UNIQUE (api_fixture_id)
        """)
        conn.commit()
        print("  Constraint uq_partido_api_fixture creado")
    except Exception:
        conn.rollback()
        print("  Constraint ya existía, continuando...")
        cur = conn.cursor()

    # Construir mapa api_team_id → pais.internal_id (después de Fase 1)
    cur.execute("SELECT api_team_id, internal_id FROM pais WHERE api_team_id IS NOT NULL")
    api_to_internal = {int(r[0]): r[1] for r in cur.fetchall()}
    print(f"  Teams en BD con api_team_id: {len(api_to_internal)}")

    # Obtener todos los fixtures del Mundial 2026 con timezone Paraguay
    data = api_get("/fixtures?league=1&season=2026&timezone=America%2FAsuncion")
    fixtures = data.get("response", [])
    print(f"  Fixtures obtenidos de la API: {len(fixtures)}")

    # Borrar partidos existentes (seguro: 0 predicciones, 0 alineaciones)
    cur.execute("DELETE FROM partido")
    conn.commit()
    print("  Partidos anteriores eliminados. Insertando desde API...")

    inserted = 0
    skipped = 0
    for f in fixtures:
        fix       = f.get("fixture", {})
        teams     = f.get("teams", {})
        league    = f.get("league", {})
        goals     = f.get("goals", {}) or {}
        status    = fix.get("status", {}) or {}

        api_fixture_id = fix.get("id")
        date_str       = parse_local_dt(fix.get("date"))
        venue_name     = (fix.get("venue") or {}).get("name") or ""
        round_str      = league.get("round", "")
        fase_id        = map_round_to_fase(round_str)

        home_api_id  = (teams.get("home") or {}).get("id")
        away_api_id  = (teams.get("away") or {}).get("id")
        local_id     = api_to_internal.get(home_api_id)
        visitante_id = api_to_internal.get(away_api_id)

        gol_l = goals.get("home")
        gol_v = goals.get("away")

        short = status.get("short", "NS")
        if short in ("FT", "AET", "PEN"):
            estado     = "FINALIZADO"
            finalizado = True
        elif short in ("1H", "HT", "2H", "ET", "P", "LIVE"):
            estado     = "EN_CURSO"
            finalizado = False
        else:
            estado     = "PENDIENTE"
            finalizado = False

        # Si la fecha es None (TBD), usar fecha placeholder 2026-12-31
        if date_str is None:
            date_str = "2026-12-31 00:00:00"

        try:
            cur.execute("""
                INSERT INTO partido
                    (equipo_local_id, equipo_visitante_id, fase_id, trans_date,
                     estadio, gol_local, gol_visitante, estado, finalizado, api_fixture_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (local_id, visitante_id, fase_id, date_str,
                  venue_name, gol_l, gol_v, estado, finalizado, api_fixture_id))
            inserted += 1
        except Exception as e:
            conn.rollback()
            print(f"    !! Error insertando fixture {api_fixture_id}: {e}")
            cur = conn.cursor()
            skipped += 1
            continue

    conn.commit()
    print(f"\n  ✅ Fase 2 completa: {inserted} partidos insertados, {skipped} errores")


# ══════════════════════════════════════════════════════════
# FASE 3: Planteles nacionales (season=2026)
# ══════════════════════════════════════════════════════════
def fase3_planteles(conn):
    print("\n" + "═" * 60)
    print("  FASE 3: Planteles nacionales 2026")
    print("═" * 60)
    cur = conn.cursor()

    # Equipos a sincronizar (solo los 48 clasificados activos con api_team_id)
    cur.execute("""
        SELECT internal_id, codigo, nombre, api_team_id
        FROM pais
        WHERE api_team_id IS NOT NULL
          AND grupo IS NOT NULL
          AND activo = true
        ORDER BY grupo, codigo
    """)
    teams = cur.fetchall()
    print(f"  Equipos a sincronizar: {len(teams)}")

    # api_player_ids ya existentes (para no duplicar)
    cur.execute("SELECT api_player_id FROM jugador WHERE api_player_id IS NOT NULL")
    existing_ids = {r[0] for r in cur.fetchall()}
    print(f"  Jugadores existentes en BD: {len(existing_ids)}")

    total_nuevos      = 0
    total_actualizados = 0

    for pais_id, codigo, nombre_pais, api_team_id in teams:
        print(f"\n  → {codigo} ({nombre_pais})  api_id={api_team_id}")
        page = 1

        while True:
            data        = api_get(f"/players?team={api_team_id}&season=2026&page={page}")
            players     = data.get("response", [])
            total_pages = (data.get("paging") or {}).get("total", 1)

            if not players:
                print(f"    Sin jugadores (página {page})")
                break

            nuevos_pag = 0
            act_pag    = 0
            for item in players:
                p    = item.get("player") or {}
                stats = item.get("statistics") or [{}]
                stat  = stats[0] if stats else {}
                games = stat.get("games") or {}

                api_pid = p.get("id")
                if not api_pid:
                    continue

                fn, ln  = safe_name(p.get("firstname"), p.get("lastname"), p.get("name"))
                pos_str = games.get("position") or ""
                pos_id  = POS_MAP.get(pos_str, POS_DEFAULT)
                birth   = p.get("birth") or {}
                birth_d = birth.get("date")
                age     = p.get("age")
                number  = games.get("number")
                photo   = p.get("photo") or f"https://media.api-sports.io/football/players/{api_pid}.png"

                apperances_s3 = (games.get("appearences") or 0)
                if api_pid in existing_ids:
                    cur.execute("""
                        UPDATE jugador
                        SET nombre=%s, apellido=%s, posicion_id=%s,
                            fecha_nacimiento=%s, edad=%s, numero_camiseta=%s,
                            url_foto=%s, pais_id=%s, partidos_temporada=%s
                        WHERE api_player_id=%s
                    """, (fn, ln, pos_id, birth_d, age, number, photo, pais_id, apperances_s3, api_pid))
                    act_pag += 1
                else:
                    cur.execute("""
                        INSERT INTO jugador
                            (pais_id, posicion_id, nombre, apellido,
                             fecha_nacimiento, edad, numero_camiseta,
                             url_foto, api_player_id, partidos_temporada)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (pais_id, pos_id, fn, ln, birth_d, age, number, photo, api_pid, apperances_s3))
                    existing_ids.add(api_pid)
                    nuevos_pag += 1

            conn.commit()
            total_nuevos       += nuevos_pag
            total_actualizados += act_pag
            print(f"    Pág {page}/{total_pages}: {nuevos_pag} nuevos, {act_pag} actualizados")

            if page >= total_pages:
                break
            page += 1

    print(f"\n  ✅ Fase 3 completa: {total_nuevos} nuevos, {total_actualizados} actualizados")


# ══════════════════════════════════════════════════════════
# FASE 4: Ligas de clubes (enriquecimiento)
# ══════════════════════════════════════════════════════════
def fase4_ligas(conn):
    print("\n" + "═" * 60)
    print("  FASE 4: Jugadores de ligas de clubes")
    print("═" * 60)
    cur = conn.cursor()

    # Mapa codigo → pais_id (solo clasificados activos con grupo)
    cur.execute("SELECT codigo, internal_id FROM pais WHERE grupo IS NOT NULL AND activo = true")
    codigo_to_pais_id = {r[0]: r[1] for r in cur.fetchall()}
    print(f"  Países objetivo: {len(codigo_to_pais_id)}")

    # api_player_ids ya en BD
    cur.execute("SELECT api_player_id FROM jugador WHERE api_player_id IS NOT NULL")
    existing_ids = {r[0] for r in cur.fetchall()}
    print(f"  Jugadores ya en BD: {len(existing_ids)}")

    # Un jugador de liga de clubes es relevante si jugó al menos este número de partidos.
    # Evita llenar la BD con reservas de reservas.
    MIN_PARTIDOS = 5

    total_nuevos   = 0
    total_ligas    = 0

    for league_id, season, league_name in CLUB_LEAGUES:
        print(f"\n  Liga: {league_name} (id={league_id}, season={season})")

        data        = api_get(f"/players?league={league_id}&season={season}&page=1")
        total_pages = (data.get("paging") or {}).get("total", 0)

        if total_pages == 0:
            print(f"    Sin datos para esta liga/temporada")
            continue

        print(f"    Total páginas: {total_pages}")
        total_ligas += 1
        liga_nuevos  = 0

        for page in range(1, total_pages + 1):
            if page > 1:
                data = api_get(f"/players?league={league_id}&season={season}&page={page}")

            players = data.get("response", [])

            for item in players:
                p    = item.get("player") or {}
                stats = item.get("statistics") or [{}]
                stat  = stats[0] if stats else {}
                games = stat.get("games") or {}

                api_pid = p.get("id")
                if not api_pid or api_pid in existing_ids:
                    continue

                # Filtro de calidad: solo jugadores con partidos suficientes
                appearences = (games.get("appearences") or 0)
                if appearences < MIN_PARTIDOS:
                    continue

                nationality = p.get("nationality") or ""
                codigo      = NAT_TO_CODE.get(nationality)
                pais_id     = codigo_to_pais_id.get(codigo) if codigo else None
                if not pais_id:
                    continue   # no es de un país clasificado al Mundial

                fn, ln  = safe_name(p.get("firstname"), p.get("lastname"), p.get("name"))
                pos_str = games.get("position") or ""
                pos_id  = POS_MAP.get(pos_str, POS_DEFAULT)
                birth   = p.get("birth") or {}
                birth_d = birth.get("date")
                age     = p.get("age")
                number  = games.get("number")
                photo   = p.get("photo") or f"https://media.api-sports.io/football/players/{api_pid}.png"

                try:
                    cur.execute("""
                        INSERT INTO jugador
                            (pais_id, posicion_id, nombre, apellido,
                             fecha_nacimiento, edad, numero_camiseta,
                             url_foto, api_player_id, partidos_temporada)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (pais_id, pos_id, fn, ln, birth_d, age, number, photo, api_pid, appearences))
                    existing_ids.add(api_pid)
                    liga_nuevos  += 1
                    total_nuevos += 1
                except Exception as e:
                    conn.rollback()
                    cur = conn.cursor()

            conn.commit()
            print(f"    Pág {page}/{total_pages}: acumulado liga={liga_nuevos}, total={total_nuevos}")

        print(f"    Liga {league_name}: {liga_nuevos} nuevos jugadores")

    print(f"\n  ✅ Fase 4 completa: {total_ligas} ligas procesadas, {total_nuevos} jugadores nuevos")


# ══════════════════════════════════════════════════════════
# FASE 5: Enriquecer club_id, fecha_nacimiento y edad
# ══════════════════════════════════════════════════════════
def fase5_clubs(conn):
    """
    Recorre las mismas ligas de la Fase 4 (mismas llamadas API, mismo costo).
    Para cada jugador YA existente en la BD sin club asignado:
      - Crea el club si no existe (ON CONFLICT ignorado)
      - Hace UPDATE club_id en jugador
      - Rellena fecha_nacimiento y edad si estaban NULL
    NO inserta jugadores nuevos.
    """
    print("\n" + "═" * 60)
    print("  FASE 5: Enriquecimiento clubs + datos faltantes")
    print("═" * 60)
    cur = conn.cursor()

    # Hacer pais_id nullable en club (puede ser de un país fuera del Mundial)
    cur.execute("ALTER TABLE club ALTER COLUMN pais_id DROP NOT NULL")
    conn.commit()
    print("  club.pais_id → nullable OK")

    # Cache clubs ya existentes: codigo (str(api_team_id)) → internal_id
    cur.execute("SELECT codigo, internal_id FROM club")
    club_cache = {r[0]: r[1] for r in cur.fetchall()}
    print(f"  Clubes ya en BD: {len(club_cache)}")

    # Jugadores sin club: api_player_id → internal_id
    cur.execute("""
        SELECT api_player_id, internal_id FROM jugador
        WHERE api_player_id IS NOT NULL AND club_id IS NULL
    """)
    sin_club = {r[0]: r[1] for r in cur.fetchall()}
    print(f"  Jugadores sin club: {len(sin_club)}")

    total_actualizados = 0
    total_clubes_nuevos = 0

    for league_id, season, league_name in CLUB_LEAGUES:
        print(f"\n  Liga: {league_name} (id={league_id}, season={season})")

        data        = api_get(f"/players?league={league_id}&season={season}&page=1")
        total_pages = (data.get("paging") or {}).get("total", 0)

        if total_pages == 0:
            print(f"    Sin datos para esta liga/temporada")
            continue

        print(f"    Total páginas: {total_pages}")
        liga_act = 0

        for page in range(1, total_pages + 1):
            if page > 1:
                data = api_get(f"/players?league={league_id}&season={season}&page={page}")

            players = data.get("response", [])

            for item in players:
                p     = item.get("player") or {}
                stats = item.get("statistics") or [{}]
                stat  = stats[0] if stats else {}
                team  = stat.get("team") or {}

                api_pid = p.get("id")
                if not api_pid or api_pid not in sin_club:
                    continue

                # ── Club ──────────────────────────────────────────────
                api_team_id  = team.get("id")
                club_nombre  = (team.get("name") or "Desconocido").strip()
                club_logo    = team.get("logo") or None
                club_codigo  = str(api_team_id) if api_team_id else None

                club_id = None
                if club_codigo:
                    if club_codigo in club_cache:
                        club_id = club_cache[club_codigo]
                    else:
                        try:
                            cur.execute("""
                                INSERT INTO club (nombre, codigo, url_escudo, activo)
                                VALUES (%s, %s, %s, true)
                                ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
                                RETURNING internal_id
                            """, (club_nombre, club_codigo, club_logo))
                            club_id = cur.fetchone()[0]
                            club_cache[club_codigo] = club_id
                            total_clubes_nuevos += 1
                        except Exception as e:
                            conn.rollback()
                            cur = conn.cursor()
                            continue

                if not club_id:
                    continue

                # ── Datos del jugador que pueden estar vacíos ─────────
                birth   = p.get("birth") or {}
                birth_d = birth.get("date")   # e.g. "1998-03-15"
                age     = p.get("age")        # entero

                # COALESCE: solo rellena si el campo está NULL en BD
                cur.execute("""
                    UPDATE jugador
                    SET club_id          = %s,
                        fecha_nacimiento = COALESCE(fecha_nacimiento, %s),
                        edad             = COALESCE(edad, %s)
                    WHERE api_player_id  = %s
                """, (club_id, birth_d, age, api_pid))

                sin_club.pop(api_pid)  # evitar procesarlo dos veces
                liga_act          += 1
                total_actualizados += 1

            conn.commit()
            print(f"    Pág {page}/{total_pages}: actualizados this_page, liga acum={liga_act}")

        print(f"    Liga {league_name}: {liga_act} jugadores actualizados")

    print(f"\n  ✅ Fase 5 completa:")
    print(f"     Jugadores con club asignado : {total_actualizados}")
    print(f"     Clubes nuevos creados       : {total_clubes_nuevos}")
    print(f"     Jugadores aún sin club      : {len(sin_club)}")
    print(f"     (los sin club son de planteles nac. que no juegan en ninguna liga de las 38)")


# ──────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Sincronización completa del Mundial 2026",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Ejemplos:
  python3 tools/sync_wc2026.py --fase 1
  python3 tools/sync_wc2026.py --fase 1 --fase 2 --fase 3
  python3 tools/sync_wc2026.py --all
        """
    )
    parser.add_argument(
        "--fase", type=int, action="append", metavar="N",
        help="Fase a ejecutar (1=países, 2=partidos, 3=planteles, 4=ligas, 5=clubs). Repetible."
    )
    parser.add_argument(
        "--all", action="store_true",
        help="Ejecutar todas las fases (1-4)"
    )
    args = parser.parse_args()

    fases = set(args.fase or [])
    if args.all:
        fases = {1, 2, 3, 4}
    if not fases:
        print("Especifica al menos una fase con --fase N o usa --all")
        print("  --fase 1  → países y grupos")
        print("  --fase 2  → partidos con horario Paraguay")
        print("  --fase 3  → planteles nacionales 2026")
        print("  --fase 4  → jugadores de ligas de clubes (inserta nuevos)")
        print("  --fase 5  → enriquece club_id, fecha_nacimiento, edad (~1.361 llamadas)")
        sys.exit(1)

    print(f"\nFases a ejecutar: {sorted(fases)}")
    print(f"Estimado llamadas API: fase1=0, fase2=1, fase3=~130, fase4=~1361, fase5=~1361")

    conn = psycopg2.connect(**DB)
    try:
        if 1 in fases:
            fase1_paises(conn)
        if 2 in fases:
            fase2_partidos(conn)
        if 3 in fases:
            fase3_planteles(conn)
        if 4 in fases:
            fase4_ligas(conn)
        if 5 in fases:
            fase5_clubs(conn)
    finally:
        conn.close()

    print(f"\n{'═'*60}")
    print(f"  ✅ Sync completo. Total llamadas API usadas: {_call_count}")
    print(f"{'═'*60}")


if __name__ == "__main__":
    main()
