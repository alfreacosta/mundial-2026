#!/usr/bin/env python3
"""
sync_apf_conmebol2026.py
========================
Script puntual para traer jugadores que faltaron en la Fase 4:
  - APF Apertura (250) y Clausura (252), temporadas 2025 y 2026
  - Ligas CONMEBOL temporada 2026 (Argentina, Brasil, Colombia, Ecuador, Uruguay)

Usa la misma lógica de deduplicación por api_player_id que sync_wc2026.py.

Uso:
    python3 tools/sync_apf_conmebol2026.py
"""

import sys
import os
import time
import requests
import psycopg2
from datetime import datetime

API_KEY  = os.environ["API_FOOTBALL_KEY"]
BASE_URL = "https://v3.football.api-sports.io"
HEADERS  = {"x-apisports-key": API_KEY}
DELAY    = 2.0

DB = {
    "host":     os.environ.get("DB_HOST", "localhost"),
    "port":     int(os.environ.get("DB_PORT", "5432")),
    "dbname":   os.environ.get("DB_NAME", "mundial"),
    "user":     os.environ.get("DB_USER", "postgres"),
    "password": os.environ.get("DB_PASS", "changeme"),
}

# Ligas a procesar en este script
LIGAS = [
    # APF Paraguay (Apertura + Clausura, id correcto)
    (250, 2025, "APF Apertura 2025"),
    (250, 2026, "APF Apertura 2026"),
    (252, 2025, "APF Clausura 2025"),
    (252, 2026, "APF Clausura 2026"),
    # CONMEBOL temporada 2026 (calendario año)
    (128, 2026, "Primera División Argentina 2026"),
    ( 71, 2026, "Brasileirão Série A 2026"),
    (239, 2026, "Liga BetPlay Colombia 2026"),
    (242, 2026, "LigaPro Ecuador 2026"),
    (268, 2026, "Primera División Uruguay 2026"),
]

NAT_TO_CODE = {
    "Argentina": "ARG", "Brazil": "BRA", "Colombia": "COL",
    "Ecuador": "ECU",   "Uruguay": "URU", "Paraguay": "PAR",
    "United States": "USA", "United States of America": "USA",
    "Canada": "CAN", "Mexico": "MEX", "Panama": "PAN",
    "Haiti": "HAI", "Curaçao": "CUW", "Curacao": "CUW",
    "Morocco": "MAR", "Senegal": "SEN", "Egypt": "EGY",
    "Ghana": "GHA", "Tunisia": "TUN", "South Africa": "RSA",
    "Ivory Coast": "CIV", "Côte d'Ivoire": "CIV", "Cote d'Ivoire": "CIV",
    "Algeria": "ALG", "Cape Verde": "CPV", "Cape Verde Islands": "CPV",
    "Congo DR": "COD", "DR Congo": "COD", "Congo": "COD",
    "Belgium": "BEL", "France": "FRA",  "Croatia": "CRO",
    "Spain": "ESP", "England": "ENG",   "Portugal": "POR",
    "Netherlands": "NED", "Austria": "AUT", "Switzerland": "SUI",
    "Scotland": "SCO",  "Norway": "NOR",  "Germany": "GER",
    "Czech Republic": "CZE", "Türkiye": "TUR", "Turkey": "TUR",
    "Bosnia": "BIH", "Bosnia & Herzegovina": "BIH",
    "Sweden": "SWE", "South Korea": "KOR", "Korea Republic": "KOR",
    "Japan": "JPN", "Australia": "AUS", "New Zealand": "NZL",
    "Iran": "IRN", "Saudi Arabia": "SAU", "Iraq": "IRQ",
    "Jordan": "JOR", "Uzbekistan": "UZB", "Qatar": "QAT",
}

POS_MAP = {
    "Goalkeeper": 1,
    "Defender":   2,
    "Midfielder": 3,
    "Attacker":   4,
}
POS_DEFAULT = 3

API_CALLS = 0

def api_get(path):
    global API_CALLS
    url = BASE_URL + path
    API_CALLS += 1
    r = requests.get(url, headers=HEADERS, timeout=30)
    remaining = r.headers.get("x-ratelimit-requests-remaining", "?")
    print(f"  [API #{API_CALLS}] {path}  (restantes hoy: {remaining})")
    time.sleep(DELAY)
    return r.json()

def safe_name(first, last, full):
    fn = (first or "").strip()
    ln = (last  or "").strip()
    if not fn and not ln and full:
        parts = full.strip().split()
        fn = parts[0] if parts else ""
        ln = " ".join(parts[1:]) if len(parts) > 1 else ""
    return fn or "Desconocido", ln or fn or "Desconocido"


def main():
    conn = psycopg2.connect(**DB)
    cur  = conn.cursor()

    # Mapa codigo → pais_id
    cur.execute("SELECT codigo, internal_id FROM pais WHERE grupo IS NOT NULL AND activo = true")
    codigo_to_pais_id = {r[0]: r[1] for r in cur.fetchall()}
    print(f"Países clasificados: {len(codigo_to_pais_id)}")

    # api_player_ids ya en BD
    cur.execute("SELECT api_player_id FROM jugador WHERE api_player_id IS NOT NULL")
    existing_ids = {r[0] for r in cur.fetchall()}
    print(f"Jugadores ya en BD: {len(existing_ids)}")

    # Solo jugadores con al menos 3 partidos en la temporada (APF tiene menos partidos totales)
    MIN_PARTIDOS = 3

    total_nuevos = 0

    for league_id, season, league_name in LIGAS:
        print(f"\n{'═'*60}")
        print(f"Liga: {league_name} (id={league_id}, season={season})")

        data = api_get(f"/players?league={league_id}&season={season}&page=1")
        total_pages = (data.get("paging") or {}).get("total", 0)

        if total_pages == 0:
            print(f"  Sin datos para esta liga/temporada")
            continue

        print(f"  Total páginas: {total_pages}")
        liga_nuevos = 0

        for page in range(1, total_pages + 1):
            if page > 1:
                data = api_get(f"/players?league={league_id}&season={season}&page={page}")

            players = data.get("response", [])

            for item in players:
                p     = item.get("player") or {}
                stats = item.get("statistics") or [{}]
                stat  = stats[0] if stats else {}
                games = stat.get("games") or {}

                api_pid = p.get("id")
                if not api_pid or api_pid in existing_ids:
                    continue

                # Filtro: solo jugadores con partidos suficientes
                appearences = (games.get("appearences") or 0)
                if appearences < MIN_PARTIDOS:
                    continue

                nationality = p.get("nationality") or ""
                codigo      = NAT_TO_CODE.get(nationality)
                pais_id     = codigo_to_pais_id.get(codigo) if codigo else None
                if not pais_id:
                    continue

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
                             url_foto, api_player_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (pais_id, pos_id, fn, ln, birth_d, age, number, photo, api_pid))
                    existing_ids.add(api_pid)
                    liga_nuevos  += 1
                    total_nuevos += 1
                    print(f"    ✅ {fn} {ln} ({nationality}/{codigo}) id={api_pid}")
                except Exception as e:
                    conn.rollback()
                    cur = conn.cursor()

            conn.commit()
            print(f"    Pág {page}/{total_pages}: liga={liga_nuevos}, total={total_nuevos}")

        print(f"  Liga {league_name}: {liga_nuevos} nuevos jugadores")

    cur.close()
    conn.close()
    print(f"\n{'═'*60}")
    print(f"✅ Completado. Jugadores nuevos agregados: {total_nuevos}")
    print(f"   API calls usados: {API_CALLS}")


if __name__ == "__main__":
    main()
