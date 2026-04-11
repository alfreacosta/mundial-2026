#!/usr/bin/env python3
"""
sync_api_football.py
====================
Sincroniza equipos y partidos del Mundial 2026 desde API-Football hacia la BD local.

Pasos:
  1. GET /teams?league=1&season=2026   → actualiza pais.api_team_id
  2. GET /fixtures?league=1&season=2026 → upsert en tabla partido

Uso:
    python3 tools/sync_api_football.py [--dry-run] [--steps teams|fixtures|all]

Requiere:
    pip install requests psycopg2-binary
"""

import sys
import os
import argparse
import json
import requests
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timezone

# ──────────────────────────────────────────────
# CONFIGURACIÓN
# ──────────────────────────────────────────────
API_KEY   = os.environ["API_FOOTBALL_KEY"]
BASE_URL  = "https://v3.football.api-sports.io"
LEAGUE_ID = 1       # FIFA World Cup
SEASON    = 2026

DB_HOST   = os.environ.get("DB_HOST", "localhost")
DB_PORT   = int(os.environ.get("DB_PORT", "5432"))
DB_NAME   = os.environ.get("DB_NAME", "mundial")
DB_USER   = os.environ.get("DB_USER", "postgres")
DB_PASS   = os.environ.get("DB_PASS", "changeme")

# ──────────────────────────────────────────────
# MAPEO: nombre en inglés (API) → código FIFA nuestro
# ──────────────────────────────────────────────
NAME_TO_CODE: dict[str, str] = {
    # UEFA
    "Germany":         "GER",
    "France":          "FRA",
    "England":         "ENG",
    "Spain":           "ESP",
    "Portugal":        "POR",
    "Italy":           "ITA",
    "Netherlands":     "NED",
    "Belgium":         "BEL",
    "Switzerland":     "SUI",
    "Austria":         "AUT",
    "Croatia":         "CRO",
    "Serbia":          "SRB",
    "Denmark":         "DEN",
    "Poland":          "POL",
    "Hungary":         "HUN",
    "Scotland":        "SCO",
    "Norway":          "NOR",
    # CONMEBOL
    "Argentina":       "ARG",
    "Brazil":          "BRA",
    "Colombia":        "COL",
    "Ecuador":         "ECU",
    "Uruguay":         "URU",
    "Chile":           "CHI",
    "Paraguay":        "PAR",
    # CONCACAF
    "United States":   "USA",
    "Canada":          "CAN",
    "Mexico":          "MEX",
    "Panama":          "PAN",
    "Jamaica":         "JAM",
    "Costa Rica":      "CRC",
    "Haiti":           "HAI",
    "Curaçao":         "CUW",
    "Curacao":         "CUW",
    # CAF
    "Morocco":         "MAR",
    "Senegal":         "SEN",
    "Egypt":           "EGY",
    "Cameroon":        "CMR",
    "Nigeria":         "NGA",
    "South Africa":    "RSA",
    "Ivory Coast":     "CIV",
    "Côte d'Ivoire":   "CIV",
    "Ghana":           "GHA",
    "Tunisia":         "TUN",
    "Algeria":         "ALG",
    "Cape Verde":      "CPV",
    # AFC
    "Japan":           "JPN",
    "South Korea":     "KOR",
    "Korea Republic":  "KOR",
    "Australia":       "AUS",
    "Iran":            "IRN",
    "Saudi Arabia":    "SAU",
    "Qatar":           "QAT",
    "Iraq":            "IRQ",
    "Jordan":          "JOR",
    "Uzbekistan":      "UZB",
    # OFC
    "New Zealand":     "NZL",
    # Repechaje
    "Peru":            "PER",
    "Bahrain":         "BHR",
}

# Mapeo: código de 3 letras de la API → código FIFA nuestro
# (cuando la API devuelve un código distinto)
CODE_OVERRIDE: dict[str, str] = {
    "CHE": "SUI",   # Switzerland ISO vs FIFA
    "KOR": "KOR",
    "CHI": "CHI",
    "IRN": "IRN",
    "MEX": "MEX",
    "ALG": "ALG",
    "CPV": "CPV",
    "UZB": "UZB",
    "PAR": "PAR",
    "HAI": "HAI",
    "CUW": "CUW",
    "NOR": "NOR",
}

