package com.mundial2026.dto.grupo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class UnirseGrupoRequest {

    @NotBlank(message = "El código de invitación es obligatorio")
    private String codigoInvitacion;

    @NotEmpty(message = "Debés seleccionar al menos un país")
    private List<Long> paisIds;
}
