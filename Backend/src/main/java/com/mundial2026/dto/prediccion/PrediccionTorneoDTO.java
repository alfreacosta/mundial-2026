package com.mundial2026.dto.prediccion;

import lombok.*;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PrediccionTorneoDTO {
    private Long internalId;

    // Campeón
    private Long paisCampeonId;
    private String paisCampeonNombre;
    private String paisCampeonCodigo;

    // Goleador
    private Long jugadorGoleadorId;
    private String jugadorGoleadorNombre;
    private String jugadorGoleadorPaisCodigo;
    private String jugadorGoleadorUrlFoto;

    private Boolean confirmada;
    private LocalDateTime transDate;
    private LocalDateTime fechaActualizacion;
}
