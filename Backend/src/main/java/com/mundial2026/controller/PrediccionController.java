package com.mundial2026.controller;

import com.mundial2026.dto.prediccion.GuardarPrediccionPartidoRequest;
import com.mundial2026.dto.prediccion.PrediccionPartidoDTO;
import com.mundial2026.dto.prediccion.ResumenPrediccionesDTO;
import com.mundial2026.model.Partido;
import com.mundial2026.model.Prediccion;
import com.mundial2026.model.Usuario;
import com.mundial2026.repository.PartidoRepository;
import com.mundial2026.repository.PrediccionRepository;
import com.mundial2026.repository.PrediccionTorneoRepository;
import com.mundial2026.repository.UsuarioRepository;
import com.mundial2026.service.ScoringService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * REST Controller para predicciones de partidos (fase de grupos y siguientes).
 *
 * Endpoints:
 *   GET  /api/predicciones-partidos              → mis predicciones (todas)
 *   GET  /api/predicciones-partidos/partido/{id} → mi predicción de un partido
 *   POST /api/predicciones-partidos/partido/{id} → guardar / actualizar predicción
 *   GET  /api/predicciones-partidos/resumen      → estadísticas para dashboard
 */
@RestController
@RequestMapping("/api/predicciones-partidos")
@RequiredArgsConstructor
public class PrediccionController {

    private final PrediccionRepository      prediccionRepository;
    private final PartidoRepository         partidoRepository;
    private final UsuarioRepository         usuarioRepository;
    private final PrediccionTorneoRepository prediccionTorneoRepository;
    private final ScoringService            scoringService;

    // ── GET: todas mis predicciones ──────────────────────────────────

    @GetMapping
    public ResponseEntity<List<PrediccionPartidoDTO>> getMisPredicciones(Authentication auth) {
        List<PrediccionPartidoDTO> dtos = prediccionRepository
                .findByUsernameWithPartido(auth.getName())
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    // ── GET: predicción de un partido específico ─────────────────────

    @GetMapping("/partido/{partidoId}")
    public ResponseEntity<PrediccionPartidoDTO> getMiPrediccionPartido(
            @PathVariable Long partidoId, Authentication auth) {

        return prediccionRepository
                .findByUsuarioAndPartidoWithTeams(auth.getName(), partidoId)
                .map(p -> ResponseEntity.ok(toDTO(p)))
                .orElse(ResponseEntity.noContent().build());
    }

    // ── POST: guardar o actualizar predicción ────────────────────────

    @PostMapping("/partido/{partidoId}")
    public ResponseEntity<?> guardarPrediccion(
            @PathVariable Long partidoId,
            @RequestBody @Valid GuardarPrediccionPartidoRequest req,
            Authentication auth) {

        Partido partido = partidoRepository.findByIdWithTeams(partidoId).orElse(null);
        if (partido == null) {
            return ResponseEntity.notFound().build();
        }

        if (scoringService.isPartidoBloqueado(partido)) {
            return ResponseEntity.status(423)
                    .body(Map.of("error",
                            "Este partido ya comenzó. No se puede modificar la predicción.",
                            "fechaInicio", partido.getTransDate().toString()));
        }

        String  username = auth.getName();
        Usuario usuario  = usuarioRepository.findByUser(username)
                .orElseThrow(() -> new IllegalStateException("Usuario no encontrado: " + username));

        Prediccion pred = prediccionRepository
                .findByUsuario_UserAndPartido_InternalId(username, partidoId)
                .orElse(Prediccion.builder()
                        .usuario(usuario)
                        .partido(partido)
                        .build());

        // Asegurar que el partido con relaciones cargadas se use para toDTO
        pred.setPartido(partido);
        pred.setGolLocal(req.golLocal());
        pred.setGolVisitante(req.golVisitante());
        pred.setFechaActualizacion(LocalDateTime.now());
        prediccionRepository.save(pred);

        return ResponseEntity.ok(toDTO(pred));
    }

    // ── GET: resumen estadístico para el dashboard ───────────────────

    @GetMapping("/resumen")
    public ResponseEntity<ResumenPrediccionesDTO> getMiResumen(Authentication auth) {
        String username = auth.getName();

        List<Prediccion> preds = prediccionRepository.findByUsernameWithPartido(username);

        long totalPartidos = partidoRepository.count();
        long predichas     = preds.size();
        long bloqueadas    = preds.stream()
                .filter(p -> Boolean.TRUE.equals(p.getAprobada())).count();

        int totalPuntos = preds.stream()
                .filter(p -> p.getPuntajeObtenido() != null)
                .mapToInt(Prediccion::getPuntajeObtenido)
                .sum();

        long exactas    = preds.stream()
                .filter(p -> p.getPuntajeObtenido() != null
                             && p.getPuntajeObtenido() == ScoringService.PTS_EXACTO)
                .count();
        long correctas  = preds.stream()
                .filter(p -> p.getPuntajeObtenido() != null
                             && p.getPuntajeObtenido() > 0
                             && p.getPuntajeObtenido() < ScoringService.PTS_EXACTO)
                .count();
        long incorrectas = preds.stream()
                .filter(p -> p.getPuntajeObtenido() != null
                             && p.getPuntajeObtenido() == 0)
                .count();

        boolean torneoHecha      = prediccionTorneoRepository.findByUsuario_User(username).isPresent();
        boolean torneoConfirmada = prediccionTorneoRepository.findByUsuario_User(username)
                .map(pt -> Boolean.TRUE.equals(pt.getConfirmada()))
                .orElse(false);

        return ResponseEntity.ok(new ResumenPrediccionesDTO(
                totalPartidos,
                predichas,
                bloqueadas,
                totalPuntos,
                exactas,
                correctas,
                incorrectas,
                torneoHecha,
                torneoConfirmada
        ));
    }

    // ── Helper ───────────────────────────────────────────────────────

    private PrediccionPartidoDTO toDTO(Prediccion p) {
        Partido partido = p.getPartido();
        boolean bloqueada = scoringService.isPartidoBloqueado(partido)
                            || Boolean.TRUE.equals(p.getAprobada());

        return new PrediccionPartidoDTO(
                p.getInternalId(),
                partido.getInternalId(),
                partido.getEquipoLocal()     != null ? partido.getEquipoLocal().getNombre()     : "Por definir",
                partido.getEquipoLocal()     != null ? partido.getEquipoLocal().getCodigo()     : "TBD",
                partido.getEquipoVisitante() != null ? partido.getEquipoVisitante().getNombre() : "Por definir",
                partido.getEquipoVisitante() != null ? partido.getEquipoVisitante().getCodigo() : "TBD",
                partido.getTransDate(),
                partido.getEstadio(),
                partido.getFase() != null ? partido.getFase().getCodigo() : "",
                partido.getFase() != null ? partido.getFase().getNombre() : "",
                partido.getEquipoLocal() != null ? partido.getEquipoLocal().getGrupo() : null,
                partido.getEstado(),
                partido.getGolLocal(),
                partido.getGolVisitante(),
                p.getGolLocal(),
                p.getGolVisitante(),
                bloqueada,
                p.getPuntajeObtenido()
        );
    }
}
