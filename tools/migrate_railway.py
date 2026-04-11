#!/usr/bin/env python3
"""
Migración de Railway DB para el proyecto Mundial 2026.

Pasos:
1. Agrega columna partidos_temporada a jugador (si no existe)
2. Limpia jugadores inflados (que no están en convocatoria_row)
3. (Opcional) Re-lanza Fase 3 + Fase 4

Uso:
  python3 tools/migrate_railway.py            # solo migración + cleanup
  python3 tools/migrate_railway.py --sync     # + re-run Fase 3 y 4
"""
import subprocess, sys, os

# ── Credenciales Railway (desde variables de entorno) ─────
DB_HOST = os.environ.get("RAILWAY_DB_HOST", "maglev.proxy.rlwy.net")
DB_PORT = os.environ.get("RAILWAY_DB_PORT", "32738")
DB_NAME = os.environ.get("RAILWAY_DB_NAME", "railway")
DB_USER = os.environ.get("RAILWAY_DB_USER", "postgres")
DB_PASS = os.environ["RAILWAY_DB_PASS"]  # obligatorio, no hardcodear

env = dict(os.environ, PGPASSWORD=DB_PASS)

def psql(sql, ignore_error=False):
    r = subprocess.run(
        ['psql', '-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, '-d', DB_NAME,
         '-A', '-t', '-c', sql],
        capture_output=True, text=True, env=env
    )
    if r.returncode != 0 and not ignore_error:
        print("ERROR:", r.stderr)
        sys.exit(1)
    return r.stdout.strip(), r.stderr.strip()

def run(desc, sql, ignore_error=False):
    print(f"  {desc}...")
    out, err = psql(sql, ignore_error=ignore_error)
    if err and not ignore_error:
        print(f"    WARN: {err[:200]}")
    else:
        print(f"    OK: {out or 'done'}")
    return out

print("=== Migración Railway DB ===\n")

# Estado inicial
total_antes, _ = psql("SELECT COUNT(*) FROM jugador")
conv, _ = psql("SELECT COUNT(DISTINCT jugador_id) FROM convocatoria_row")
print(f"Estado inicial: {total_antes} jugadores, {conv} en convocatoria_row\n")

# Paso 1: Agregar columna partidos_temporada
run("Agregar columna partidos_temporada",
    "ALTER TABLE jugador ADD COLUMN IF NOT EXISTS partidos_temporada INTEGER DEFAULT NULL;")

# Paso 2: Borrar grupo_row problemáticos
run("Limpiar grupo_row (goleador_id inválido)",
    """DELETE FROM grupo_row
       WHERE goleador_id IS NOT NULL
         AND goleador_id NOT IN (SELECT DISTINCT jugador_id FROM convocatoria_row)""",
    ignore_error=True)

# Paso 3: Nullify o borrar prediccion_torneo
out1, err1 = psql("""UPDATE prediccion_torneo SET jugador_goleador_id = NULL
                     WHERE jugador_goleador_id IS NOT NULL
                       AND jugador_goleador_id NOT IN (SELECT DISTINCT jugador_id FROM convocatoria_row)""",
                  ignore_error=True)
if err1 and "not-null" in err1:
    run("Borrar prediccion_torneo (NOT NULL constraint)",
        """DELETE FROM prediccion_torneo
           WHERE jugador_goleador_id IS NOT NULL
             AND jugador_goleador_id NOT IN (SELECT DISTINCT jugador_id FROM convocatoria_row)""",
        ignore_error=True)
else:
    print(f"  Nullify prediccion_torneo: {out1 or 'done'}")

# Paso 4: Limpiar alineacion_row
run("Limpiar alineacion_row",
    "DELETE FROM alineacion_row WHERE jugador_id NOT IN (SELECT DISTINCT jugador_id FROM convocatoria_row)",
    ignore_error=True)

# Paso 5: Borrar jugadores inflados
run("Borrar jugadores inflados (no en convocatoria_row)",
    "DELETE FROM jugador WHERE internal_id NOT IN (SELECT DISTINCT jugador_id FROM convocatoria_row)")

# Resultado
total_despues, _ = psql("SELECT COUNT(*) FROM jugador")
print(f"\nResultado: {total_antes} → {total_despues} jugadores")

# Opcional: re-sync
if "--sync" in sys.argv:
    print("\n=== Iniciando sync contra Railway DB ===")
    sync_env = dict(os.environ,
        DB_HOST=DB_HOST, DB_PORT=DB_PORT,
        DB_NAME=DB_NAME, DB_USER=DB_USER, DB_PASS=DB_PASS
    )
    print("  Ejecutando Fase 3...")
    r3 = subprocess.run(
        ['python3', '-u', 'tools/sync_wc2026.py', '--fase', '3'],
        env=sync_env, cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    print(f"  Fase 3 exit: {r3.returncode}")

    print("  Ejecutando Fase 4...")
    r4 = subprocess.run(
        ['python3', '-u', 'tools/sync_wc2026.py', '--fase', '4'],
        env=sync_env, cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    print(f"  Fase 4 exit: {r4.returncode}")

print("\n=== Migración completada ===")
