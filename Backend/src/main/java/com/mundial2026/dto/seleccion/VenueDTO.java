package com.mundial2026.dto.seleccion;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VenueDTO {
    private Long apiVenueId;
    private String nombre;
    private String ciudad;
    private String pais;
    private Integer capacidad;
    private String superficie;
    private String fotoUrl;   // https://media.api-sports.io/football/venues/{id}.png
}
