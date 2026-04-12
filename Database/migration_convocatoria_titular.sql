-- Migración: agregar estado TITULAR al CHECK constraint de convocatoria_row
-- Fecha: 2026-04-12

ALTER TABLE convocatoria_row DROP CONSTRAINT IF EXISTS convocatoria_row_estado_check;
ALTER TABLE convocatoria_row ADD CONSTRAINT convocatoria_row_estado_check
    CHECK (estado IN ('PENDIENTE', 'CONVOCADO', 'NO_VA', 'TITULAR'));
