#!/usr/bin/env python3
"""
heygen_generate.py
==================
Genera un video tutorial de DT26 usando la API de HeyGen v2.

Modos de uso:
  # Video estático con el guion fijo
  python3 tools/heygen_generate.py

  # Personalizado para un usuario leyendo desde JSONL
  python3 tools/heygen_generate.py --jsonl tools/usuarios.jsonl --index 0

  # Solo verificar el estado de un video ya generado
  python3 tools/heygen_generate.py --status <video_id>

Requiere (en tools/.env):
  HEYGEN_API_KEY=tu_api_key
  HEYGEN_AVATAR_ID=tu_avatar_id
  HEYGEN_VOICE_ID=tu_voice_id
"""

import os
import sys
import json
import time
import argparse
import requests
from pathlib import Path
from dotenv import load_dotenv

# ──────────────────────────────────────────────
# CONFIGURACIÓN
# ──────────────────────────────────────────────
load_dotenv(Path(__file__).parent / ".env")

HEYGEN_API_KEY  = os.environ.get("HEYGEN_API_KEY", "")
AVATAR_ID       = os.environ.get("HEYGEN_AVATAR_ID", "")   # ej: "Angela-inblackskirt-20220820"
VOICE_ID        = os.environ.get("HEYGEN_VOICE_ID", "")    # ej: "es-MX-DaliaNeural"

BASE_URL        = "https://api.heygen.com"
VIDEO_GENERATE  = f"{BASE_URL}/v2/video/generate"
VIDEO_STATUS    = f"{BASE_URL}/v1/video_status.get"

POLL_INTERVAL   = 15   # segundos entre cada chequeo de estado
MAX_WAIT        = 600  # espera máxima total en segundos (10 min)

# ──────────────────────────────────────────────
# GUION BASE — DT26.win (5 escenas)
# ──────────────────────────────────────────────
# Cada escena = un "clip" en HeyGen (avatar habla este texto)
# {username} y {seleccion} son variables dinámicas opcionales
BASE_SCENES = [
    {
        "id": "intro",
        "narration": (
            "El Mundial 2026 ya está encima. 48 selecciones, 104 partidos, "
            "y una sola pregunta: ¿Sos capaz de predecir lo que va a pasar? "
            "DT26 es la plataforma donde demostrás que sabés más que el DT. "
            "Predicciones reales, jugadores reales, y tus amigos mirando quién la tiene más clara."
        ),
    },
    {
        "id": "onboarding",
        "narration": (
            "Empezar es tan fácil como un pase corto. "
            "Entrás a dt26.win, hacés clic en Registrarse, "
            "y en menos de 30 segundos ya tenés tu cuenta. "
            "Google Sign-In, si querés ni escribís nada. "
            "Listo. Ahora sí, ponete la 10."
        ),
    },
    {
        "id": "core_loop",
        "narration": (
            "Lo primero que hacés es elegir tus selecciones favoritas. "
            "¿Paraguay va a la siguiente ronda? ¿Argentina defiende el título? Declaralo acá. "
            "Cada selección tiene su página: jugadores reales, estadio, estadísticas. Nada inventado. "
            "Y después venís al fixture. 104 partidos, todos con hora local. "
            "Entrás, ponés el marcador que creés, y guardás. Así de rápido. "
            "No te quedés en offside."
        ),
    },
    {
        "id": "funciones_pro",
        "narration": (
            "Ahora la jugada maestra: armá tu convocatoria. "
            "Elegís tus 26 jugadores de entre el plantel real, "
            "sincronizado directo desde la API oficial. "
            "No hay jugadores inventados, son los mismos que están compitiendo hoy. "
            "Una vez que tenés tu lista, pasás a la táctica. "
            "Arrastrás tus 11 titulares y los ubicás en la cancha. "
            "¿4-3-3? ¿5-4-1? Vos mandás. Eso es ser DT. "
            "Y cuando guardás, tu convocatoria queda pública. "
            "Tus amigos la pueden ver. El debate empieza solo."
        ),
    },
    {
        "id": "cierre_cta",
        "narration": (
            "El Mundial ya arrancó. Cada día que pasás sin predecir "
            "es un partido que ya no podés recuperar. "
            "Entrá ahora a dt26.win, creá tu cuenta, y armá tu táctica. "
            "Esto no es suerte. Es análisis. "
            "¿Estás listo para demostrar que la tenés clara?"
        ),
    },
]


