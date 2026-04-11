package com.mundial2026.dto.grupo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GrupoDTO {

    private Long internalId;
    private Integer numero;
    private String nombre;
    private String premio;
    private String codigoInvitacion;
    private Long creadorId;
    private String creadorNombre;
    private LocalDateTime transDate;
    private Boolean activo;
    private Integer cantidadMiembros;
    private List<GrupoRowDTO> miembros;
}
