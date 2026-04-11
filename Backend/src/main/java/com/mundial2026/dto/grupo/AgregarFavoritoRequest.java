package com.mundial2026.dto.grupo;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AgregarFavoritoRequest {

    @NotNull(message = "El país favorito es obligatorio")
    private Long paisId;

    @NotNull(message = "El orden es obligatorio")
    @Min(value = 1, message = "El orden mínimo es 1")
    @Max(value = 5, message = "El orden máximo es 5")
    private Integer orden;
}
