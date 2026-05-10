#!/usr/bin/env python3
"""
heygen_webhook.py
=================
Servidor Flask mínimo que recibe el webhook de HeyGen cuando el video
termina de renderizar.

HeyGen hace POST a tu URL con este body:
{
    "event_type": "avatar_video.success",
    "event_data": {
        "video_id": "abc123",
        "url": "https://files.heygen.com/..../video.mp4",
        "duration": 118.5
    }
}

En caso de fallo:
{
    "event_type": "avatar_video.fail",
    "event_data": {
        "video_id": "abc123",
        "msg": "Rendering failed"
    }
}

Uso:
    pip install flask requests
    python3 tools/heygen_webhook.py

Para exponer localmente con ngrok (desarrollo):
    ngrok http 5050
    → Copiá la URL pública y pasala a --webhook en heygen_generate.py

En producción: desplegá esto como endpoint en tu servidor Railway o Fly.io.
"""

import os
import json
import hmac
import hashlib
import requests
from pathlib import Path
from datetime import datetime
from flask import Flask, request, jsonify
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

app = Flask(__name__)

# ──────────────────────────────────────────────
# CONFIGURACIÓN
# ──────────────────────────────────────────────
WEBHOOK_SECRET  = os.environ.get("HEYGEN_WEBHOOK_SECRET", "")   # opcional pero recomendado
DOWNLOAD_DIR    = Path(os.environ.get("HEYGEN_DOWNLOAD_DIR", "output/videos"))
PORT            = int(os.environ.get("WEBHOOK_PORT", 5050))

DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

LOG_FILE = Path("output/heygen_events.jsonl")


# ──────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────

def verify_signature(payload_bytes: bytes, signature_header: str) -> bool:
    """
    HeyGen firma el body con HMAC-SHA256 si configuraste un secret.
    Cabecera: X-HeyGen-Signature: sha256=<hex_digest>
    """
    if not WEBHOOK_SECRET:
        return True  # Sin secret, no verificamos (solo para dev)

    if not signature_header or not signature_header.startswith("sha256="):
        return False

    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()

    received = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, received)


def log_event(event: dict):
    """Guarda cada evento recibido en un JSONL para auditoría."""
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps({**event, "_received_at": datetime.utcnow().isoformat()}) + "\n")


def download_video(video_id: str, url: str) -> Path:
    """Descarga el .mp4 del CDN de HeyGen a disco local."""
    output_path = DOWNLOAD_DIR / f"{video_id}.mp4"

    print(f"[→] Descargando {video_id}.mp4 desde HeyGen...")
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(output_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"[✓] Guardado: {output_path} ({size_mb:.1f} MB)")
    return output_path


# ──────────────────────────────────────────────
# ENDPOINT WEBHOOK
# ──────────────────────────────────────────────

@app.route("/webhook/heygen", methods=["POST"])
def heygen_webhook():
    raw_body = request.get_data()

    # Verificar firma si está configurada
    sig = request.headers.get("X-HeyGen-Signature", "")
    if not verify_signature(raw_body, sig):
        print("[WARN] Firma inválida — request rechazada")
        return jsonify({"error": "invalid signature"}), 401

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        return jsonify({"error": "invalid json"}), 400

    log_event(payload)

    event_type = payload.get("event_type", "")
    event_data = payload.get("event_data", {})
    video_id   = event_data.get("video_id", "unknown")

    print(f"\n[WEBHOOK] Evento: {event_type} | video_id: {video_id}")

    if event_type == "avatar_video.success":
        video_url = event_data.get("url", "")
        duration  = event_data.get("duration", 0)
        print(f"[✓] Video listo. Duración: {duration:.1f}s | URL: {video_url}")

        # Descarga automática al servidor
        try:
            saved_path = download_video(video_id, video_url)
            print(f"[✓] Guardado en: {saved_path}")
            # Acá podés agregar: notificar a tu BD, mandar email, etc.
        except Exception as e:
            print(f"[ERROR] No se pudo descargar: {e}")

        return jsonify({"status": "ok", "video_id": video_id}), 200

    if event_type == "avatar_video.fail":
        msg = event_data.get("msg", "sin detalle")
        print(f"[ERROR] Render fallido para {video_id}: {msg}")
        return jsonify({"status": "noted", "video_id": video_id}), 200

    # Evento desconocido — lo logueamos y respondemos 200 igual
    print(f"[INFO] Evento no manejado: {event_type}")
    return jsonify({"status": "ignored"}), 200


@app.route("/webhook/heygen/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "heygen-webhook"}), 200


# ──────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────

if __name__ == "__main__":
    print(f"[→] Webhook escuchando en http://0.0.0.0:{PORT}/webhook/heygen")
    print(f"[→] Videos se guardan en: {DOWNLOAD_DIR.resolve()}")
    if not WEBHOOK_SECRET:
        print("[WARN] HEYGEN_WEBHOOK_SECRET no configurado — firma no verificada (ok para dev)")
    app.run(host="0.0.0.0", port=PORT, debug=False)
