-- Migración: posiciones X/Y para titulares en la cancha
-- Ejecutar en Railway también
ALTER TABLE convocatoria_row
  ADD COLUMN IF NOT EXISTS posicion_x DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS posicion_y DOUBLE PRECISION;
