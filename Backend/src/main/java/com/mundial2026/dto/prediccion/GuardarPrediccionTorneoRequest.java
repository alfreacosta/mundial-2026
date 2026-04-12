package com.mundial2026.dto.prediccion;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GuardarPrediccionTorneoRequest {

    private Long paisCampeonId;

    private Long jugadorGoleadorId;
}
