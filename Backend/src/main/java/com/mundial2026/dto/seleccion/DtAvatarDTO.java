package com.mundial2026.dto.seleccion;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DtAvatarDTO {
    private String codigo;
    private String pais;
    private String dtNombre;
    private String dtFotoUrl;
    private String logoUrl;
}
