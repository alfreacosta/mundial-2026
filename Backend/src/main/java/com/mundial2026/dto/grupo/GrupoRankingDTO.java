package com.mundial2026.dto.grupo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class GrupoRankingDTO {
    private Long internalId;
    private String nombre;
    private String creadorNombre;
    private Integer cantidadMiembros;
    private Long puntajeTotal;
}
