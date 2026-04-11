package com.mundial2026.dto.prediccion;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record GuardarPrediccionPartidoRequest(
        @NotNull(message = "golLocal es obligatorio")
        @Min(value = 0, message = "golLocal no puede ser negativo")
        Integer golLocal,

        @NotNull(message = "golVisitante es obligatorio")
        @Min(value = 0, message = "golVisitante no puede ser negativo")
        Integer golVisitante
) {}
