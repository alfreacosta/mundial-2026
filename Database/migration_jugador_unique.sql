-- ============================================================
-- MIGRACIÓN: Unicidad de api_player_id en jugador
-- Previene duplicados cuando el mismo jugador aparece en
-- múltiples ligas (ej: Bundesliga + Champions League)
-- ============================================================

-- 1. Eliminar duplicados ya existentes (si los hay),
--    conservando el registro con internal_id más bajo
DELETE FROM jugador
WHERE internal_id NOT IN (
    SELECT MIN(internal_id)
    FROM jugador
    GROUP BY api_player_id
)
AND api_player_id IS NOT NULL;

-- 2. Agregar constraint UNIQUE
ALTER TABLE jugador
    ADD CONSTRAINT uq_jugador_api_player_id UNIQUE (api_player_id);

-- 3. Agregar índice para búsquedas rápidas por api_player_id
CREATE INDEX IF NOT EXISTS idx_jugador_api_player ON jugador(api_player_id);

-- Verificar
SELECT 'Jugadores en BD: ' || COUNT(*) FROM jugador
UNION ALL
SELECT 'Con api_player_id: ' || COUNT(*) FROM jugador WHERE api_player_id IS NOT NULL
UNION ALL
SELECT 'Sin api_player_id: ' || COUNT(*) FROM jugador WHERE api_player_id IS NULL;
