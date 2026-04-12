-- Migración: Agregar columna rating a jugador
-- Extrae el rating del JSON de estadísticas para consulta directa y ordenamiento

ALTER TABLE jugador ADD COLUMN IF NOT EXISTS rating NUMERIC(4,2);

UPDATE jugador
SET rating = (stats_json->>'rating')::NUMERIC(4,2)
WHERE stats_json IS NOT NULL
  AND stats_json->>'rating' IS NOT NULL
  AND stats_json->>'rating' != ''
  AND stats_json->>'rating' ~ '^[0-9]+\.?[0-9]*$';

CREATE INDEX IF NOT EXISTS idx_jugador_rating ON jugador (rating DESC NULLS LAST);
