#!/usr/bin/env python3
"""
Carga el nombre y foto del DT de cada selección del Mundial 2026
en la tabla pais (columnas dt_nombre, dt_foto_url).
Usa Wikipedia para las fotos (thumbnails públicos).
Ejecutar una sola vez o cuando cambien DTs.
"""
import os
import time
import requests
import psycopg2
from urllib.parse import quote

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "mundial")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "soloDios10*")

# Mapeo: código país -> (nombre DT, título Wikipedia en inglés)
DT_MAP = {
    "ARG": ("Lionel Scaloni",           "Lionel_Scaloni"),
    "BRA": ("Dorival Júnior",           "Dorival_Júnior"),
    "URU": ("Marcelo Bielsa",           "Marcelo_Bielsa"),
    "COL": ("Néstor Lorenzo",           "Néstor_Lorenzo"),
    "ECU": ("Sebastián Beccacece",      "Sebastián_Beccacece"),
    "PAR": ("Alfredo Arias",            "Alfredo_Arias_(football_manager)"),
    "CHI": ("Nicolás Córdova",          "Nicolás_Córdova"),
    "PER": ("Jorge Fossati",            "Jorge_Fossati"),
    "ESP": ("Luis de la Fuente",        "Luis_de_la_Fuente"),
    "ENG": ("Thomas Tuchel",            "Thomas_Tuchel"),
    "FRA": ("Didier Deschamps",         "Didier_Deschamps"),
    "GER": ("Julian Nagelsmann",        "Julian_Nagelsmann"),
    "POR": ("Roberto Martínez",         "Roberto_Martínez_(football_manager)"),
    "NED": ("Ronald Koeman",            "Ronald_Koeman"),
    "BEL": ("Domenico Tedesco",         "Domenico_Tedesco"),
    "ITA": ("Luciano Spalletti",        "Luciano_Spalletti"),
    "CRO": ("Zlatko Dalić",             "Zlatko_Dalić"),
    "DEN": ("Brian Riemer",             "Brian_Riemer"),
    "SUI": ("Murat Yakın",              "Murat_Yakın"),
    "AUT": ("Ralf Rangnick",            "Ralf_Rangnick"),
    "USA": ("Mauricio Pochettino",      "Mauricio_Pochettino"),
    "MEX": ("Javier Aguirre",           "Javier_Aguirre_(footballer)"),
    "CAN": ("Jesse Marsch",             "Jesse_Marsch"),
    "JPN": ("Hajime Moriyasu",          "Hajime_Moriyasu"),
    "KOR": ("Hong Myung-bo",            "Hong_Myung-bo"),
    "AUS": ("Tony Popovic",             "Tony_Popovic"),
    "SAU": ("Roberto Mancini",          "Roberto_Mancini"),
    "MAR": ("Walid Regragui",           "Walid_Regragui"),
    "SEN": ("Pape Thiaw",               "Pape_Thiaw"),
    "GHA": ("Otto Addo",                "Otto_Addo"),
    "CIV": ("Emerse Faé",               "Emerse_Faé"),
    "TUN": ("Faouzi Benzarti",          "Faouzi_Benzarti"),
    "EGY": ("Hossam Hassan",            "Hossam_Hassan_(footballer)"),
    "RSA": ("Hugo Broos",               "Hugo_Broos"),
    "QAT": ("Luis García",              "Luis_García_(footballer,_born_1978)"),
    "IRN": ("Amir Ghalenoei",           "Amir_Ghalenoei"),
    "IRQ": ("Radhi Shenaishil",         "Radhi_Shenaishil"),
    "JOR": ("Mohammad Hussein",         None),
    "UZB": ("Timur Kapadze",            "Timur_Kapadze"),
    "NOR": ("Ståle Solbakken",          "Ståle_Solbakken"),
    "SWE": ("Jon Dahl Tomasson",        "Jon_Dahl_Tomasson"),
    "SCO": ("Steve Clarke",             "Steve_Clarke"),
    "CZE": ("Ivan Hašek",               "Ivan_Hašek"),
    "TUR": ("Vincenzo Montella",        "Vincenzo_Montella"),
    "BIH": ("Sergej Barbarez",          "Sergej_Barbarez"),
    "ALG": ("Vladimir Petković",        "Vladimir_Petković"),
    "CPV": ("Bubista",                  "Bubista_(football_manager)"),
    "NZL": ("Darren Bazeley",           "Darren_Bazeley"),
    "PAN": ("Thomas Christiansen",      "Thomas_Christiansen"),
    "CUW": ("Patrick Kluivert",         "Patrick_Kluivert"),
    "COD": ("Sébastien Desabre",        "Sébastien_Desabre"),
    "HAI": ("Marcelin Music",           None),
}

WIKI_API = "https://en.wikipedia.org/w/api.php"


def get_wiki_thumbnail(title: str) -> str | None:
    """Obtiene la URL del thumbnail de Wikipedia para un artículo."""
    if not title:
        return None
    try:
        params = {
            "action": "query",
            "titles": title,
            "prop": "pageimages",
            "format": "json",
            "pithumbsize": 300,
        }
        resp = requests.get(WIKI_API, params=params, timeout=10)
        resp.raise_for_status()
        pages = resp.json().get("query", {}).get("pages", {})
        for page in pages.values():
            thumb = page.get("thumbnail", {})
            if thumb.get("source"):
                return thumb["source"]
    except Exception as e:
        print(f"    Wiki error: {e}")
    return None


def main():
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASS
    )
    cur = conn.cursor()

    print(f"Procesando {len(DT_MAP)} selecciones...\n")
    ok = 0
    fail = 0

    for codigo, (dt_nombre, wiki_title) in DT_MAP.items():
        print(f"  {codigo}: {dt_nombre}... ", end="", flush=True)
        foto_url = get_wiki_thumbnail(wiki_title)
        if foto_url:
            print(f"OK (foto)")
        else:
            print("sin foto")

        cur.execute(
            "UPDATE pais SET dt_nombre = %s, dt_foto_url = %s WHERE codigo = %s",
            (dt_nombre, foto_url, codigo)
        )
        ok += 1
        time.sleep(0.3)  # Ser amable con Wikipedia

    conn.commit()
    cur.close()
    conn.close()
    print(f"\nListo: {ok} actualizados, {fail} sin dato.")


if __name__ == "__main__":
    main()
