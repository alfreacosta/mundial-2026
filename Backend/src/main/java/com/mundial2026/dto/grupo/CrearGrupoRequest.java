package com.mundial2026.dto.grupo;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.util.List;

@Data
public class CrearGrupoRequest {

    @NotBlank(message = "El nombre del grupo es obligatorio")
    @Size(max = 100, message = "El nombre no puede superar los 100 caracteres")
    private String nombre;

    @Size(max = 255, message = "El premio no puede superar los 255 caracteres")
    private String premio;

    @Min(value = 1, message = "La cantidad mínima de países es 1")
    @Max(value = 5, message = "La cantidad máxima de países es 5")
    private Integer cantidadPaises;

    @NotEmpty(message = "Debés seleccionar al menos un país")
    private List<Long> paisIds;
}
