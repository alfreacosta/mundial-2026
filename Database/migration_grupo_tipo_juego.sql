-- Migración: agregar tipo_juego a la tabla grupo
-- A = Convocatoria + Predicciones (default para grupos existentes)
-- B = Solo Convocatoria
-- C = Solo Predicciones

ALTER TABLE grupo
    ADD COLUMN IF NOT EXISTS tipo_juego VARCHAR(1) NOT NULL DEFAULT 'A';

-- Todos los grupos existentes quedan como tipo A
UPDATE grupo SET tipo_juego = 'A' WHERE tipo_juego IS NULL OR tipo_juego = '';
