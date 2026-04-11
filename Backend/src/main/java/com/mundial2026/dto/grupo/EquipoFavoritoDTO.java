package com.mundial2026.dto.grupo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EquipoFavoritoDTO {

    private Long internalId;
    private Long paisId;
    private String paisNombre;
    private String paisCodigo;
    private Integer orden;
    private LocalDateTime transDate;
}
