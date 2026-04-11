package com.mundial2026.dto.prediccion;

import jakarta.validation.constraints.NotNull;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GuardarPrediccionTorneoRequest {

    @NotNull(message = "Debe seleccionar un país campeón")
    private Long paisCampeonId;

    @NotNull(message = "Debe seleccionar un jugador goleador")
    private Long jugadorGoleadorId;
}
