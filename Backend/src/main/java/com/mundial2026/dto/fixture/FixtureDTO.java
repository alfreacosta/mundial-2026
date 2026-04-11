package com.mundial2026.dto.fixture;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;

import java.time.LocalDateTime;

/**
 * DTO para representar un partido/fixture del Mundial 2026
 * Usado tanto para respuestas REST como para datos de API externa
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FixtureDTO {

    private Long id;

    // Equipos
    private String equipoLocalNombre;
    private String equipoLocalCodigo;
    private String equipoVisitanteNombre;
    private String equipoVisitanteCodigo;

    // Fase
    private String faseNombre;
    private String faseCodigo;
    private String grupo;

    // Resultado
    private Integer golLocal;
    private Integer golVisitante;

    // Info del partido
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss", timezone = "America/Asuncion")
    private LocalDateTime fechaHora;

    private String estadio;
    private String ciudad;
    private String estado; // PENDIENTE, EN_CURSO, FINALIZADO

    // Metadata
    private Integer minuto;       // Minuto actual si está en curso
    private Long apiExternalId;   // ID de la API externa (API-Football)
    private String tipoPartido;   // AMISTOSO, MUNDIAL
}
