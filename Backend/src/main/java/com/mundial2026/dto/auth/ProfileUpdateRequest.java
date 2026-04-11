package com.mundial2026.dto.auth;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ProfileUpdateRequest {
    @Size(max = 100) private String nombre;
    @Size(max = 100) private String apellido;
    @Size(max = 30)  private String telefono;
    @Size(max = 255) private String urlAvatar;
}
