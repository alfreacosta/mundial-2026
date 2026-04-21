-- =============================================================
-- MIGRACIÓN: Índices de performance para producción
-- Mundial 2026 - Aplicar en Railway (o cualquier PostgreSQL)
-- Fecha: 2025
-- =============================================================
-- Todos los CREATE INDEX usan IF NOT EXISTS para ser idempotentes.
-- Los índices trigram requieren la extensión pg_trgm (incluida en Railway).
-- =============================================================

-- ── Extensiones necesarias ────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ── Búsqueda de usuarios por nombre/apellido/username ─────────
-- Acelera: ILIKE '%texto%' en buscarPerfilesPublicos()
CREATE INDEX IF NOT EXISTS idx_usuario_nombre_trgm
    ON usuario USING gin(nombre gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_usuario_apellido_trgm
    ON usuario USING gin(apellido gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_usuario_username_trgm
    ON usuario USING gin(user_name gin_trgm_ops);

-- ── Búsqueda de jugadores (unaccent + lower + trigram) ────────
-- Acelera: búsqueda fuzzy de jugadores en SeleccionDetailComponent
-- unaccent() no es IMMUTABLE por defecto → se crea un wrapper inmutable
CREATE OR REPLACE FUNCTION unaccent_immutable(text)
    RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
    SET search_path = public
AS $$ SELECT public.unaccent($1) $$;

CREATE INDEX IF NOT EXISTS idx_jugador_nombre_completo_trgm
    ON jugador USING gin(unaccent_immutable(lower(nombre_completo)) gin_trgm_ops);

-- ── Lookup de convocatoria por usuario ───────────────────────
-- idx_convocatoria_usuario ya existe en schema.sql — incluido
-- para referencia, IF NOT EXISTS garantiza que no falle.
CREATE INDEX IF NOT EXISTS idx_convocatoria_usuario
    ON convocatoria(usuario_id);

-- ── Lookup de grupo por código de invitación ─────────────────
-- idx_grupo_codigo ya existe en schema.sql — incluido por idempotencia.
CREATE INDEX IF NOT EXISTS idx_grupo_codigo
    ON grupo(codigo_invitacion);

-- ── Predicciones por usuario ──────────────────────────────────
-- Acelera: findByUsuarioId, findByUsuario_User
CREATE INDEX IF NOT EXISTS idx_prediccion_torneo_usuario
    ON prediccion_torneo(usuario_id);

-- ── Partidos por fecha (rango temporal) ──────────────────────
-- Acelera: findByDateRange() y queries de fixture por día
CREATE INDEX IF NOT EXISTS idx_partido_trans_date
    ON partido(trans_date);

-- ── Jugador por país + posición (convocatoria) ───────────────
-- Acelera: findByPaisInternalId con ORDER BY posicion
CREATE INDEX IF NOT EXISTS idx_jugador_pais_posicion
    ON jugador(pais_id, posicion_id);

-- ── Reset token de contraseña ────────────────────────────────
-- Acelera: lookup por token en reset de password
CREATE INDEX IF NOT EXISTS idx_password_reset_token
    ON password_reset_token(token);
