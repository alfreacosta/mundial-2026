-- ============================================================
-- AUTO-ALINEACIÓN: Crear alineaciones a partir de titulares
-- cuando un partido cambia a EN_CURSO
-- ============================================================
-- NOTA: Esta función se ejecuta automáticamente desde Spring Boot
-- cada 60 segundos (@Scheduled en AlineacionAutoService.java).
-- Se incluye aquí como documentación SQL de referencia.
-- ============================================================

-- Función que crea alineaciones automáticas
-- Se llama cuando un partido pasa de PENDIENTE → EN_CURSO
CREATE OR REPLACE FUNCTION fn_auto_alineacion_para_partido(p_partido_id BIGINT)
RETURNS void AS $$
DECLARE
    v_local_id  BIGINT;
    v_visit_id  BIGINT;
    rec         RECORD;
    v_alin_id   BIGINT;
    v_count     INTEGER;
BEGIN
    -- Obtener los equipos del partido
    SELECT equipo_local_id, equipo_visitante_id
    INTO v_local_id, v_visit_id
    FROM partido
    WHERE internal_id = p_partido_id;

    -- Procesar ambos equipos
    FOR rec IN
        -- Para cada usuario que tenga uno de los equipos como favorito
        -- Y tenga titulares configurados en su convocatoria para ese equipo
        SELECT DISTINCT
            ef.usuario_id,
            ef.pais_id,
            c.internal_id AS convocatoria_id
        FROM equipo_favorito ef
        JOIN convocatoria c ON c.usuario_id = ef.usuario_id AND c.pais_id = ef.pais_id
        WHERE ef.pais_id IN (v_local_id, v_visit_id)
          -- Verificar que tiene al menos 1 titular
          AND EXISTS (
              SELECT 1 FROM convocatoria_row cr
              WHERE cr.master_id = c.internal_id AND cr.estado = 'TITULAR'
          )
          -- No crear duplicados
          AND NOT EXISTS (
              SELECT 1 FROM alineacion a
              WHERE a.usuario_id = ef.usuario_id
                AND a.partido_id = p_partido_id
                AND a.pais_id = ef.pais_id
          )
    LOOP
        -- Crear cabecera de alineación
        INSERT INTO alineacion (usuario_id, partido_id, pais_id, trans_date, confirmada, total_jugadores_convocados)
        SELECT rec.usuario_id, p_partido_id, rec.pais_id, CURRENT_TIMESTAMP, TRUE,
               (SELECT COUNT(*) FROM convocatoria_row WHERE master_id = rec.convocatoria_id AND estado = 'TITULAR')
        RETURNING internal_id INTO v_alin_id;

        -- Crear filas de alineación desde los titulares de la convocatoria
        INSERT INTO alineacion_row (master_id, jugador_id, estado)
        SELECT v_alin_id, cr.jugador_id, 'TITULAR'
        FROM convocatoria_row cr
        WHERE cr.master_id = rec.convocatoria_id
          AND cr.estado = 'TITULAR';

        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Auto-alineación creada: usuario=%, pais=%, partido=%, titulares=%',
            rec.usuario_id, rec.pais_id, p_partido_id, v_count;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- EJEMPLO DE USO MANUAL (para testing):
-- ============================================================
-- SELECT fn_auto_alineacion_para_partido(42);  -- partido_id = 42
--
-- O para procesar todos los partidos que deben iniciar:
-- SELECT fn_auto_alineacion_para_partido(p.internal_id)
-- FROM partido p
-- WHERE p.estado = 'PENDIENTE'
--   AND p.trans_date <= CURRENT_TIMESTAMP + INTERVAL '1 minute'
--   AND p.trans_date >= CURRENT_TIMESTAMP - INTERVAL '1 minute';
-- ============================================================
