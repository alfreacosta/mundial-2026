#!/usr/bin/env python3
"""
Actualiza dt_foto_url de cada selección usando imágenes de Wikipedia (Wikimedia).
Las URLs de api-sports ya no funcionan (403 Forbidden).
Usa la API de Wikipedia para obtener thumbnails (licencia libre).
"""
import os
import sys
import time
import requests
import psycopg2
from urllib.parse import quote

# ── DB config ──────────────────────────────────────────────
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "mundial")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "soloDios10*")

THUMB_SIZE = 300  # px

# ── Mapeo: codigo_pais → titulo de articulo Wikipedia (en inglés) ──
# Para nombres con diacríticos o ambiguos se usa el título exacto del artículo.
WIKI_MAP = {
    "GER": "Julian Nagelsmann",
    "SAU": "Roberto Mancini",
    "ALG": "Vladimir Petković",
    "ARG": "Lionel Scaloni",
    "AUS": "Tony Popović",
    "AUT": "Ralf Rangnick",
    "BEL": "Rudi Garcia",
    "BIH": "Sergej Barbarez",
    "BRA": "Carlo Ancelotti",
    "CPV": None,  # sin artículo Wikipedia conocido
    "CAN": "Jesse Marsch",
    "COL": "Néstor Lorenzo",
    "COD": "Sébastien Desabre",
    "KOR": "Kim Do-hoon",
    "CIV": None,  # Ibrahim Kamara - sin artículo claro
    "CRO": "Zlatko Dalić",
    "CUW": "Dick Advocaat",
    "ECU": "Sebastián Beccacece",
    "EGY": "Hossam Hassan",
    "SCO": "Steve Clarke",
    "ESP": "Luis de la Fuente",
    "USA": "Mauricio Pochettino",
    "FRA": "Didier Deschamps",
    "GHA": "Otto Addo",
    "HAI": "Sébastien Migné",
    "ENG": "Thomas Tuchel",
    "IRQ": "Graham Arnold",
    "IRN": "Amir Ghalenoei",
    "JPN": "Hajime Moriyasu",
    "JOR": "Vital Borkelmans",
    "MAR": "Walid Regragui",
    "MEX": "Javier Aguirre",
    "NOR": "Ståle Solbakken",
    "NZL": None,  # Fritz Schmid - sin artículo claro
    "NED": "Ronald Koeman",
    "PAN": "Thomas Christiansen",
    "PAR": "Gustavo Alfaro",
    "POR": "Roberto Martínez (footballer, born 1973)",
    "QAT": "Carlos Queiroz",
    "CZE": "Ivan Hašek",
    "SEN": None,  # Pape Thiaw - artículo puede no tener foto
    "RSA": "Hugo Broos",
    "SWE": "Jon Dahl Tomasson",
    "SUI": "Murat Yakın",
    "TUN": None,  # Sami Trabelsi
    "TUR": "Vincenzo Montella",
    "URU": "Marcelo Bielsa",
    "UZB": "Fabio Cannavaro",
}

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mundial2026App/1.0 (educational project; contact: admin@dt26.win)"
})


def get_wiki_thumb(title: str) -> str | None:
    """Obtiene la URL del thumbnail de Wikipedia para un artículo dado."""
    url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "titles": title,
        "prop": "pageimages",
        "format": "json",
        "pithumbsize": THUMB_SIZE,
        "redirects": 1,
    }
    try:
        resp = SESSION.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        pages = data.get("query", {}).get("pages", {})
        for page_id, page in pages.items():
            if page_id == "-1":
                return None
            thumb = page.get("thumbnail", {}).get("source")
            return thumb
    except Exception as e:
        print(f"    Wiki API error: {e}")
    return None


def search_wiki_thumb(query: str) -> str | None:
    """Busca un artículo en Wikipedia y obtiene su thumbnail."""
    url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "list": "search",
        "srsearch": f"{query} football manager",
        "srlimit": 3,
        "format": "json",
    }
    try:
        resp = SESSION.get(url, params=params, timeout=15)
        resp.raise_for_status()
        results = resp.json().get("query", {}).get("search", [])
        for r in results:
            title = r["title"]
            thumb = get_wiki_thumb(title)
            if thumb:
                return thumb
            time.sleep(0.3)
    except Exception as e:
        print(f"    Wiki search error: {e}")
    return None


def main():
    railway = "--railway" in sys.argv
    if railway:
        db_host = "maglev.proxy.rlwy.net"
        db_port = "32738"
        db_name = "railway"
        db_user = "postgres"
        db_pass = os.getenv("RAILWAY_DB_PASS", "epZZYVYmkhRcvuKaAoBSqZCHTEHmJaij")
        print("=== Conectando a Railway ===\n")
    else:
        db_host, db_port, db_name, db_user, db_pass = DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
        print("=== Conectando a DB local ===\n")

    conn = psycopg2.connect(
        host=db_host, port=db_port, dbname=db_name,
        user=db_user, password=db_pass
    )
    cur = conn.cursor()

    cur.execute("""
        SELECT internal_id, codigo, nombre, dt_nombre
        FROM pais
        WHERE dt_nombre IS NOT NULL AND dt_nombre != ''
        ORDER BY nombre
    """)
    paises = cur.fetchall()
    print(f"Procesando {len(paises)} selecciones...\n")

    ok = 0
    sin_foto = []

    for internal_id, codigo, nombre, dt_nombre in paises:
        print(f"  {codigo} {nombre} ({dt_nombre})... ", end="", flush=True)

        wiki_title = WIKI_MAP.get(codigo)
        thumb_url = None

        if wiki_title:
            thumb_url = get_wiki_thumb(wiki_title)

        # Fallback: buscar por nombre del DT
        if not thumb_url and dt_nombre:
            print("buscando... ", end="", flush=True)
            thumb_url = search_wiki_thumb(dt_nombre)

        if thumb_url:
            cur.execute(
                "UPDATE pais SET dt_foto_url = %s WHERE internal_id = %s",
                (thumb_url, internal_id)
            )
            print(f"OK")
            ok += 1
        else:
            print("SIN FOTO")
            sin_foto.append(f"{codigo} {nombre} ({dt_nombre})")

        time.sleep(0.5)  # ser amable con Wikipedia API

    conn.commit()
    cur.close()
    conn.close()

    print(f"\n{'='*50}")
    print(f"Actualizados: {ok}/{len(paises)}")
    if sin_foto:
        print(f"\nSin foto ({len(sin_foto)}):")
        for s in sin_foto:
            print(f"  - {s}")


if __name__ == "__main__":
    main()
