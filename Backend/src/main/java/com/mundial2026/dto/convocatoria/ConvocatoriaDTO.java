package com.mundial2026.dto.convocatoria;

import java.util.List;
import java.util.Map;

/**
 * DTO de respuesta para operaciones de Convocatoria en GraphQL.
 */
public class ConvocatoriaDTO {

    private int totalJugadores;
    private String estado;
    private List<Long> jugadoresIds;
    private List<Long> noVaIds;
    private List<Long> titularesIds;
    private List<PosicionTitularDTO> posicionesTitulares;

    public ConvocatoriaDTO() {}

    public ConvocatoriaDTO(int totalJugadores, String estado, List<Long> jugadoresIds, List<Long> noVaIds, List<Long> titularesIds, List<PosicionTitularDTO> posicionesTitulares) {
        this.totalJugadores = totalJugadores;
        this.estado = estado;
        this.jugadoresIds = jugadoresIds;
        this.noVaIds = noVaIds != null ? noVaIds : List.of();
        this.titularesIds = titularesIds != null ? titularesIds : List.of();
        this.posicionesTitulares = posicionesTitulares != null ? posicionesTitulares : List.of();
    }

    public int getTotalJugadores() { return totalJugadores; }
    public String getEstado()       { return estado; }
    public List<Long> getJugadoresIds() { return jugadoresIds; }
    public List<Long> getNoVaIds() { return noVaIds; }
    public List<Long> getTitularesIds() { return titularesIds; }
    public List<PosicionTitularDTO> getPosicionesTitulares() { return posicionesTitulares; }

    public static class PosicionTitularDTO {
        private Long jugadorId;
        private Double x;
        private Double y;

        public PosicionTitularDTO() {}
        public PosicionTitularDTO(Long jugadorId, Double x, Double y) {
            this.jugadorId = jugadorId;
            this.x = x;
            this.y = y;
        }

        public Long getJugadorId() { return jugadorId; }
        public Double getX() { return x; }
        public Double getY() { return y; }
    }
}
