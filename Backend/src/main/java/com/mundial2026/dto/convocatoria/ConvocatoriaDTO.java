package com.mundial2026.dto.convocatoria;

import java.util.List;

/**
 * DTO de respuesta para operaciones de Convocatoria en GraphQL.
 */
public class ConvocatoriaDTO {

    private int totalJugadores;
    private String estado;
    private List<Long> jugadoresIds;
    private List<Long> noVaIds;
    private List<Long> titularesIds;

    public ConvocatoriaDTO() {}

    public ConvocatoriaDTO(int totalJugadores, String estado, List<Long> jugadoresIds, List<Long> noVaIds, List<Long> titularesIds) {
        this.totalJugadores = totalJugadores;
        this.estado = estado;
        this.jugadoresIds = jugadoresIds;
        this.noVaIds = noVaIds != null ? noVaIds : List.of();
        this.titularesIds = titularesIds != null ? titularesIds : List.of();
    }

    public int getTotalJugadores() { return totalJugadores; }
    public String getEstado()       { return estado; }
    public List<Long> getJugadoresIds() { return jugadoresIds; }
    public List<Long> getNoVaIds() { return noVaIds; }
    public List<Long> getTitularesIds() { return titularesIds; }
}
