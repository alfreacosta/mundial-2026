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
public class GrupoRowDTO {

    private Long internalId;
    private Long grupoId;
    private Long usuarioId;
    private String usuarioNombre;
    private String usuarioApellido;
    private String urlAvatar;
    private String rol;

    private Long paisCampeonId;
    private String paisCampeonNombre;
    private String paisCampeonCodigo;

    private Long goleadorId;
    private String goleadorNombre;
    private String goleadorApellido;
    private String goleadorFoto;

    private LocalDateTime fechaUnion;
    private List<EquipoFavoritoDTO> equiposFavoritos;
    private Integer puntaje;
    private Boolean perfilPublico;
    private String user;
}
