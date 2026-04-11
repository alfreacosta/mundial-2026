package com.mundial2026.dto.grupo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CrearGrupoRequest {

    @NotBlank(message = "El nombre del grupo es obligatorio")
    @Size(max = 100, message = "El nombre no puede superar los 100 caracteres")
    private String nombre;

    @Size(max = 255, message = "El premio no puede superar los 255 caracteres")
    private String premio;
}
