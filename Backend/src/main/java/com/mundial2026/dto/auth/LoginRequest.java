package com.mundial2026.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {

    /** Puede ser el nombre de usuario O el email */
    @NotBlank(message = "El usuario o email es obligatorio")
    private String identifier;

    @NotBlank(message = "La contraseña es obligatoria")
    private String password;
}
