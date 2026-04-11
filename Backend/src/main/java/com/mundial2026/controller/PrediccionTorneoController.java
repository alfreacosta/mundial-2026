package com.mundial2026.controller;

import com.mundial2026.dto.prediccion.GuardarPrediccionTorneoRequest;
import com.mundial2026.dto.prediccion.PrediccionTorneoDTO;
import com.mundial2026.service.PrediccionTorneoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * Controller REST para Predicción de Torneo.
 * El usuario predice: país campeón + jugador goleador.
 */
@RestController
@RequestMapping("/api/prediccion-torneo")
@RequiredArgsConstructor
public class PrediccionTorneoController {

    private final PrediccionTorneoService prediccionTorneoService;

    /** Obtener mi predicción de torneo (o null si no existe) */
    @GetMapping
    public ResponseEntity<PrediccionTorneoDTO> getMiPrediccion(
            @AuthenticationPrincipal UserDetails userDetails) {
        PrediccionTorneoDTO dto = prediccionTorneoService.getMiPrediccion(userDetails.getUsername());
        return ResponseEntity.ok(dto);
    }

    /** Guardar o actualizar predicción de torneo */
    @PostMapping
    public ResponseEntity<PrediccionTorneoDTO> guardar(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody GuardarPrediccionTorneoRequest req) {
        PrediccionTorneoDTO dto = prediccionTorneoService.guardar(userDetails.getUsername(), req);
        return ResponseEntity.ok(dto);
    }
}
