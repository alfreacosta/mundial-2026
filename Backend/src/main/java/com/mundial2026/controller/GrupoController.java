package com.mundial2026.controller;

import com.mundial2026.dto.grupo.*;
import com.mundial2026.service.GrupoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller REST para la feature de Grupos.
 * Todos los endpoints requieren autenticación JWT.
 */
@RestController
@RequestMapping("/api/grupos")
@RequiredArgsConstructor
public class GrupoController {

    private final GrupoService grupoService;

    /** Crear un nuevo grupo */
    @PostMapping
    public ResponseEntity<GrupoDTO> crearGrupo(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CrearGrupoRequest req) {
        GrupoDTO dto = grupoService.crearGrupo(userDetails.getUsername(), req);
        return ResponseEntity.ok(dto);
    }

    /** Listar mis grupos (donde soy miembro o creador) */
    @GetMapping("/mis-grupos")
    public ResponseEntity<List<GrupoDTO>> getMisGrupos(
            @AuthenticationPrincipal UserDetails userDetails) {
        List<GrupoDTO> grupos = grupoService.getMisGrupos(userDetails.getUsername());
        return ResponseEntity.ok(grupos);
    }

    /** Detalle de un grupo (solo para miembros) */
    @GetMapping("/{id}")
    public ResponseEntity<GrupoDTO> getDetalleGrupo(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        GrupoDTO dto = grupoService.getDetalleGrupo(id, userDetails.getUsername());
        return ResponseEntity.ok(dto);
    }

    /** Unirse a un grupo con el código de invitación */
    @PostMapping("/unirse")
    public ResponseEntity<GrupoRowDTO> unirseAlGrupo(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody UnirseGrupoRequest req) {
        GrupoRowDTO dto = grupoService.unirseAlGrupo(userDetails.getUsername(), req);
        return ResponseEntity.ok(dto);
    }

    /** Salir de un grupo */
    @DeleteMapping("/{id}/salir")
    public ResponseEntity<Void> salirDeGrupo(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        grupoService.salirDeGrupo(id, userDetails.getUsername());
        return ResponseEntity.noContent().build();
    }

    /** Eliminar un grupo (solo el creador) */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarGrupo(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        grupoService.eliminarGrupo(id, userDetails.getUsername());
        return ResponseEntity.noContent().build();
    }

    /** Preview público de un grupo (sin autenticación, solo lectura) */
    @GetMapping("/public/{codigo}")
    public ResponseEntity<GrupoDTO> getPreviewPublico(@PathVariable String codigo) {
        GrupoDTO dto = grupoService.getPreviewPublico(codigo);
        return ResponseEntity.ok(dto);
    }

    /** Top 10 grupos por puntaje acumulado (público) */
    @GetMapping("/ranking")
    public ResponseEntity<List<GrupoRankingDTO>> getRankingGrupos() {
        return ResponseEntity.ok(grupoService.getRankingGrupos());
    }
}
