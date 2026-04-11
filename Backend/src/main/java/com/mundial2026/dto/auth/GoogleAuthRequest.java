package com.mundial2026.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GoogleAuthRequest {
    @NotBlank(message = "El credential de Google es requerido")
    private String credential;
}
