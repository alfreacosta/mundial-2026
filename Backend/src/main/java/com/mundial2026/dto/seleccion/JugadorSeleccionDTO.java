package com.mundial2026.dto.seleccion;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JugadorSeleccionDTO {
    private Long id;
    private String nombre;
    private String apellido;
    private String nombreCompleto;
    private Integer numeroCamiseta;
    private Integer edad;
    private String posicion;        // Goalkeeper, Defender, Midfielder, Attacker
    private String posicionCodigo;  // ARQ, DEF, MED, DEL
    private String fotoUrl;         // https://media.api-sports.io/football/players/{id}.png
    private Long apiPlayerId;

    // Club actual
    private String clubNombre;
    private String clubLogoUrl;

    private Integer partidosTemporada;
    private Boolean convocadoEliminatoria;
    private Double rating;
}
