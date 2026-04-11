package com.mundial2026.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {

    private String token;
    private String tipo;        // Bearer
    private Long   userId;
    private String user;
    private String email;
    private String nombre;
    private String apellido;    private String  telefono;    private String urlAvatar;
    private Integer puntaje;
}
