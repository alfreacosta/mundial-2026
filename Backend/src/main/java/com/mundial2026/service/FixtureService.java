package com.mundial2026.service;

import com.mundial2026.dto.fixture.FixtureDTO;
import com.mundial2026.model.Partido;
import com.mundial2026.repository.PartidoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Servicio principal de fixtures/partidos.
 * Combina datos de API-Football con datos locales de la BD.
 * Fallback automático a datos locales si la API no está disponible.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FixtureService {

    private final PartidoRepository partidoRepository;

    /**
     * Obtiene todos los partidos del Mundial 2026.
     * Siempre usa datos locales de la BD (sincronizados previamente).
     */
    @Transactional(readOnly = true)
    public List<FixtureDTO> getAllWorldCupFixtures() {
        return getLocalFixtures(null, null);
    }

    /**
     * Obtiene partidos filtrados por fase
     */
    @Transactional(readOnly = true)
    public List<FixtureDTO> getFixturesByFase(String faseCodigo) {
        return getLocalFixtures(faseCodigo, null);
    }

    /**
     * Obtiene partidos filtrados por grupo
     */
    @Transactional(readOnly = true)
    public List<FixtureDTO> getFixturesByGrupo(String grupo) {
        return getLocalFixtures("GRUPOS", grupo);
    }

    /**
     * Obtiene partidos de una fecha específica
     */
    @Transactional(readOnly = true)
    public List<FixtureDTO> getFixturesByDate(LocalDate fecha) {
        return getLocalFixtures(null, null).stream()
                .filter(f -> f.getFechaHora() != null
                        && f.getFechaHora().toLocalDate().equals(fecha))
                .collect(Collectors.toList());
    }

    /**
     * Obtiene partidos en vivo
     */
    public List<FixtureDTO> getLiveFixtures() {
        return partidoRepository.findByEstado("EN_CURSO").stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * Obtiene amistosos previos al Mundial
     */
    public List<FixtureDTO> getFriendlyFixtures() {
        return Collections.emptyList();
    }

    /**
     * Obtiene todas las fechas disponibles que tienen partidos
     */
    @Transactional(readOnly = true)
    public List<LocalDate> getAvailableDates() {
        return getLocalFixtures(null, null).stream()
                .filter(f -> f.getFechaHora() != null)
                .map(f -> f.getFechaHora().toLocalDate())
                .distinct()
                .sorted()
                .collect(Collectors.toList());
    }

    /**
     * Resumen de partidos para el dashboard:
     * totales, finalizados, en curso, pendientes
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getFixturesSummary() {
        List<FixtureDTO> all = getLocalFixtures(null, null);
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("total", all.size());
        summary.put("finalizados", all.stream().filter(f -> "FINALIZADO".equals(f.getEstado())).count());
        summary.put("enCurso", all.stream().filter(f -> "EN_CURSO".equals(f.getEstado())).count());
        summary.put("pendientes", all.stream().filter(f -> "PENDIENTE".equals(f.getEstado())).count());
        return summary;
    }

    // ---- Helpers privados ----

    @Transactional(readOnly = true)
    private List<FixtureDTO> getLocalFixtures(String faseCodigo, String grupo) {
        List<Partido> partidos;
        if (faseCodigo != null) {
            partidos = partidoRepository.findByFaseCodigoWithTeams(faseCodigo);
        } else {
            partidos = partidoRepository.findAllWithTeams();
        }

        return partidos.stream()
                .filter(p -> {
                    if (grupo == null) return true;
                    // Filtrar por grupo del equipo local
                    return (p.getEquipoLocal() != null && grupo.equals(p.getEquipoLocal().getGrupo()))
                            || (p.getEquipoVisitante() != null && grupo.equals(p.getEquipoVisitante().getGrupo()));
                })
                .map(this::toDTO)
                .sorted(Comparator.comparing(FixtureDTO::getFechaHora, Comparator.nullsLast(Comparator.naturalOrder())))
                .collect(Collectors.toList());
    }

    private FixtureDTO toDTO(Partido p) {
        return FixtureDTO.builder()
                .id(p.getInternalId())
                .equipoLocalNombre(p.getEquipoLocal() != null ? p.getEquipoLocal().getNombre() : "Por definir")
                .equipoLocalCodigo(p.getEquipoLocal() != null ? p.getEquipoLocal().getCodigo() : "TBD")
                .equipoVisitanteNombre(p.getEquipoVisitante() != null ? p.getEquipoVisitante().getNombre() : "Por definir")
                .equipoVisitanteCodigo(p.getEquipoVisitante() != null ? p.getEquipoVisitante().getCodigo() : "TBD")
                .faseNombre(p.getFase() != null ? p.getFase().getNombre() : "")
                .faseCodigo(p.getFase() != null ? p.getFase().getCodigo() : "")
                .grupo(p.getEquipoLocal() != null ? p.getEquipoLocal().getGrupo() : null)
                .golLocal(p.getGolLocal())
                .golVisitante(p.getGolVisitante())
                .fechaHora(p.getTransDate())
                .estadio(p.getEstadio())
                .ciudad(extractCiudad(p.getEstadio()))
                .estado(p.getEstado())
                .tipoPartido("MUNDIAL")
                .build();
    }

    private String extractCiudad(String estadio) {
        if (estadio == null) return "";
        // Mapa simplificado de estadios a ciudades
        Map<String, String> map = Map.ofEntries(
                Map.entry("Estadio Azteca", "Ciudad de México"),
                Map.entry("MetLife Stadium", "East Rutherford, NJ"),
                Map.entry("SoFi Stadium", "Los Ángeles, CA"),
                Map.entry("AT&T Stadium", "Arlington, TX"),
                Map.entry("Hard Rock Stadium", "Miami, FL"),
                Map.entry("NRG Stadium", "Houston, TX"),
                Map.entry("Mercedes-Benz Stadium", "Atlanta, GA"),
                Map.entry("Lumen Field", "Seattle, WA"),
                Map.entry("Lincoln Financial Field", "Philadelphia, PA"),
                Map.entry("Arrowhead Stadium", "Kansas City, MO"),
                Map.entry("Levi's Stadium", "Santa Clara, CA"),
                Map.entry("BMO Field", "Toronto"),
                Map.entry("BC Place", "Vancouver"),
                Map.entry("Estadio BBVA", "Monterrey"),
                Map.entry("Estadio Akron", "Guadalajara"),
                Map.entry("Gillette Stadium", "Foxborough, MA"),
                Map.entry("Rose Bowl", "Pasadena, CA")
        );
        return map.getOrDefault(estadio, "");
    }
}
