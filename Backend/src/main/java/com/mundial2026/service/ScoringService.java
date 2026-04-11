package com.mundial2026.service;

import com.mundial2026.model.Partido;
import com.mundial2026.model.Prediccion;
import com.mundial2026.repository.PartidoRepository;
import com.mundial2026.repository.PrediccionRepository;
import com.mundial2026.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Servicio de puntuación para predicciones de partidos.
 *
 * Reglas de puntuación estándar (no acumulativas):
 *  - Marcador exacto:              3 puntos
 *  - Diferencia de goles correcta: 2 puntos
 *  - Solo resultado correcto:      1 punto
 *  - Incorrecto:                   0 puntos
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScoringService {

    private final PartidoRepository   partidoRepository;
    private final PrediccionRepository prediccionRepository;
    private final UsuarioRepository   usuarioRepository;

    // ── Puntajes configurables ──────────────────────────────────────
    public static final int PTS_EXACTO    = 3;
    public static final int PTS_DIFERENCIA = 2;
    public static final int PTS_RESULTADO  = 1;

    /**
     * Indica si un partido ya está bloqueado para modificar predicciones.
     * Se bloquea cuando su fecha/hora de inicio ya pasó.
     */
    public boolean isPartidoBloqueado(Partido partido) {
        return partido.getTransDate() != null
               && partido.getTransDate().isBefore(LocalDateTime.now());
    }

    /**
     * Calcula los puntos que corresponden a una predicción dado el resultado real.
     */
    public int calcularPuntaje(int predLocal, int predVisitante,
                               int realLocal, int realVisitante) {
        String resultadoPred = getResultado(predLocal, predVisitante);
        String resultadoReal = getResultado(realLocal, realVisitante);

        if (!resultadoPred.equals(resultadoReal)) {
            return 0;
        }

        // Marcador exacto → máximo
        if (predLocal == realLocal && predVisitante == realVisitante) {
            return PTS_EXACTO;
        }

        // Misma diferencia de goles (pero no marcador exacto)
        int difPred = predLocal - predVisitante;
        int difReal = realLocal - realVisitante;
        if (difPred == difReal) {
            return PTS_DIFERENCIA;
        }

        // Solo resultado correcto
        return PTS_RESULTADO;
    }

    /**
     * Procesa todas las predicciones de un partido finalizado:
     * 1. Calcula puntajeObtenido para cada predicción
     * 2. Marca la predicción como aprobada
     * 3. Recalcula el puntaje total de cada usuario afectado
     *
     * @return número de predicciones procesadas
     */
    @Transactional
    public int actualizarPuntajesPartido(Long partidoId) {
        Partido partido = partidoRepository.findById(partidoId)
                .orElseThrow(() -> new IllegalArgumentException("Partido no encontrado: " + partidoId));

        if (partido.getGolLocal() == null || partido.getGolVisitante() == null) {
            throw new IllegalStateException("El partido no tiene resultado registrado");
        }

        int realLocal     = partido.getGolLocal();
        int realVisitante = partido.getGolVisitante();

        List<Prediccion> predicciones = prediccionRepository.findByPartido_InternalId(partidoId);
        int procesadas = 0;

        for (Prediccion pred : predicciones) {
            int pts = calcularPuntaje(
                pred.getGolLocal(), pred.getGolVisitante(),
                realLocal, realVisitante);

            pred.setPuntajeObtenido(pts);
            pred.setAprobada(true);
            pred.setFechaActualizacion(LocalDateTime.now());
            prediccionRepository.save(pred);
            procesadas++;
        }

        // Recalcular total por usuario (una sola pasada de SQL por usuario único)
        predicciones.stream()
                .map(p -> p.getUsuario().getUser())
                .distinct()
                .forEach(this::recalcularPuntajeUsuario);

        log.info("Partido {}: {} predicciones procesadas — resultado final {}-{}",
                partidoId, procesadas, realLocal, realVisitante);

        return procesadas;
    }

    /**
     * Recalcula el puntaje total del usuario sumando todas sus predicciones evaluadas.
     */
    @Transactional
    public void recalcularPuntajeUsuario(String username) {
        int totalPts = prediccionRepository.sumPuntajeByUsername(username);
        usuarioRepository.findByUser(username).ifPresent(u -> {
            u.setPuntaje(totalPts);
            usuarioRepository.save(u);
        });
    }

    // ── Helpers ─────────────────────────────────────────────────────

    private String getResultado(int local, int visitante) {
        if (local > visitante) return "LOCAL";
        if (local < visitante) return "VISITANTE";
        return "EMPATE";
    }
}