ROUND_TO_FASE: dict[str, str] = {
    "group":         "GRUPOS",
    "round of 32":   "TREINTAIDOSAVOS",
    "round of 16":   "OCTAVOS",
    "quarter":       "CUARTOS",
    "semi":          "SEMIFINAL",
    "3rd":           "TERCER_PUESTO",
    "third":         "TERCER_PUESTO",
}


# ──────────────────────────────────────────────
# HELPERS API
# ──────────────────────────────────────────────

def api_get(path: str) -> dict:
    url = BASE_URL + path
    headers = {"x-apisports-key": API_KEY}
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    remaining = resp.headers.get("x-ratelimit-requests-remaining", "?")
    print(f"  [API] GET {path}  →  {resp.status_code}  (remaining calls: {remaining})")
    return data


def extract_group(round_str: str) -> str | None:
    """'Group A - 1' → 'A', 'Group Stage - 2' → None"""
    if not round_str:
        return None
    lower = round_str.lower()
    if "group" in lower:
        # Busca una letra sola después de "Group "
        import re
        m = re.search(r'group\s+([A-La-l])\b', round_str, re.IGNORECASE)
        if m:
            return m.group(1).upper()
    return None


def map_round_to_fase(round_str: str) -> str:
    if not round_str:
        return "GRUPOS"
    lower = round_str.lower()
    for key, fase in ROUND_TO_FASE.items():
        if key in lower:
            return fase
    if "final" in lower and "semi" not in lower and "quarter" not in lower:
        return "FINAL"
    return "GRUPOS"


def map_status(short: str) -> str:
    if short in ("NS", "TBD"):
        return "PENDIENTE"
    if short in ("FT", "AET", "PEN"):
        return "FINALIZADO"
    return "EN_CURSO"


# ──────────────────────────────────────────────
# PASO 1: SYNC EQUIPOS (api_team_id)
# ──────────────────────────────────────────────

def fetch_teams() -> list[dict]:
    data = api_get(f"/teams?league={LEAGUE_ID}&season={SEASON}")
    return data.get("response", [])


def find_our_code(api_code: str, api_name: str) -> str | None:
    """Intenta encontrar el código interno nuestro a partir del código/nombre de la API."""
    if api_code and api_code in CODE_OVERRIDE:
        return CODE_OVERRIDE[api_code]
    if api_code and len(api_code) == 3:
        # El código de la API coincide directamente con el nuestro (la mayoría)
        return api_code
    # Fallback: buscar por nombre
    return NAME_TO_CODE.get(api_name)


def sync_teams(cur, dry_run: bool) -> dict[int, int]:
    """
    Lee los equipos desde la API y actualiza pais.api_team_id.
    Retorna {api_team_id: pais.internal_id}.
    """
    print("\n─── PASO 1: Sincronizar equipos ───")
    teams = fetch_teams()
    print(f"  API devolvió {len(teams)} equipos")

    api_id_to_pais: dict[int, int] = {}
    updated = 0
    not_found = []

    for item in teams:
        team     = item.get("team", {})
        api_id   = team.get("id")
        api_code = team.get("code", "")
        api_name = team.get("name", "")
        league   = item.get("league", {})
        api_group = league.get("group", "")   # ej. "Group A"

        if not api_id:
            continue

        # Extraer letra de grupo si viene
        grupo_letra = None
        if api_group:
            import re
            m = re.search(r'Group\s+([A-L])', api_group, re.IGNORECASE)
            if m:
                grupo_letra = m.group(1).upper()

        our_code = find_our_code(api_code, api_name)
        if not our_code:
            not_found.append(f"{api_name} (id={api_id}, code={api_code})")
            continue

        # Buscar pais en BD por codigo
        cur.execute("SELECT internal_id, api_team_id, grupo FROM pais WHERE codigo = %s", (our_code,))
        row = cur.fetchone()
        if not row:
            not_found.append(f"{api_name} → our_code={our_code} NOT IN DB")
            continue

        pais_id, existing_api_id, existing_grupo = row
        api_id_to_pais[api_id] = pais_id

        needs_update = (existing_api_id != api_id) or (grupo_letra and existing_grupo != grupo_letra)
        if needs_update:
            if not dry_run:
                update_fields = "api_team_id = %s, ultimo_sync = NOW()"
                params = [api_id]
                if grupo_letra:
                    update_fields += ", grupo = %s"
                    params.append(grupo_letra)
                params.append(our_code)
                cur.execute(f"UPDATE pais SET {update_fields} WHERE codigo = %s", params)
            status = "[DRY]" if dry_run else "✓"
            grupo_info = f" → grupo={grupo_letra}" if grupo_letra else ""
            print(f"  {status} {api_name} (code={our_code}): api_team_id={api_id}{grupo_info}")
            updated += 1
        else:
            print(f"  = {api_name}: ya sincronizado (api_team_id={api_id})")

    print(f"\n  Total actualizado: {updated}")
    if not_found:
        print(f"  Sin mapear ({len(not_found)}):")
        for x in not_found:
            print(f"    - {x}")

    return api_id_to_pais