# ──────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────

def get_headers() -> dict:
    if not HEYGEN_API_KEY:
        print("[ERROR] HEYGEN_API_KEY no está configurada en tools/.env")
        sys.exit(1)
    return {
        "X-Api-Key": HEYGEN_API_KEY,
        "Content-Type": "application/json",
    }


def load_user_from_jsonl(path: str, index: int) -> dict:
    """Lee el usuario en la línea `index` de un archivo JSONL."""
    lines = Path(path).read_text(encoding="utf-8").strip().splitlines()
    if index >= len(lines):
        print(f"[ERROR] El JSONL tiene {len(lines)} líneas, índice {index} inválido.")
        sys.exit(1)
    return json.loads(lines[index])


def personalize_scenes(scenes: list[dict], variables: dict) -> list[dict]:
    """
    Sustituye {username}, {seleccion}, etc. en la narración de cada escena.

    Ejemplo de variables esperadas en el JSONL:
    {
        "username": "roque93",
        "seleccion": "Paraguay",
        "email": "roque@ejemplo.com"
    }
    """
    personalized = []
    for scene in scenes:
        personalized.append({
            **scene,
            "narration": scene["narration"].format_map(
                # format_map con un default seguro: si la clave no existe, la deja literal
                _SafeDict(variables)
            ),
        })
    return personalized


class _SafeDict(dict):
    """dict que no explota si falta una clave — la deja como {clave}."""
    def __missing__(self, key):
        return f"{{{key}}}"


def build_payload(scenes: list[dict], webhook_url: str = "") -> dict:
    """
    Construye el payload para POST /v2/video/generate.

    Estructura HeyGen v2:
    - video_inputs: lista de clips (uno por escena)
    - Cada clip tiene character (avatar), voice, y background
    - callback_id: opcional, para webhook
    """
    if not AVATAR_ID or not VOICE_ID:
        print("[ERROR] HEYGEN_AVATAR_ID o HEYGEN_VOICE_ID no están en tools/.env")
        sys.exit(1)

    clips = []
    for scene in scenes:
        clips.append({
            "character": {
                "type": "avatar",
                "avatar_id": AVATAR_ID,
                "avatar_style": "normal",
            },
            "voice": {
                "type": "text",
                "input_text": scene["narration"],
                "voice_id": VOICE_ID,
                "speed": 1.0,
            },
            "background": {
                "type": "color",
                "value": "#1a1a2e",  # azul oscuro — cambiá si querés otro fondo
            },
        })

    payload = {
        "video_inputs": clips,
        "dimension": {
            "width": 1920,
            "height": 1080,
        },
        "aspect_ratio": "16:9",
        "test": False,  # True = watermark gratis; False = producción (consume créditos)
    }

    if webhook_url:
        payload["callback_url"] = webhook_url

    return payload


def generate_video(payload: dict) -> str:
    """Envía el payload a HeyGen y retorna el video_id."""
    print("[→] Enviando solicitud a HeyGen...")
    resp = requests.post(VIDEO_GENERATE, headers=get_headers(), json=payload, timeout=30)

    if resp.status_code != 200:
        print(f"[ERROR] HTTP {resp.status_code}: {resp.text}")
        sys.exit(1)

    data = resp.json()

    # HeyGen v2 retorna: { "data": { "video_id": "..." }, "error": null }
    if data.get("error"):
        print(f"[ERROR] HeyGen API: {data['error']}")
        sys.exit(1)

    video_id = data["data"]["video_id"]
    print(f"[✓] Video en cola. video_id = {video_id}")
    return video_id


