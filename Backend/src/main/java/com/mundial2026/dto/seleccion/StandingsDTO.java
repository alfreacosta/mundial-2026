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
public class StandingsDTO {
    private String grupo;
    private List<StandingEntry> posiciones;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StandingEntry {
        private Integer posicion;
        private String equipoNombre;
        private String equipoCodigo;
        private Long apiTeamId;
        private String logoUrl;
        private Integer pj;
        private Integer pg;
        private Integer pe;
        private Integer pp;
        private Integer gf;
        private Integer gc;
        private Integer dg;
        private Integer pts;
        private String forma; // "WWDLW"
    }
}