# ──────────────────────────────────────────────
# PASO 2: SYNC FIXTURES / PARTIDOS
# ──────────────────────────────────────────────

def ensure_api_external_id_column(cur, dry_run: bool):
    """Agrega columna api_external_id a partido si no existe."""
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name='partido' AND column_name='api_external_id'
    """)
    if not cur.fetchone():
        print("  Columna api_external_id no existe en partido → agregando...")
        if not dry_run:
            cur.execute("ALTER TABLE partido ADD COLUMN api_external_id BIGINT UNIQUE")
            print("  ✓ Columna api_external_id agregada")
        else:
            print("  [DRY] ALTER TABLE partido ADD COLUMN api_external_id BIGINT UNIQUE")
    else:
        print("  Columna api_external_id ya existe en partido")


def fetch_fixtures() -> list[dict]:
    data = api_get(f"/fixtures?league={LEAGUE_ID}&season={SEASON}")
    return data.get("response", [])


def get_fase_map(cur) -> dict[str, int]:
    """Retorna {fase.codigo: fase.internal_id}."""
    cur.execute("SELECT codigo, internal_id FROM fase")
    return {row[0]: row[1] for row in cur.fetchall()}


def get_pais_by_api_id(cur) -> dict[int, int]:
    """Retorna {pais.api_team_id: pais.internal_id} para todos los activos."""
    cur.execute("SELECT api_team_id, internal_id FROM pais WHERE api_team_id IS NOT NULL")
    return {row[0]: row[1] for row in cur.fetchall()}


def sync_fixtures(cur, dry_run: bool, api_id_to_pais: dict[int, int]) -> None:
    print("\n─── PASO 2: Sincronizar partidos (fixtures) ───")

    ensure_api_external_id_column(cur, dry_run)

    # Recargar mapa actualizado después de haber hecho sync de teams
    pais_by_api_id = get_pais_by_api_id(cur)
    # Añadir los que obtuvimos en paso 1 (por si el DB aún no se actualizó en dry_run)
    pais_by_api_id.update(api_id_to_pais)

    fase_map = get_fase_map(cur)
    print(f"  Fases disponibles: {list(fase_map.keys())}")

    fixtures = fetch_fixtures()
    print(f"  API devolvió {len(fixtures)} fixtures")

    inserted = 0
    updated  = 0
    skipped  = 0

    for item in fixtures:
        fix_node    = item.get("fixture", {})
        league_node = item.get("league", {})
        teams_node  = item.get("teams", {})
        goals_node  = item.get("goals", {})

        api_fix_id  = fix_node.get("id")
        if not api_fix_id:
            continue

        # Fecha/hora
        date_str = fix_node.get("date", "")
        try:
            if date_str.endswith("Z"):
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            else:
                dt = datetime.fromisoformat(date_str)
            # Normalizar a local (sin zona) para la BD
            trans_date = dt.astimezone(timezone.utc).replace(tzinfo=None)
        except Exception:
            trans_date = datetime.utcnow()

        # Estado
        status_short = fix_node.get("status", {}).get("short", "NS")
        estado     = map_status(status_short)
        finalizado = estado == "FINALIZADO"

        # Goles
        gol_local      = goals_node.get("home")
        gol_visitante  = goals_node.get("away")

        # Estadio
        estadio_nombre = fix_node.get("venue", {}).get("name", None)

        # Fase y grupo
        round_str = league_node.get("round", "")
        fase_codigo = map_round_to_fase(round_str)
        fase_id = fase_map.get(fase_codigo)
        if not fase_id:
            fase_id = fase_map.get("GRUPOS")

        # Equipos
        home_api_id = teams_node.get("home", {}).get("id")
        away_api_id = teams_node.get("away", {}).get("id")

        equipo_local_id      = pais_by_api_id.get(home_api_id) if home_api_id else None
        equipo_visitante_id  = pais_by_api_id.get(away_api_id) if away_api_id else None

        if not equipo_local_id:
            home_name = teams_node.get("home", {}).get("name", "?")
            print(f"  WARN: equipo local no encontrado: {home_name} (api_id={home_api_id})")
            skipped += 1
            continue

        # UPSERT
        if not dry_run:
            cur.execute("""
                SELECT internal_id FROM partido WHERE api_external_id = %s
            """, (api_fix_id,))
            existing = cur.fetchone()

            if existing:
                cur.execute("""
                    UPDATE partido SET
                        equipo_local_id     = %s,
                        equipo_visitante_id = %s,
                        fase_id             = %s,
                        trans_date          = %s,
                        estadio             = %s,
                        gol_local           = %s,
                        gol_visitante       = %s,
                        estado              = %s,
                        finalizado          = %s
                    WHERE api_external_id = %s
                """, (
                    equipo_local_id, equipo_visitante_id, fase_id,
                    trans_date, estadio_nombre,
                    gol_local, gol_visitante,
                    estado, finalizado,
                    api_fix_id
                ))
                updated += 1
            else:
                cur.execute("""
                    INSERT INTO partido (
                        equipo_local_id, equipo_visitante_id, fase_id,
                        trans_date, estadio,
                        gol_local, gol_visitante,
                        estado, finalizado, api_external_id
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    equipo_local_id, equipo_visitante_id, fase_id,
                    trans_date, estadio_nombre,
                    gol_local, gol_visitante,
                    estado, finalizado, api_fix_id
                ))
                inserted += 1
        else:
            home_name = teams_node.get("home", {}).get("name", "?")
            away_name = teams_node.get("away", {}).get("name", "?")
            print(f"  [DRY] {home_name} vs {away_name}  [{fase_codigo}] {trans_date}  api_id={api_fix_id}")
            inserted += 1

    print(f"\n  Fixtures insertados: {inserted}")
    print(f"  Fixtures actualizados: {updated}")
    print(f"  Fixtures omitidos (equipo local desconocido): {skipped}")


