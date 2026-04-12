#!/usr/bin/env python3
"""
Carga el nombre y foto del DT de cada selección del Mundial 2026
en la tabla pais (columnas dt_nombre, dt_foto_url).
Usa API-Football para obtener nombre y foto (misma lógica que jugadores).
Ejecutar una sola vez o cuando cambien DTs.
"""
import os
import time
import requests
import psycopg2

API_KEY = os.environ["API_FOOTBALL_KEY"]
API_BASE = "https://v3.football.api-sports.io"

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "mundial")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.environ["DB_PASS"]

HEADERS = {"x-apisports-key": API_KEY}


def get_coach(api_team_id: int) -> dict | None:
    """Obtiene nombre completo y foto del DT desde API-Football."""
    url = f"{API_BASE}/coachs?team={api_team_id}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("response", [])
        if not results:
            return None
        coach = results[0]
        first = coach.get("firstname", "")
        last = coach.get("lastname", "")
        full = f"{first} {last}".strip() or coach.get("name", "")
        return {
            "nombre": full,
            "foto_url": coach.get("photo", ""),
        }
    except Exception as e:
        print(f"API error: {e}")
        return None


def main():
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASS
    )
    cur = conn.cursor()

    cur.execute("""
        SELECT internal_id, codigo, nombre, api_team_id
        FROM pais WHERE activo = true AND api_team_id IS NOT NULL
        ORDER BY nombre
    """)
    paises = cur.fetchall()
    print(f"Procesando {len(paises)} selecciones...\n")

    ok = 0
    sin_dt = 0

    for internal_id, codigo, nombre, api_team_id in paises:
        print(f"  {codigo} {nombre} (team={api_team_id})... ", end="", flush=True)

        coach = get_coach(api_team_id)
        if not coach or not coach["nombre"]:
            print("SIN DT")
            sin_dt += 1
        else:
            cur.execute(
                "UPDATE pais SET dt_nombre = %s, dt_foto_url = %s WHERE internal_id = %s",
                (coach["nombre"], coach["foto_url"], internal_id)
            )
            print(f"OK -> {coach['nombre']}")
            ok += 1

        time.sleep(7)  # rate limit: ~10 req/min en plan free

    conn.commit()
    cur.close()
    conn.close()
    print(f"\nListo: {ok} actualizados, {sin_dt} sin DT.")


if __name__ == "__main__":
    main()
