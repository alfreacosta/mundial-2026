package com.mundial2026.dto.prediccion;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;

/**
 * DTO de respuesta con la predicción de un partido más el contexto del partido.
 */
public record PrediccionPartidoDTO(
        Long   internalId,       // null si aún no predijo

        Long   partidoId,
        String equipoLocalNombre,
        String equipoLocalCodigo,
        String equipoVisitanteNombre,
        String equipoVisitanteCodigo,

        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss", timezone = "America/Asuncion")
        LocalDateTime fechaHora,

        String estadio,
        String faseCodigo,
        String faseNombre,
        String grupo,            // A–L (solo fase de grupos)
        String estadoPartido,    // PENDIENTE | EN_CURSO | FINALIZADO

        Integer golLocalReal,
        Integer golVisitanteReal,

        // Predicción del usuario
        Integer golLocalPred,
        Integer golVisitantePred,
        Boolean bloqueada,
        Integer puntajeObtenido
) {}
