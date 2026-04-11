package com.mundial2026.service;

import com.mundial2026.model.Jugador;
import com.mundial2026.model.Pais;
import com.mundial2026.model.PosicionJugador;
import com.mundial2026.repository.JugadorRepository;
import com.mundial2026.repository.PaisRepository;
import com.mundial2026.repository.PosicionJugadorRepository;
import com.mundial2026.dto.seleccion.JugadorSeleccionDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Servicio de sincronización incremental con API-Football.
 * Usa las 100 llamadas diarias gratuitas para ir guardando datos en BD.
 * Una vez sincronizado, el equipo se sirve desde BD sin gastar llamadas.
 *
 * Cada syncTeam consume 1 llamada API (squad).
 * Con 100/día se puede sincronizar los 48 equipos en 1 día.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SyncService {

    private final PaisRepository paisRepository;
    private final JugadorRepository jugadorRepository;
    private final PosicionJugadorRepository posicionRepository;
    private final ApiFootballExtendedService apiService;

    private static final String MEDIA_BASE = "https://media.api-sports.io/football";

    /**
     * Sincroniza el plantel de UN equipo desde API-Football.
     * Consume 1 llamada API. Guarda/actualiza jugadores en BD con api_player_id y url_foto.
     *
     * @return mapa con resultado: paisCodigo, jugadoresSincronizados, nuevos, actualizados
     */
    @Transactional
    public Map<String, Object> syncTeam(String codigoPais) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("codigo", codigoPais);

        Optional<Pais> paisOpt = paisRepository.findByCodigoWithConfederacion(codigoPais.toUpperCase());
        if (paisOpt.isEmpty()) {
            result.put("error", "País no encontrado: " + codigoPais);
            return result;
        }

        Pais pais = paisOpt.get();
        Long apiTeamId = pais.getApiTeamId();
        if (apiTeamId == null) {
            result.put("error", "País sin api_team_id: " + codigoPais);
            return result;
        }

        result.put("nombre", pais.getNombre());
        result.put("apiTeamId", apiTeamId);

        // Cargar mapa de posiciones
        Map<String, PosicionJugador> posicionMap = getPosicionMap();

        // Llamar API-Football para obtener el plantel (1 API call)
        Optional<List<JugadorSeleccionDTO>> squadOpt = apiService.getSquad(apiTeamId);
        if (squadOpt.isEmpty() || squadOpt.get().isEmpty()) {
            result.put("error", "No se pudo obtener plantel de la API. ¿Hay API key configurada?");
            return result;
        }

        List<JugadorSeleccionDTO> apiSquad = squadOpt.get();
        int nuevos = 0;
        int actualizados = 0;

        for (JugadorSeleccionDTO jugadorApi : apiSquad) {
            if (jugadorApi.getApiPlayerId() == null || jugadorApi.getApiPlayerId() == 0) continue;

            // Buscar si ya existe por api_player_id
            Optional<Jugador> existente = jugadorRepository.findByApiPlayerId(jugadorApi.getApiPlayerId());

            if (existente.isPresent()) {
                // Actualizar datos existentes
                Jugador j = existente.get();
                updateJugadorFromApi(j, jugadorApi, pais, posicionMap);
                jugadorRepository.save(j);
                actualizados++;
            } else {
                // Crear nuevo jugador
                Jugador nuevo = createJugadorFromApi(jugadorApi, pais, posicionMap);
                jugadorRepository.save(nuevo);
                nuevos++;
            }
        }

        // Marcar equipo como sincronizado
        pais.setUltimoSync(LocalDateTime.now());
        paisRepository.save(pais);

        result.put("totalApi", apiSquad.size());
        result.put("nuevos", nuevos);
        result.put("actualizados", actualizados);
        result.put("totalEnBD", jugadorRepository.countByPaisInternalId(pais.getInternalId()));
        result.put("ultimoSync", pais.getUltimoSync().toString());

        log.info("Sync completado para {} ({}): {} nuevos, {} actualizados de {} en API",
                pais.getNombre(), codigoPais, nuevos, actualizados, apiSquad.size());

        return result;
    }

    /**
     * Sincroniza todos los equipos de una confederación.
     * Ejemplo: syncConfederacion("CONMEBOL") = 8 llamadas API.
     */
    public Map<String, Object> syncConfederacion(String confCodigo) {
        List<Pais> paises = paisRepository.findByConfederacionCodigoWithFetch(confCodigo.toUpperCase());
        List<Pais> conApiId = paises.stream()
                .filter(p -> p.getApiTeamId() != null && p.getActivo())
                .collect(Collectors.toList());

        Map<String, Object> resumen = new LinkedHashMap<>();
        resumen.put("confederacion", confCodigo);
        resumen.put("equipos", conApiId.size());

        List<Map<String, Object>> resultados = new ArrayList<>();
        int totalNuevos = 0;
        int totalActualizados = 0;
        int exitosos = 0;

        for (Pais p : conApiId) {
            Map<String, Object> r = syncTeam(p.getCodigo());
            resultados.add(r);
            if (!r.containsKey("error")) {
                exitosos++;
                totalNuevos += (int) r.getOrDefault("nuevos", 0);
                totalActualizados += (int) r.getOrDefault("actualizados", 0);
            }
            // Respetar rate limit: 10 requests/minuto en plan gratuito
            if (conApiId.indexOf(p) < conApiId.size() - 1) {
                try { Thread.sleep(7000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            }
        }

        resumen.put("exitosos", exitosos);
        resumen.put("totalNuevos", totalNuevos);
        resumen.put("totalActualizados", totalActualizados);
        resumen.put("llamadasApi", conApiId.size());
        resumen.put("detalle", resultados);

        return resumen;
    }

    /**
     * Retorna el estado de sincronización de todos los equipos.
     */
    public List<Map<String, Object>> getSyncStatus() {
        List<Pais> paises = paisRepository.findAllWithConfederacion();
        return paises.stream()
                .filter(p -> p.getActivo() && p.getApiTeamId() != null)
                .sorted(Comparator.comparing(p -> p.getConfederacion().getCodigo()))
                .map(p -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("codigo", p.getCodigo());
                    m.put("nombre", p.getNombre());
                    m.put("confederacion", p.getConfederacion().getCodigo());
                    m.put("apiTeamId", p.getApiTeamId());
                    m.put("sincronizado", p.getUltimoSync() != null);
                    m.put("ultimoSync", p.getUltimoSync() != null ? p.getUltimoSync().toString() : null);
                    m.put("jugadoresEnBD", jugadorRepository.countByPaisInternalId(p.getInternalId()));
                    return m;
                })
                .collect(Collectors.toList());
    }

    /**
     * Sincroniza los N equipos que más tiempo llevan sin sincronizar (o nunca sincronizados).
     * Útil para ir de a poco: syncNext(10) sincroniza 10 equipos con 10 API calls.
     */
    public Map<String, Object> syncNext(int cantidad) {
        List<Pais> paises = paisRepository.findAllWithConfederacion();

        // Priorizar: nunca sincronizados primero, luego los más antiguos
        List<Pais> toSync = paises.stream()
                .filter(p -> p.getActivo() && p.getApiTeamId() != null)
                .sorted(Comparator.comparing(
                        Pais::getUltimoSync,
                        Comparator.nullsFirst(Comparator.naturalOrder())))
                .limit(cantidad)
                .collect(Collectors.toList());

        Map<String, Object> resumen = new LinkedHashMap<>();
        resumen.put("solicitados", cantidad);
        resumen.put("disponibles", toSync.size());

        List<Map<String, Object>> resultados = new ArrayList<>();
        int exitosos = 0;

        for (Pais p : toSync) {
            Map<String, Object> r = syncTeam(p.getCodigo());
            resultados.add(r);
            if (!r.containsKey("error")) exitosos++;
            // Respetar rate limit: 10 requests/minuto en plan gratuito
            if (toSync.indexOf(p) < toSync.size() - 1) {
                try { Thread.sleep(7000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            }
        }

        resumen.put("exitosos", exitosos);
        resumen.put("llamadasApi", toSync.size());
        resumen.put("detalle", resultados);

        return resumen;
    }

    // ============== HELPERS PRIVADOS ==============

    private Map<String, PosicionJugador> getPosicionMap() {
        return posicionRepository.findAll().stream()
                .collect(Collectors.toMap(PosicionJugador::getCodigo, p -> p));
    }

    private Jugador createJugadorFromApi(JugadorSeleccionDTO dto, Pais pais, Map<String, PosicionJugador> posMap) {
        // Separar nombre completo en nombre y apellido
        String[] partes = splitName(dto.getNombreCompleto());

        PosicionJugador posicion = resolvePosicion(dto.getPosicionCodigo(), posMap);

        return Jugador.builder()
                .pais(pais)
                .posicion(posicion)
                .nombre(partes[0])
                .apellido(partes[1])
                .edad(dto.getEdad())
                .numeroCamiseta(dto.getNumeroCamiseta())
                .urlFoto(MEDIA_BASE + "/players/" + dto.getApiPlayerId() + ".png")
                .apiPlayerId(dto.getApiPlayerId())
                .build();
    }

    private void updateJugadorFromApi(Jugador j, JugadorSeleccionDTO dto, Pais pais, Map<String, PosicionJugador> posMap) {
        // Actualizar datos que pueden cambiar
        if (dto.getEdad() != null) j.setEdad(dto.getEdad());
        if (dto.getNumeroCamiseta() != null) j.setNumeroCamiseta(dto.getNumeroCamiseta());

        // Actualizar foto con URL de API
        j.setUrlFoto(MEDIA_BASE + "/players/" + dto.getApiPlayerId() + ".png");

        // Actualizar posición si cambió
        PosicionJugador posicion = resolvePosicion(dto.getPosicionCodigo(), posMap);
        if (posicion != null) j.setPosicion(posicion);

        // Asegurar que pertenece al país correcto
        j.setPais(pais);
    }

    private PosicionJugador resolvePosicion(String codigoPosicion, Map<String, PosicionJugador> posMap) {
        if (codigoPosicion == null) return posMap.getOrDefault("MED", posMap.values().iterator().next());
        return posMap.getOrDefault(codigoPosicion, posMap.getOrDefault("MED", posMap.values().iterator().next()));
    }

    private String[] splitName(String fullName) {
        if (fullName == null || fullName.isBlank()) return new String[]{"", ""};
        String trimmed = fullName.trim();
        int lastSpace = trimmed.lastIndexOf(' ');
        if (lastSpace < 0) return new String[]{trimmed, trimmed};
        return new String[]{trimmed.substring(0, lastSpace), trimmed.substring(lastSpace + 1)};
    }

    /**
     * Resync limpio: borra TODOS los jugadores del país y re-sincroniza desde cero
     * usando el squad actual de API-Football (no por competición).
     * Consume 1 llamada API.
     */
    @Transactional
    public Map<String, Object> resyncTeamClean(String codigoPais) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("codigo", codigoPais);

        Optional<Pais> paisOpt = paisRepository.findByCodigoWithConfederacion(codigoPais.toUpperCase());
        if (paisOpt.isEmpty()) {
            result.put("error", "País no encontrado: " + codigoPais);
            return result;
        }

        Pais pais = paisOpt.get();
        long prevCount = jugadorRepository.countByPaisInternalId(pais.getInternalId());
        result.put("nombre", pais.getNombre());
        result.put("jugadoresAntes", prevCount);

        // Eliminar todos los jugadores del país
        jugadorRepository.deleteByPaisInternalId(pais.getInternalId());
        jugadorRepository.flush();
        log.info("Resync limpio {}: eliminados {} jugadores", codigoPais, prevCount);

        // Resetear último sync
        pais.setUltimoSync(null);
        paisRepository.save(pais);

        // Re-sincronizar con squad actual
        Map<String, Object> syncResult = syncTeam(codigoPais);
        result.put("syncResult", syncResult);
        result.put("jugadoresDespues", jugadorRepository.countByPaisInternalId(pais.getInternalId()));

        return result;
    }

    // ============== NATIONALITY → PAIS MAPPING ==============

    private static final Map<String, String> NATIONALITY_TO_CODIGO = new HashMap<>();
    static {
        NATIONALITY_TO_CODIGO.put("Argentina", "ARG");
        NATIONALITY_TO_CODIGO.put("Brazil", "BRA");
        NATIONALITY_TO_CODIGO.put("Uruguay", "URU");
        NATIONALITY_TO_CODIGO.put("Colombia", "COL");
        NATIONALITY_TO_CODIGO.put("Ecuador", "ECU");
        NATIONALITY_TO_CODIGO.put("Paraguay", "PAR");
        NATIONALITY_TO_CODIGO.put("Chile", "CHI");
        NATIONALITY_TO_CODIGO.put("Peru", "PER");
        NATIONALITY_TO_CODIGO.put("Venezuela", "VEN");
        NATIONALITY_TO_CODIGO.put("Bolivia", "BOL");
    }

    /**
     * Enriquece jugadores de países específicos usando una liga/temporada como fuente.
     * Recorre TODAS las páginas de la API (1 call por página, 7s delay entre cada una).
     * Solo agrega jugadores que NO existen en BD (por api_player_id).
     *
     * Ejemplo: syncPlayersFromLeague(1, 2026, List.of("ARG","BRA","PAR","URU","COL","ECU"))
     *   → trae todos los jugadores del Mundial 2026 y filtra por nacionalidad.
     *
     * @param leagueId  ID de la liga en API-Football (1 = FIFA World Cup)
     * @param season    Temporada (2026 - Mundial 2026)
     * @param codigosPais  Códigos de países a enriquecer (ej: ["ARG","BRA","PAR"])
     * @return resumen con estadísticas del proceso
     */
    public Map<String, Object> syncPlayersFromLeague(int leagueId, int season, List<String> codigosPais, int maxPages) {
        Map<String, Object> resumen = new LinkedHashMap<>();
        resumen.put("leagueId", leagueId);
        resumen.put("season", season);
        resumen.put("paisesObjetivo", codigosPais);

        // Cargar países objetivo
        Map<String, Pais> paisMap = new LinkedHashMap<>();
        for (String codigo : codigosPais) {
            paisRepository.findByCodigo(codigo).ifPresent(p -> paisMap.put(codigo, p));
        }

        // Cargar posiciones
        Map<String, PosicionJugador> posMap = getPosicionMap();

        // Cargar api_player_ids existentes para no duplicar
        Set<Long> existingApiIds = jugadorRepository.findAll().stream()
                .filter(j -> j.getApiPlayerId() != null)
                .map(Jugador::getApiPlayerId)
                .collect(Collectors.toSet());

        int totalNuevos = 0;
        int totalPaginas = 0;
        int totalProcesados = 0;
        int totalDescartados = 0;
        Map<String, Integer> nuevosPorPais = new LinkedHashMap<>();
        for (String c : codigosPais) nuevosPorPais.put(c, 0);

        // Página 1 para saber cuántas páginas hay
        Map<String, Object> page1 = apiService.getPlayersByLeague(leagueId, season, 1);
        int totalPages = (int) page1.getOrDefault("totalPages", 0);
        resumen.put("totalPaginasAPI", totalPages);

        if (totalPages == 0) {
            resumen.put("error", "No se encontraron datos en la API para league=" + leagueId + " season=" + season);
            return resumen;
        }

        // Procesar páginas (limitar si maxPages > 0)
        int lastPage = (maxPages > 0) ? Math.min(totalPages, maxPages) : totalPages;
        for (int page = 1; page <= lastPage; page++) {
            Map<String, Object> pageData;
            if (page == 1) {
                pageData = page1; // Ya la tenemos
            } else {
                // Rate limit delay
                try { Thread.sleep(7000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); break; }
                pageData = apiService.getPlayersByLeague(leagueId, season, page);
            }

            @SuppressWarnings("unchecked")
            List<JugadorSeleccionDTO> players = (List<JugadorSeleccionDTO>) pageData.getOrDefault("players", List.of());
            totalPaginas++;

            for (JugadorSeleccionDTO dto : players) {
                totalProcesados++;

                // El campo clubNombre lo usamos para nationality temporalmente
                String nationality = dto.getClubNombre();
                String codigoPais = NATIONALITY_TO_CODIGO.get(nationality);

                // Filtrar: solo países objetivo
                if (codigoPais == null || !paisMap.containsKey(codigoPais)) {
                    totalDescartados++;
                    continue;
                }

                // Skip si ya existe
                if (dto.getApiPlayerId() != null && existingApiIds.contains(dto.getApiPlayerId())) {
                    continue;
                }

                // Crear jugador
                Pais pais = paisMap.get(codigoPais);
                Jugador nuevo = createJugadorFromApi(dto, pais, posMap);
                jugadorRepository.save(nuevo);
                existingApiIds.add(dto.getApiPlayerId());
                totalNuevos++;
                nuevosPorPais.merge(codigoPais, 1, (a, b) -> a + b);
            }

            log.info("Sync league={} page {}/{}: {} procesados, {} nuevos acumulados",
                    leagueId, page, totalPages, players.size(), totalNuevos);
        }

        resumen.put("paginasProcesadas", totalPaginas);
        resumen.put("jugadoresProcesados", totalProcesados);
        resumen.put("descartados", totalDescartados);
        resumen.put("nuevosInsertados", totalNuevos);
        resumen.put("nuevosPorPais", nuevosPorPais);

        // Totales actuales en BD
        Map<String, Long> totalesBD = new LinkedHashMap<>();
        for (Map.Entry<String, Pais> e : paisMap.entrySet()) {
            totalesBD.put(e.getKey(), jugadorRepository.countByPaisInternalId(e.getValue().getInternalId()));
        }
        resumen.put("totalEnBDPorPais", totalesBD);
        resumen.put("llamadasApi", totalPaginas);

        return resumen;
    }
}
