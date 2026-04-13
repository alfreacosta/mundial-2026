-- ============================================
-- Migración: grupo_row_pais
-- Países seleccionados por un usuario para un grupo específico.
-- Reemplaza la lectura de equipo_favorito (global) al mostrar
-- los favoritos dentro de un grupo.
-- ============================================

CREATE TABLE grupo_row_pais (
    internal_id     BIGSERIAL       PRIMARY KEY,
    grupo_row_id    BIGINT          NOT NULL REFERENCES grupo_row(internal_id) ON DELETE CASCADE,
    pais_id         BIGINT          NOT NULL REFERENCES pais(internal_id) ON DELETE RESTRICT,
    orden           INTEGER         NOT NULL,
    CONSTRAINT uq_grp_row_pais UNIQUE (grupo_row_id, pais_id),
    CONSTRAINT uq_grp_row_orden UNIQUE (grupo_row_id, orden),
    CONSTRAINT chk_grp_row_orden CHECK (orden BETWEEN 1 AND 5)
);

CREATE INDEX idx_grupo_row_pais_row ON grupo_row_pais(grupo_row_id);

-- Migrar datos existentes: copiar favoritos globales de cada miembro actual
-- Respetando el cantidadPaises del grupo (tomar solo los N primeros)
INSERT INTO grupo_row_pais (grupo_row_id, pais_id, orden)
SELECT gr.internal_id, ef.pais_id, ef.orden
FROM grupo_row gr
JOIN grupo g ON g.internal_id = gr.master_id
JOIN equipo_favorito ef ON ef.usuario_id = gr.usuario_id
WHERE ef.orden <= g.cantidad_paises
ORDER BY gr.internal_id, ef.orden;
