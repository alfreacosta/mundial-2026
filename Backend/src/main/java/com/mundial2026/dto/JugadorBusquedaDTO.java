package com.mundial2026.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JugadorBusquedaDTO {
    private Long internalId;
    private String nombre;
    private String apellido;
    private String nombreCompleto;
    private String posicionCodigo;
    private String paisNombre;
    private String paisCodigo;
    private String clubNombre;
    private String urlFoto;
}
