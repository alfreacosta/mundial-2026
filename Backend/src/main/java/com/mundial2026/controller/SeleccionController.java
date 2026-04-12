package com.mundial2026.controller;

import com.mundial2026.dto.seleccion.*;
import com.mundial2026.service.SeleccionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller para selecciones del Mundial 2026.
 * Endpoints públicos que combinan datos locales con API-Football.
 */
@RestController
@RequestMapping("/api/selecciones")
@RequiredArgsConstructor
public class SeleccionController {

    private final SeleccionService seleccionService;

    /** Listado resumido de todas las selecciones */
    @GetMapping
    public ResponseEntity<List<SeleccionDTO>> getAll() {
        return ResponseEntity.ok(seleccionService.getAllSelecciones());
    }

    /** Selecciones de una confederación (CONMEBOL, UEFA, etc.) */
    @GetMapping("/confederacion/{codigo}")
    public ResponseEntity<List<SeleccionDTO>> getByConfederacion(@PathVariable String codigo) {
        return ResponseEntity.ok(seleccionService.getSeleccionesPorConfederacion(codigo.toUpperCase()));
    }

    /** Detalle completo de una selección (info + plantel + DT + estadio) */
    @GetMapping("/{codigo}")
    public ResponseEntity<SeleccionDTO> getDetalle(@PathVariable String codigo) {
        SeleccionDTO dto = seleccionService.getSeleccionDetalle(codigo.toUpperCase());
        if (dto == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(dto);
    }

    /** Tabla de posiciones del Mundial (por grupos) */
    @GetMapping("/standings")
    public ResponseEntity<List<StandingsDTO>> getStandings() {
        return ResponseEntity.ok(seleccionService.getStandings());
    }

    /** Listado de DTs como opciones de avatar */
    @GetMapping("/dt-avatars")
    public ResponseEntity<List<DtAvatarDTO>> getDtAvatars() {
        return ResponseEntity.ok(seleccionService.getDtAvatars());
    }

    /** Buscar un estadio del Mundial por nombre */
    @GetMapping("/venues/search")
    public ResponseEntity<VenueDTO> searchVenue(@RequestParam String name) {
        return seleccionService.getVenueByName(name)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** Listado de estadios del Mundial 2026 */
    @GetMapping("/venues")
    public ResponseEntity<List<VenueDTO>> getWorldCupVenues() {
        return ResponseEntity.ok(seleccionService.getWorldCupVenues());
    }
}