def poll_status(video_id: str) -> str:
    """
    Consulta el estado del video cada POLL_INTERVAL segundos.
    Retorna la URL del .mp4 cuando esté listo.

    Estados posibles: pending | processing | completed | failed
    """
    print(f"[…] Esperando renderizado (máx {MAX_WAIT}s)...")
    elapsed = 0

    while elapsed < MAX_WAIT:
        time.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL

        resp = requests.get(
            VIDEO_STATUS,
            headers=get_headers(),
            params={"video_id": video_id},
            timeout=15,
        )

        if resp.status_code != 200:
            print(f"[WARN] HTTP {resp.status_code} al consultar estado — reintentando...")
            continue

        data = resp.json().get("data", {})
        status = data.get("status", "unknown")
        print(f"  [{elapsed}s] Estado: {status}")

        if status == "completed":
            video_url = data.get("video_url", "")
            print(f"\n[✓] Video listo: {video_url}")
            return video_url

        if status == "failed":
            print(f"[ERROR] HeyGen falló al renderizar: {data.get('error')}")
            sys.exit(1)

    print("[TIMEOUT] El video tardó demasiado. Verificá manualmente con --status")
    sys.exit(1)


def download_video(url: str, output_path: str = "output/dt26_tutorial.mp4"):
    """Descarga el .mp4 a disco."""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    print(f"[→] Descargando video → {output_path}")

    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(output_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

    size_mb = Path(output_path).stat().st_size / (1024 * 1024)
    print(f"[✓] Descargado: {output_path} ({size_mb:.1f} MB)")


# ──────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="Genera video DT26 con HeyGen API")
    p.add_argument("--jsonl",   help="Ruta al archivo JSONL con datos de usuarios")
    p.add_argument("--index",   type=int, default=0, help="Índice del usuario en el JSONL (default: 0)")
    p.add_argument("--status",  help="Consultar estado de un video_id existente (no genera nuevo)")
    p.add_argument("--webhook", default="", help="URL pública del webhook para recibir el .mp4")
    p.add_argument("--no-download", action="store_true", help="No descargar el .mp4, solo imprimir la URL")
    p.add_argument("--test",    action="store_true", help="Usar test=True en HeyGen (watermark, no gasta créditos)")
    p.add_argument("--output",  default="output/dt26_tutorial.mp4", help="Ruta de salida del .mp4")
    return p.parse_args()


def main():
    args = parse_args()

    # Modo: solo consultar estado de video existente
    if args.status:
        url = poll_status(args.status)
        if not args.no_download:
            download_video(url, args.output)
        return

    # Construir escenas (personalizadas si se pasa JSONL)
    scenes = BASE_SCENES
    if args.jsonl:
        user = load_user_from_jsonl(args.jsonl, args.index)
        print(f"[→] Personalizando para usuario: {user.get('username', '?')}")
        scenes = personalize_scenes(BASE_SCENES, user)

    # Imprimir narración que se enviará
    print("\n─── NARRACIÓN A ENVIAR ───")
    for s in scenes:
        print(f"\n[{s['id']}]\n{s['narration'][:120]}...")
    print("──────────────────────────\n")

    # Construir payload
    payload = build_payload(scenes, webhook_url=args.webhook)
    if args.test:
        payload["test"] = True
        print("[INFO] Modo TEST activado — el video tendrá watermark y no consume créditos.")

    # Generar + esperar + descargar
    video_id = generate_video(payload)

    if args.webhook:
        print(f"[INFO] Webhook configurado en: {args.webhook}")
        print("[INFO] HeyGen enviará POST a esa URL cuando el video esté listo.")
        print(f"[INFO] Guardá el video_id para referencia: {video_id}")
        return

    video_url = poll_status(video_id)

    if not args.no_download:
        download_video(video_url, args.output)
    else:
        print(f"[URL] {video_url}")


if __name__ == "__main__":
    main()
