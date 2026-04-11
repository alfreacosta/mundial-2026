package com.mundial2026.dto.fixture;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Request para actualizar el resultado real de un partido.
 * Requiere X-Sync-Key de administrador.
 */
public record ActualizarResultadoRequest(
        @NotNull(message = "golLocal es obligatorio")
        @Min(value = 0, message = "golLocal no puede ser negativo")
        Integer golLocal,

        @NotNull(message = "golVisitante es obligatorio")
        @Min(value = 0, message = "golVisitante no puede ser negativo")
        Integer golVisitante
) {}
