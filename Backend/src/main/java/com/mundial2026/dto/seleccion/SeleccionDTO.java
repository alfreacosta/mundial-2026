package com.mundial2026.dto.seleccion;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SeleccionDTO {
    private Long id;
    private String nombre;
    private String codigo;
    private String grupo;
    private String confederacion;
    private String confederacionCodigo;

    // Estadísticas del Mundial
    private Integer pj;
    private Integer pg;
    private Integer pe;
    private Integer pp;
    private Integer pts;

    // Datos de API-Football
    private Long apiTeamId;
    private String logoUrl;         // https://media.api-sports.io/football/teams/{id}.png
    private String banderaUrl;      // https://media.api-sports.io/flags/{code}.svg

    // Venue/Estadio (del equipo)
    private Long apiVenueId;
    private String estadioNombre;
    private String estadioCiudad;
    private String estadioFotoUrl;  // https://media.api-sports.io/football/venues/{id}.png
    private Integer estadioCapacidad;

    // Plantel
    private List<JugadorSeleccionDTO> plantel;

    // DT
    private String dtNombre;
    private String dtFotoUrl;
}
