package com.mundial2026.controller;

import com.mundial2026.dto.fixture.ActualizarResultadoRequest;
import com.mundial2026.dto.fixture.FixtureDTO;
import com.mundial2026.model.Partido;
import com.mundial2026.repository.PartidoRepository;
import com.mundial2026.security.SyncAuthHelper;
import com.mundial2026.service.FixtureService;
import com.mundial2026.service.ScoringService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * REST Controller para partidos/fixtures del Mundial 2026.
 * Endpoints públicos (no requieren autenticación) para consultar partidos.
 */
@RestController
@RequestMapping("/api/fixtures")
@RequiredArgsConstructor
public class FixtureController {

    private final FixtureService    fixtureService;
    private final PartidoRepository partidoRepository;
    private final ScoringService    scoringService;
    private final SyncAuthHelper    syncAuthHelper;

    /** Todos los partidos del Mundial */
    @GetMapping
    public ResponseEntity<List<FixtureDTO>> getAllFixtures() {
        return ResponseEntity.ok(fixtureService.getAllWorldCupFixtures());
    }

    /** Partidos filtrados por fase (GRUPOS, OCTAVOS, CUARTOS, etc.) */
    @GetMapping("/fase/{faseCodigo}")
    public ResponseEntity<List<FixtureDTO>> getByFase(@PathVariable String faseCodigo) {
        return ResponseEntity.ok(fixtureService.getFixturesByFase(faseCodigo));
    }

    /** Partidos de un grupo específico (A, B, C ... L) */
    @GetMapping("/grupo/{grupo}")
    public ResponseEntity<List<FixtureDTO>> getByGrupo(@PathVariable String grupo) {
        return ResponseEntity.ok(fixtureService.getFixturesByGrupo(grupo));
    }

    /** Partidos de una fecha específica */
    @GetMapping("/fecha/{fecha}")
    public ResponseEntity<List<FixtureDTO>> getByDate(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
        return ResponseEntity.ok(fixtureService.getFixturesByDate(fecha));
    }

    /** Partidos en vivo */
    @GetMapping("/live")
    public ResponseEntity<List<FixtureDTO>> getLive() {
        return ResponseEntity.ok(fixtureService.getLiveFixtures());
    }

    /** Amistosos internacionales */
    @GetMapping("/friendlies")
    public ResponseEntity<List<FixtureDTO>> getFriendlies() {
        return ResponseEntity.ok(fixtureService.getFriendlyFixtures());
    }

    /** Fechas disponibles con partidos */
    @GetMapping("/dates")
    public ResponseEntity<List<LocalDate>> getAvailableDates() {
        return ResponseEntity.ok(fixtureService.getAvailableDates());
    }

    /** Resumen general de partidos */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary() {
        return ResponseEntity.ok(fixtureService.getFixturesSummary());
    }

    /**
     * [ADMIN] Actualiza el resultado de un partido y recalcula puntajes.
     * Requiere header X-Sync-Key.
     */
    @PutMapping("/{id}/resultado")
    public ResponseEntity<?> actualizarResultado(
            @PathVariable Long id,
            @RequestBody @Valid ActualizarResultadoRequest req,
            @RequestHeader(value = "X-Sync-Key", required = false) String syncKey) {

        if (!syncAuthHelper.isAuthorized(syncKey)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "No autorizado. Se requiere X-Sync-Key válida."));
        }

        Partido partido = partidoRepository.findById(id).orElse(null);
        if (partido == null) {
            return ResponseEntity.notFound().build();
        }

        partido.setGolLocal(req.golLocal());
        partido.setGolVisitante(req.golVisitante());
        partido.setEstado("FINALIZADO");
        partido.setFinalizado(true);
        partido.setEndDate(LocalDateTime.now());
        partidoRepository.save(partido);

        int procesadas = scoringService.actualizarPuntajesPartido(id);

        return ResponseEntity.ok(Map.of(
                "mensaje",                   "Resultado guardado y puntajes calculados",
                "partidoId",                 id,
                "golLocal",                  req.golLocal(),
                "golVisitante",              req.golVisitante(),
                "prediccionesProcesadas",    procesadas
        ));
    }

}
