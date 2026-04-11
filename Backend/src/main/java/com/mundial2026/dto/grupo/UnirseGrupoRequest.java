package com.mundial2026.dto.grupo;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UnirseGrupoRequest {

    @NotBlank(message = "El código de invitación es obligatorio")
    private String codigoInvitacion;
}
