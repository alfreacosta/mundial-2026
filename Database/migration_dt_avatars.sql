-- Migración: agregar columnas DT a la tabla pais
ALTER TABLE pais ADD COLUMN IF NOT EXISTS dt_nombre VARCHAR(150);
ALTER TABLE pais ADD COLUMN IF NOT EXISTS dt_foto_url VARCHAR(500);
