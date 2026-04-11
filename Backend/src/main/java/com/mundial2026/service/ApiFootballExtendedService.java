package com.mundial2026.service;

import com.mundial2026.config.ApiFootballConfig;
import com.mundial2026.dto.seleccion.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Servicio extendido para API-Football: equipos, planteles, venues, standings, DTs.
 * Las URLs de imágenes (logos, fotos de jugadores, estadios) son GRATIS y no cuentan en la cuota.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApiFootballExtendedService {

    private final ApiFootballConfig config;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Cache genérico
    private final ConcurrentHashMap<String, CacheEntry<?>> cache = new ConcurrentHashMap<>();

    private static final String MEDIA_BASE = "https://media.api-sports.io/football";
    private static final String FLAGS_BASE = "https://media.api-sports.io/flags";

    // ====================== TEAM INFO ======================

    /**
     * Obtiene info de un equipo (selección) por su API team ID.
     * Retorna nombre, logo, venue info.
     */
    public Optional<SeleccionDTO> getTeamInfo(long apiTeamId) {
        String cacheKey = "team_" + apiTeamId;
        CacheEntry<?> cached = cache.get(cacheKey);
        if (cached != null && !cached.isExpired(1440)) { // 24h cache
            return Optional.of((SeleccionDTO) cached.getData());
        }

        if (!hasApiKey()) return Optional.empty();

        try {
            String url = config.getBaseUrl() + "/teams?id=" + apiTeamId;
            String json = callApi(url);
            if (json == null) return Optional.empty();

            JsonNode root = objectMapper.readTree(json);
            JsonNode response = root.path("response");
            if (!response.isArray() || response.isEmpty()) return Optional.empty();

            JsonNode item = response.get(0);
            JsonNode team = item.path("team");
            JsonNode venue = item.path("venue");

            SeleccionDTO dto = SeleccionDTO.builder()
                    .apiTeamId(team.path("id").asLong())
                    .nombre(team.path("name").asText(""))
                    .codigo(team.path("code").asText(""))
                    .logoUrl(MEDIA_BASE + "/teams/" + apiTeamId + ".png")
                    .apiVenueId(venue.path("id").isNull() ? null : venue.path("id").asLong())
                    .estadioNombre(venue.path("name").asText(null))
                    .estadioCiudad(venue.path("city").asText(null))
                    .estadioCapacidad(venue.path("capacity").isNull() ? null : venue.path("capacity").asInt())
                    .estadioFotoUrl(venue.path("id").isNull() ? null :
                            MEDIA_BASE + "/venues/" + venue.path("id").asLong() + ".png")
                    .build();

            cache.put(cacheKey, new CacheEntry<>(dto));
            log.info("API-Football: Info de equipo {} obtenida", dto.getNombre());
            return Optional.of(dto);
        } catch (Exception e) {
            log.error("Error obteniendo info de equipo {}: {}", apiTeamId, e.getMessage());
        }
        return Optional.empty();
    }

    // ====================== SQUAD / PLANTEL ======================

    /**
     * Obtiene el plantel actual de un equipo por API team ID.
     * Endpoint: /players/squads?team={id}
     */
    public Optional<List<JugadorSeleccionDTO>> getSquad(long apiTeamId) {
        String cacheKey = "squad_" + apiTeamId;
        CacheEntry<?> cached = cache.get(cacheKey);
        if (cached != null && !cached.isExpired(1440)) { // 24h
            @SuppressWarnings("unchecked")
            List<JugadorSeleccionDTO> data = (List<JugadorSeleccionDTO>) cached.getData();
            return Optional.of(data);
        }

        if (!hasApiKey()) return Optional.empty();

        try {
            String url = config.getBaseUrl() + "/players/squads?team=" + apiTeamId;
            String json = callApi(url);
            if (json == null) return Optional.empty();

            JsonNode root = objectMapper.readTree(json);
            JsonNode response = root.path("response");
            if (!response.isArray() || response.isEmpty()) return Optional.empty();

            JsonNode players = response.get(0).path("players");
            List<JugadorSeleccionDTO> result = new ArrayList<>();

            if (players.isArray()) {
                for (JsonNode p : players) {
                    long playerId = p.path("id").asLong();
                    String posApi = p.path("position").asText("");

                    result.add(JugadorSeleccionDTO.builder()
                            .apiPlayerId(playerId)
                            .nombre(p.path("name").asText(""))
                            .nombreCompleto(p.path("name").asText(""))
                            .numeroCamiseta(p.path("number").isNull() ? null : p.path("number").asInt())
                            .edad(p.path("age").isNull() ? null : p.path("age").asInt())
                            .posicion(mapPosition(posApi))
                            .posicionCodigo(mapPositionCode(posApi))
                            .fotoUrl(MEDIA_BASE + "/players/" + playerId + ".png")
                            .build());
                }
            }

            cache.put(cacheKey, new CacheEntry<>(result));
            log.info("API-Football: Plantel de equipo {} con {} jugadores", apiTeamId, result.size());
            return Optional.of(result);
        } catch (Exception e) {
            log.error("Error obteniendo plantel de equipo {}: {}", apiTeamId, e.getMessage());
        }
        return Optional.empty();
    }

    // ====================== VENUE / ESTADIO ======================

    /**
     * Obtiene info detallada de un estadio por su ID.
     */
    public Optional<VenueDTO> getVenueInfo(long apiVenueId) {
        String cacheKey = "venue_" + apiVenueId;
        CacheEntry<?> cached = cache.get(cacheKey);
        if (cached != null && !cached.isExpired(1440)) {
            return Optional.of((VenueDTO) cached.getData());
        }

        if (!hasApiKey()) return Optional.empty();

        try {
            String url = config.getBaseUrl() + "/venues?id=" + apiVenueId;
            String json = callApi(url);
            if (json == null) return Optional.empty();

            JsonNode root = objectMapper.readTree(json);
            JsonNode response = root.path("response");
            if (!response.isArray() || response.isEmpty()) return Optional.empty();

            JsonNode v = response.get(0);
            VenueDTO dto = VenueDTO.builder()
                    .apiVenueId(v.path("id").asLong())
                    .nombre(v.path("name").asText(""))
                    .ciudad(v.path("city").asText(""))
                    .pais(v.path("country").asText(""))
                    .capacidad(v.path("capacity").isNull() ? null : v.path("capacity").asInt())
                    .superficie(v.path("surface").asText(null))
                    .fotoUrl(MEDIA_BASE + "/venues/" + apiVenueId + ".png")
                    .build();

            cache.put(cacheKey, new CacheEntry<>(dto));
            return Optional.of(dto);
        } catch (Exception e) {
            log.error("Error obteniendo venue {}: {}", apiVenueId, e.getMessage());
        }
        return Optional.empty();
    }

    /**
     * Busca un estadio por nombre (para mapear los venues del Mundial).
     */
    public Optional<VenueDTO> searchVenue(String name) {
        String cacheKey = "venue_search_" + name.toLowerCase().replace(" ", "_");
        CacheEntry<?> cached = cache.get(cacheKey);
        if (cached != null && !cached.isExpired(1440)) {
            return Optional.of((VenueDTO) cached.getData());
        }

        if (!hasApiKey()) return Optional.empty();

        try {
            String url = config.getBaseUrl() + "/venues?search=" + java.net.URLEncoder.encode(name, "UTF-8");
            String json = callApi(url);
            if (json == null) return Optional.empty();

            JsonNode root = objectMapper.readTree(json);
            JsonNode response = root.path("response");
            if (!response.isArray() || response.isEmpty()) return Optional.empty();

            JsonNode v = response.get(0);
            VenueDTO dto = VenueDTO.builder()
                    .apiVenueId(v.path("id").asLong())
                    .nombre(v.path("name").asText(""))
                    .ciudad(v.path("city").asText(""))
                    .pais(v.path("country").asText(""))
                    .capacidad(v.path("capacity").isNull() ? null : v.path("capacity").asInt())
                    .superficie(v.path("surface").asText(null))
                    .fotoUrl(MEDIA_BASE + "/venues/" + v.path("id").asLong() + ".png")
                    .build();

            cache.put(cacheKey, new CacheEntry<>(dto));
            return Optional.of(dto);
        } catch (Exception e) {
            log.error("Error buscando venue '{}': {}", name, e.getMessage());
        }
        return Optional.empty();
    }

    // ====================== STANDINGS ======================

    /**
     * Obtiene las posiciones/tabla del Mundial 2026.
     */
    public Optional<List<StandingsDTO>> getWorldCupStandings() {
        String cacheKey = "wc_standings_2026";
        CacheEntry<?> cached = cache.get(cacheKey);
        if (cached != null && !cached.isExpired(60)) { // 1h
            @SuppressWarnings("unchecked")
            List<StandingsDTO> data = (List<StandingsDTO>) cached.getData();
            return Optional.of(data);
        }

        if (!hasApiKey()) return Optional.empty();

        try {
            String url = config.getBaseUrl() + "/standings?league=" + config.getLeagueId()
                    + "&season=" + config.getSeason();
            String json = callApi(url);
            if (json == null) return Optional.empty();

            JsonNode root = objectMapper.readTree(json);
            JsonNode response = root.path("response");
            if (!response.isArray() || response.isEmpty()) return Optional.empty();

            JsonNode league = response.get(0).path("league");
            JsonNode standings = league.path("standings");

            List<StandingsDTO> result = new ArrayList<>();
            if (standings.isArray()) {
                char grupoChar = 'A';
                for (JsonNode group : standings) {
                    if (!group.isArray()) continue;
                    List<StandingsDTO.StandingEntry> entries = new ArrayList<>();
                    int pos = 1;
                    for (JsonNode row : group) {
                        long teamId = row.path("team").path("id").asLong();
                        JsonNode all = row.path("all");
                        entries.add(StandingsDTO.StandingEntry.builder()
                                .posicion(pos++)
                                .equipoNombre(row.path("team").path("name").asText(""))
                                .apiTeamId(teamId)
                                .logoUrl(MEDIA_BASE + "/teams/" + teamId + ".png")
                                .pj(all.path("played").asInt(0))
                                .pg(all.path("win").asInt(0))
                                .pe(all.path("draw").asInt(0))
                                .pp(all.path("lose").asInt(0))
                                .gf(all.path("goals").path("for").asInt(0))
                                .gc(all.path("goals").path("against").asInt(0))
                                .dg(row.path("goalsDiff").asInt(0))
                                .pts(row.path("points").asInt(0))
                                .forma(row.path("form").asText(""))
                                .build());
                    }
                    result.add(StandingsDTO.builder()
                            .grupo(String.valueOf(grupoChar++))
                            .posiciones(entries)
                            .build());
                }
            }

            cache.put(cacheKey, new CacheEntry<>(result));
            log.info("API-Football: Standings con {} grupos obtenidos", result.size());
            return Optional.of(result);
        } catch (Exception e) {
            log.error("Error obteniendo standings: {}", e.getMessage());
        }
        return Optional.empty();
    }

    // ====================== COACH / DT ======================

    /**
     * Obtiene el DT de un equipo.
     */
    public Optional<Map<String, String>> getCoach(long apiTeamId) {
        String cacheKey = "coach_" + apiTeamId;
        CacheEntry<?> cached = cache.get(cacheKey);
        if (cached != null && !cached.isExpired(1440)) {
            @SuppressWarnings("unchecked")
            Map<String, String> data = (Map<String, String>) cached.getData();
            return Optional.of(data);
        }

        if (!hasApiKey()) return Optional.empty();

        try {
            String url = config.getBaseUrl() + "/coachs?team=" + apiTeamId;
            String json = callApi(url);
            if (json == null) return Optional.empty();

            JsonNode root = objectMapper.readTree(json);
            JsonNode response = root.path("response");
            if (!response.isArray() || response.isEmpty()) return Optional.empty();

            // Tomamos el primer DT (el actual)
            JsonNode coach = response.get(0);
            long coachId = coach.path("id").asLong();
            Map<String, String> info = new HashMap<>();
            info.put("nombre", coach.path("name").asText(""));
            info.put("fotoUrl", MEDIA_BASE + "/coachs/" + coachId + ".png");
            info.put("nacionalidad", coach.path("nationality").asText(""));

            cache.put(cacheKey, new CacheEntry<>(info));
            return Optional.of(info);
        } catch (Exception e) {
            log.error("Error obteniendo DT del equipo {}: {}", apiTeamId, e.getMessage());
        }
        return Optional.empty();
    }

    // ====================== HELPERS ======================

    /**
     * Construye la URL de imagen de un equipo (no requiere API key).
     */
    public String getTeamLogoUrl(long apiTeamId) {
        return MEDIA_BASE + "/teams/" + apiTeamId + ".png";
    }

    public String getPlayerPhotoUrl(long apiPlayerId) {
        return MEDIA_BASE + "/players/" + apiPlayerId + ".png";
    }

    public String getVenuePhotoUrl(long apiVenueId) {
        return MEDIA_BASE + "/venues/" + apiVenueId + ".png";
    }

    public String getFlagUrl(String countryCode) {
        return FLAGS_BASE + "/" + countryCode.toLowerCase() + ".svg";
    }

    private boolean hasApiKey() {
        return config.getApiKey() != null && !config.getApiKey().isBlank();
    }

    private String callApi(String url) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("x-apisports-key", config.getApiKey());
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

            ResponseEntity<String> resp = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), String.class);

            if (resp.getStatusCode().is2xxSuccessful()) {
                return resp.getBody();
            }
        } catch (Exception e) {
            log.error("Error en llamada a API-Football {}: {}", url, e.getMessage());
        }
        return null;
    }

    private String mapPosition(String apiPos) {
        return switch (apiPos) {
            case "Goalkeeper" -> "Arquero";
            case "Defender" -> "Defensa";
            case "Midfielder" -> "Mediocampista";
            case "Attacker" -> "Delantero";
            default -> apiPos;
        };
    }

    private String mapPositionCode(String apiPos) {
        return switch (apiPos) {
            case "Goalkeeper" -> "ARQ";
            case "Defender" -> "DEF";
            case "Midfielder" -> "MED";
            case "Attacker" -> "DEL";
            default -> "MED";
        };
    }

    /**
     * Obtiene jugadores de una liga/temporada con paginación.
     * Cada página = 1 API call. Retorna lista de DTOs con nacionalidad.
     * @return mapa con "players" (lista), "totalPages" (int), "currentPage" (int)
     */
    public Map<String, Object> getPlayersByLeague(int leagueId, int season, int page) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("currentPage", page);
        result.put("totalPages", 0);
        result.put("players", new ArrayList<>());

        if (!hasApiKey()) return result;

        try {
            String url = config.getBaseUrl() + "/players?league=" + leagueId + "&season=" + season + "&page=" + page;
            String json = callApi(url);
            if (json == null) return result;

            JsonNode root = objectMapper.readTree(json);

            // Check for errors
            JsonNode errors = root.path("errors");
            if (errors.isObject() && errors.size() > 0) {
                log.warn("API-Football error en players league={} season={}: {}", leagueId, season, errors);
                return result;
            }

            result.put("totalPages", root.path("paging").path("total").asInt(0));

            JsonNode response = root.path("response");
            if (!response.isArray()) return result;

            List<JugadorSeleccionDTO> players = new ArrayList<>();
            for (JsonNode item : response) {
                JsonNode pl = item.path("player");
                JsonNode stats = item.path("statistics");
                JsonNode firstStat = stats.isArray() && !stats.isEmpty() ? stats.get(0) : null;

                long playerId = pl.path("id").asLong();
                String posApi = firstStat != null ? firstStat.path("games").path("position").asText("") : "";
                String nationality = pl.path("nationality").asText("");
                Integer number = firstStat != null && !firstStat.path("games").path("number").isNull()
                        ? firstStat.path("games").path("number").asInt() : null;

                String firstName = pl.path("firstname").asText("");
                String lastName = pl.path("lastname").asText("");
                String fullName = pl.path("name").asText("");

                JugadorSeleccionDTO dto = JugadorSeleccionDTO.builder()
                        .apiPlayerId(playerId)
                        .nombre(firstName.isEmpty() ? fullName : firstName)
                        .apellido(lastName)
                        .nombreCompleto(fullName)
                        .numeroCamiseta(number)
                        .edad(pl.path("age").isNull() ? null : pl.path("age").asInt())
                        .posicion(mapPosition(posApi))
                        .posicionCodigo(mapPositionCode(posApi))
                        .fotoUrl(MEDIA_BASE + "/players/" + playerId + ".png")
                        .clubNombre(nationality) // Reutilizamos este campo para nationality
                        .build();

                players.add(dto);
            }
            result.put("players", players);

            log.info("API-Football: Página {}/{} de league={} season={}: {} jugadores",
                    page, result.get("totalPages"), leagueId, season, players.size());
        } catch (Exception e) {
            log.error("Error obteniendo players league={} season={} page={}: {}",
                    leagueId, season, page, e.getMessage());
        }
        return result;
    }

    public void clearCache() {
        cache.clear();
        log.info("Cache extendido limpiado");
    }

    // Inner class
    private static class CacheEntry<T> {
        private final T data;
        private final long timestamp;

        CacheEntry(T data) {
            this.data = data;
            this.timestamp = System.currentTimeMillis();
        }

        T getData() { return data; }

        boolean isExpired(long ttlMinutes) {
            return (System.currentTimeMillis() - timestamp) > (ttlMinutes * 60 * 1000);
        }
    }
}
