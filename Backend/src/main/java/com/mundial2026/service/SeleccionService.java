package com.mundial2026.service;

import com.mundial2026.dto.seleccion.*;
import com.mundial2026.model.Jugador;
import com.mundial2026.model.Pais;
import com.mundial2026.repository.JugadorRepository;
import com.mundial2026.repository.PaisRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Servicio de negocio para selecciones: combina datos locales (BD) con API-Football.
 * Si la API no está disponible, retorna datos locales enriquecidos con URLs de media.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SeleccionService {

    private final PaisRepository paisRepository;
    private final JugadorRepository jugadorRepository;
    private final ApiFootballExtendedService apiService;
    private final com.mundial2026.repository.EstadioRepository estadioRepository;

    // Mapa de código de país → API-Football team ID (selecciones nacionales)
    // Estos IDs son fijos y no cambian en la API
    private static final Map<String, Long> TEAM_ID_MAP = new LinkedHashMap<>();
    static {
        // CONMEBOL
        TEAM_ID_MAP.put("ARG", 26L);    // Argentina
        TEAM_ID_MAP.put("BRA", 6L);     // Brasil
        TEAM_ID_MAP.put("URU", 7L);     // Uruguay
        TEAM_ID_MAP.put("COL", 1564L);  // Colombia
        TEAM_ID_MAP.put("ECU", 2382L);  // Ecuador
        TEAM_ID_MAP.put("PAR", 2380L);  // Paraguay (29 es Costa Rica!)
        TEAM_ID_MAP.put("CHI", 2397L);  // Chile
        TEAM_ID_MAP.put("PER", 2391L);  // Perú
        // UEFA
        TEAM_ID_MAP.put("ESP", 9L);     // España
        TEAM_ID_MAP.put("ENG", 10L);    // Inglaterra
        TEAM_ID_MAP.put("FRA", 2L);     // Francia
        TEAM_ID_MAP.put("GER", 25L);    // Alemania
        TEAM_ID_MAP.put("POR", 27L);    // Portugal
        TEAM_ID_MAP.put("NED", 1118L);  // Países Bajos
        TEAM_ID_MAP.put("BEL", 1L);     // Bélgica
        TEAM_ID_MAP.put("ITA", 768L);   // Italia
        TEAM_ID_MAP.put("CRO", 3L);     // Croacia
        TEAM_ID_MAP.put("DEN", 21L);    // Dinamarca
        TEAM_ID_MAP.put("SUI", 15L);    // Suiza
        TEAM_ID_MAP.put("AUT", 775L);   // Austria
        TEAM_ID_MAP.put("SRB", 14L);    // Serbia
        TEAM_ID_MAP.put("POL", 24L);    // Polonia
        TEAM_ID_MAP.put("NOR", 1549L);  // Noruega
        TEAM_ID_MAP.put("SCO", 1108L);  // Escocia
        TEAM_ID_MAP.put("HUN", 769L);   // Hungría
        // CONCACAF
        TEAM_ID_MAP.put("MEX", 16L);    // México
        TEAM_ID_MAP.put("USA", 2384L);  // Estados Unidos
        TEAM_ID_MAP.put("CAN", 3003L);  // Canadá
        TEAM_ID_MAP.put("JAM", 2393L);  // Jamaica
        TEAM_ID_MAP.put("PAN", 2394L);  // Panamá
        TEAM_ID_MAP.put("CRC", 2389L);  // Costa Rica
        TEAM_ID_MAP.put("HAI", 2388L);  // Haití
        TEAM_ID_MAP.put("CUW", 23685L); // Curazao
        // CAF
        TEAM_ID_MAP.put("MAR", 31L);    // Marruecos
        TEAM_ID_MAP.put("SEN", 28L);    // Senegal
        TEAM_ID_MAP.put("NGA", 19L);    // Nigeria
        TEAM_ID_MAP.put("CMR", 1530L);  // Camerún
        TEAM_ID_MAP.put("RSA", 1531L);  // Sudáfrica
        TEAM_ID_MAP.put("EGY", 1533L);  // Egipto
        TEAM_ID_MAP.put("GHA", 758L);   // Ghana
        TEAM_ID_MAP.put("CIV", 1532L);  // Costa de Marfil
        TEAM_ID_MAP.put("ALG", 1535L);  // Argelia
        TEAM_ID_MAP.put("TUN", 30L);    // Túnez
        TEAM_ID_MAP.put("CPV", 4545L);  // Cabo Verde
        // AFC
        TEAM_ID_MAP.put("JPN", 2392L);  // Japón
        TEAM_ID_MAP.put("KOR", 17L);    // Corea del Sur
        TEAM_ID_MAP.put("IRN", 22L);    // Irán
        TEAM_ID_MAP.put("SAU", 23L);    // Arabia Saudita
        TEAM_ID_MAP.put("QAT", 1569L);  // Qatar
        TEAM_ID_MAP.put("AUS", 20L);    // Australia
        TEAM_ID_MAP.put("IRQ", 2381L);  // Irak
        TEAM_ID_MAP.put("UZB", 2395L);  // Uzbekistán
        TEAM_ID_MAP.put("JOR", 2396L);  // Jordania
        TEAM_ID_MAP.put("BHR", 2390L);  // Baréin
        // OFC
        TEAM_ID_MAP.put("NZL", 1120L);  // Nueva Zelanda
    }

    /**
     * Obtiene el detalle completo de una selección (info + plantel + DT).
     * Si el equipo ya fue sincronizado (ultimo_sync != null), usa BD local.
     * Si no, intenta API-Football y cae a BD local.
     */
    public SeleccionDTO getSeleccionDetalle(String codigoPais) {
        Optional<Pais> paisOpt = paisRepository.findByCodigoWithConfederacion(codigoPais);
        if (paisOpt.isEmpty()) {
            log.warn("País no encontrado: {}", codigoPais);
            return null;
        }

        Pais pais = paisOpt.get();
        Long apiTeamId = getApiTeamId(pais);

        // Construir DTO base desde la BD
        SeleccionDTO dto = SeleccionDTO.builder()
                .id(pais.getInternalId())
                .nombre(pais.getNombre())
                .codigo(pais.getCodigo())
                .grupo(pais.getGrupo())
                .confederacion(pais.getConfederacion().getNombre())
                .confederacionCodigo(pais.getConfederacion().getCodigo())
                .pj(pais.getPj())
                .pg(pais.getPg())
                .pe(pais.getPe())
                .pp(pais.getPp())
                .pts(pais.getPts())
                .apiTeamId(apiTeamId)
                .build();

        // Logo directo desde la BD (ya sincronizado)
        dto.setLogoUrl(pais.getLogoUrl());
        dto.setBanderaUrl(apiService.getFlagUrl(pais.getCodigo().toLowerCase()));

        // Siempre usar BD local — la API solo se llama durante sync manual
        dto.setPlantel(getPlantelFromDB(pais.getInternalId(), apiTeamId));

        return dto;
    }

    /**
     * Lista resumen de todas las selecciones (sin plantel, solo info básica + logo).
     */
    public List<SeleccionDTO> getAllSelecciones() {
        List<Pais> paises = paisRepository.findAllWithConfederacion();
        return paises.stream()
                .filter(Pais::getActivo)
                .map(p -> {
                    Long apiTeamId = getApiTeamId(p);
                    return SeleccionDTO.builder()
                            .id(p.getInternalId())
                            .nombre(p.getNombre())
                            .codigo(p.getCodigo())
                            .grupo(p.getGrupo())
                            .confederacion(p.getConfederacion().getNombre())
                            .confederacionCodigo(p.getConfederacion().getCodigo())
                            .pj(p.getPj()).pg(p.getPg()).pe(p.getPe()).pp(p.getPp()).pts(p.getPts())
                            .apiTeamId(apiTeamId)
                            .logoUrl(p.getLogoUrl())
                            .banderaUrl(apiService.getFlagUrl(p.getCodigo().toLowerCase()))
                            .build();
                })
                .collect(Collectors.toList());
    }

    /**
     * Selecciones de una confederación específica.
     */
    public List<SeleccionDTO> getSeleccionesPorConfederacion(String confCodigo) {
        return getAllSelecciones().stream()
                .filter(s -> confCodigo.equalsIgnoreCase(s.getConfederacionCodigo()))
                .collect(Collectors.toList());
    }

    /**
     * Obtiene standings/tabla de posiciones del Mundial desde API o BD local.
     */
    public List<StandingsDTO> getStandings() {
        return buildStandingsFromDB();
    }

    /**
     * Obtiene la lista de DTs de los 48 equipos para usarlos como avatares.
     * Llama a la API-Football con cache de 24h por equipo.
     */
    public List<DtAvatarDTO> getDtAvatars() {
        List<Pais> paises = paisRepository.findAllWithConfederacion();
        List<DtAvatarDTO> result = new ArrayList<>();
        for (Pais p : paises) {
            if (!p.getActivo()) continue;
            Long apiTeamId = getApiTeamId(p);
            if (apiTeamId == null) continue;
            Optional<Map<String, String>> coachOpt = apiService.getCoach(apiTeamId);
            if (coachOpt.isPresent()) {
                Map<String, String> coach = coachOpt.get();
                result.add(DtAvatarDTO.builder()
                        .codigo(p.getCodigo())
                        .pais(p.getNombre())
                        .dtNombre(coach.get("nombre"))
                        .dtFotoUrl(coach.get("fotoUrl"))
                        .logoUrl(p.getLogoUrl())
                        .build());
            }
        }
        result.sort(Comparator.comparing(DtAvatarDTO::getPais));
        return result;
    }

    /**
     * Busca un venue/estadio del Mundial por nombre.
     */
    public Optional<VenueDTO> getVenueByName(String name) {
        return estadioRepository.findByNombreIgnoreCase(name)
                .map(this::toVenueDTO);
    }

    /**
     * Obtiene lista de venues del Mundial (los 15 estadios).
     */
    public List<VenueDTO> getWorldCupVenues() {
        return estadioRepository.findAll().stream()
                .map(this::toVenueDTO)
                .collect(Collectors.toList());
    }

    private VenueDTO toVenueDTO(com.mundial2026.model.Estadio e) {
        return VenueDTO.builder()
                .apiVenueId(e.getApiVenueId())
                .nombre(e.getNombre())
                .ciudad(e.getCiudad())
                .pais(e.getPais())
                .capacidad(e.getCapacidad())
                .fotoUrl(e.getUrlFoto())
                .build();
    }

    // ---- Helpers privados ----

    private List<JugadorSeleccionDTO> getPlantelFromDB(Long paisId, Long apiTeamId) {
        List<Jugador> jugadores = jugadorRepository.findByPaisInternalId(paisId);
        return jugadores.stream()
                .map(j -> JugadorSeleccionDTO.builder()
                        .id(j.getInternalId())
                        .nombre(j.getNombre())
                        .apellido(j.getApellido())
                        .nombreCompleto(j.getNombreCompleto())
                        .numeroCamiseta(j.getNumeroCamiseta())
                        .edad(j.getEdad())
                        .posicion(j.getPosicion() != null ? j.getPosicion().getNombre() : null)
                        .posicionCodigo(j.getPosicion() != null ? j.getPosicion().getCodigo() : null)
                        .fotoUrl(j.getUrlFoto())
                        .clubNombre(j.getClub() != null ? j.getClub().getNombre() : null)
                        .partidosTemporada(j.getPartidosTemporada())
                        .convocadoEliminatoria(j.getConvocadoEliminatoria())
                        .build())
                .collect(Collectors.toList());
    }

    private List<StandingsDTO> buildStandingsFromDB() {
        List<Pais> paises = paisRepository.findAllWithConfederacion();
        Map<String, List<Pais>> byGrupo = paises.stream()
                .filter(p -> p.getGrupo() != null && p.getActivo())
                .collect(Collectors.groupingBy(Pais::getGrupo, TreeMap::new, Collectors.toList()));

        return byGrupo.entrySet().stream()
                .map(e -> {
                    List<StandingsDTO.StandingEntry> entries = new ArrayList<>();
                    // Ordenar por pts desc, luego por dg (pg-pp), luego por pg desc
                    List<Pais> sorted = e.getValue().stream()
                            .sorted(Comparator.comparingInt(Pais::getPts).reversed()
                                    .thenComparing(Comparator.comparingInt(Pais::getPg).reversed()))
                            .collect(Collectors.toList());

                    int pos = 1;
                    for (Pais p : sorted) {
                        Long tid = getApiTeamId(p);
                        entries.add(StandingsDTO.StandingEntry.builder()
                                .posicion(pos++)
                                .equipoNombre(p.getNombre())
                                .equipoCodigo(p.getCodigo())
                                .apiTeamId(tid)
                                .logoUrl(p.getLogoUrl())
                                .pj(p.getPj()).pg(p.getPg()).pe(p.getPe()).pp(p.getPp())
                                .gf(0).gc(0)
                                .dg(0)
                                .pts(p.getPts())
                                .forma("")
                                .build());
                    }
                    return StandingsDTO.builder().grupo(e.getKey()).posiciones(entries).build();
                })
                .collect(Collectors.toList());
    }

    /**
     * Verifica si un código tiene team ID mapeado.
     */
    public boolean hasTeamId(String codigoPais) {
        return TEAM_ID_MAP.containsKey(codigoPais);
    }

    /**
     * Retorna el mapa de IDs para uso externo.
     */
    public Map<String, Long> getTeamIdMap() {
        return Collections.unmodifiableMap(TEAM_ID_MAP);
    }

    /**
     * Obtiene el api_team_id: primero desde la BD (pais.api_team_id), luego del mapa estático.
     */
    private Long getApiTeamId(Pais pais) {
        if (pais.getApiTeamId() != null) return pais.getApiTeamId();
        return TEAM_ID_MAP.get(pais.getCodigo());
    }
}