# ──────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Sync API-Football → BD Mundial 2026")
    parser.add_argument("--dry-run", action="store_true",
                        help="No modifica la BD, solo muestra lo que haría")
    parser.add_argument("--steps", choices=["teams", "fixtures", "all"], default="all",
                        help="Pasos a ejecutar (default: all)")
    args = parser.parse_args()

    dry_run = args.dry_run
    if dry_run:
        print(">>> MODO DRY-RUN: no se escribe nada en la BD <<<\n")

    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASS
    )
    conn.autocommit = False
    cur = conn.cursor()

    try:
        api_id_to_pais: dict[int, int] = {}

        if args.steps in ("teams", "all"):
            api_id_to_pais = sync_teams(cur, dry_run)
            if not dry_run:
                conn.commit()
                print("  ✓ Commit equipos")

        if args.steps in ("fixtures", "all"):
            if not api_id_to_pais:
                # Si no se corrió paso teams, cargamos desde BD
                cur.execute("SELECT api_team_id, internal_id FROM pais WHERE api_team_id IS NOT NULL")
                api_id_to_pais = {row[0]: row[1] for row in cur.fetchall()}
            sync_fixtures(cur, dry_run, api_id_to_pais)
            if not dry_run:
                conn.commit()
                print("  ✓ Commit partidos")

        print("\n═══ Sincronización completada ═══")

    except Exception as e:
        conn.rollback()
        print(f"\n✗ Error: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
