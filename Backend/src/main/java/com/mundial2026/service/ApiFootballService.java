package com.mundial2026.service;

import com.mundial2026.config.ApiFootballConfig;
import com.mundial2026.dto.fixture.FixtureDTO;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Servicio para consumir la API de API-Football (api-sports.io)
 * Incluye cache en memoria y fallback a datos locales de la BD
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApiFootballService {

    private final ApiFootballConfig config;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Cache en memoria: key -> (timestamp, data)
    private final ConcurrentHashMap<String, CacheEntry<List<FixtureDTO>>> cache = new ConcurrentHashMap<>();

    /**
     * Obtiene fixtures del Mundial 2026 desde API-Football
     * League ID 1 = FIFA World Cup
     */
    public Optional<List<FixtureDTO>> getWorldCupFixtures() {
        String cacheKey = "wc2026_fixtures";
        CacheEntry<List<FixtureDTO>> cached = cache.get(cacheKey);
        if (cached != null && !cached.isExpired(config.getCacheTtlMinutes())) {
            log.debug("Retornando fixtures de World Cup desde cache");
            return Optional.of(cached.getData());
        }

        if (config.getApiKey() == null || config.getApiKey().isBlank()) {
            log.warn("API-Football: No hay API key configurada, usando datos locales");
            return Optional.empty();
        }

        try {
            String url = config.getBaseUrl() + "/fixtures?league=" + config.getLeagueId()
                    + "&season=" + config.getSeason();

            HttpHeaders headers = new HttpHeaders();
            headers.set("x-apisports-key", config.getApiKey());
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                List<FixtureDTO> fixtures = parseFixturesResponse(response.getBody(), "MUNDIAL");
                cache.put(cacheKey, new CacheEntry<>(fixtures));
                log.info("API-Football: {} fixtures del Mundial obtenidos", fixtures.size());
                return Optional.of(fixtures);
            }
        } catch (Exception e) {
            log.error("Error consultando API-Football para World Cup: {}", e.getMessage());
        }
        return Optional.empty();
    }

    /**
     * Obtiene amistosos internacionales recientes
     * League ID 5 = Friendlies
     */
    public Optional<List<FixtureDTO>> getFriendlyFixtures() {
        String cacheKey = "friendlies_2026";
        CacheEntry<List<FixtureDTO>> cached = cache.get(cacheKey);
        if (cached != null && !cached.isExpired(config.getCacheTtlMinutes())) {
            log.debug("Retornando amistosos desde cache");
            return Optional.of(cached.getData());
        }

        if (config.getApiKey() == null || config.getApiKey().isBlank()) {
            log.warn("API-Football: No hay API key, usando datos locales para amistosos");
            return Optional.empty();
        }

        try {
            // League 5 = International Friendlies
            String url = config.getBaseUrl() + "/fixtures?league=5&season=2026";

            HttpHeaders headers = new HttpHeaders();
            headers.set("x-apisports-key", config.getApiKey());
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                List<FixtureDTO> fixtures = parseFixturesResponse(response.getBody(), "AMISTOSO");
                cache.put(cacheKey, new CacheEntry<>(fixtures));
                log.info("API-Football: {} amistosos obtenidos", fixtures.size());
                return Optional.of(fixtures);
            }
        } catch (Exception e) {
            log.error("Error consultando API-Football para amistosos: {}", e.getMessage());
        }
        return Optional.empty();
    }

    /**
     * Obtiene partidos en vivo del Mundial
     */
    public Optional<List<FixtureDTO>> getLiveFixtures() {
        String cacheKey = "live_fixtures";
        CacheEntry<List<FixtureDTO>> cached = cache.get(cacheKey);
        // Cache más corto para en vivo: 1 minuto
        if (cached != null && !cached.isExpired(1)) {
            return Optional.of(cached.getData());
        }

        if (config.getApiKey() == null || config.getApiKey().isBlank()) {
            return Optional.empty();
        }

        try {
            String url = config.getBaseUrl() + "/fixtures?live=all&league=" + config.getLeagueId();

            HttpHeaders headers = new HttpHeaders();
            headers.set("x-apisports-key", config.getApiKey());
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                List<FixtureDTO> fixtures = parseFixturesResponse(response.getBody(), "MUNDIAL");
                cache.put(cacheKey, new CacheEntry<>(fixtures));
                return Optional.of(fixtures);
            }
        } catch (Exception e) {
            log.error("Error consultando fixtures en vivo: {}", e.getMessage());
        }
        return Optional.empty();
    }

    /**
     * Parsea la respuesta JSON de API-Football a lista de FixtureDTO
     */
    private List<FixtureDTO> parseFixturesResponse(String json, String tipoPartido) {
        List<FixtureDTO> result = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode fixtures = root.path("response");

            if (fixtures.isArray()) {
                for (JsonNode fix : fixtures) {
                    try {
                        FixtureDTO dto = parseOneFixture(fix, tipoPartido);
                        if (dto != null) result.add(dto);
                    } catch (Exception e) {
                        log.debug("Error parseando fixture individual: {}", e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error parseando respuesta de API-Football: {}", e.getMessage());
        }
        return result;
    }

    private FixtureDTO parseOneFixture(JsonNode fix, String tipoPartido) {
        JsonNode fixtureNode = fix.path("fixture");
        JsonNode leagueNode = fix.path("league");
        JsonNode teamsNode = fix.path("teams");
        JsonNode goalsNode = fix.path("goals");

        // Fecha
        String dateStr = fixtureNode.path("date").asText("");
        LocalDateTime fechaHora;
        try {
            fechaHora = LocalDateTime.parse(dateStr, DateTimeFormatter.ISO_DATE_TIME);
        } catch (Exception e) {
            long timestamp = fixtureNode.path("timestamp").asLong(0);
            fechaHora = LocalDateTime.ofInstant(Instant.ofEpochSecond(timestamp), ZoneId.systemDefault());
        }

        // Estado del partido
        String statusShort = fixtureNode.path("status").path("short").asText("NS");
        String estado = mapStatus(statusShort);

        // Minuto actual
        Integer minuto = null;
        if (!fixtureNode.path("status").path("elapsed").isNull()) {
            minuto = fixtureNode.path("status").path("elapsed").asInt();
        }

        // Fase/Round
        String round = leagueNode.path("round").asText("");
        String faseCodigo = mapRound(round);
        String grupo = extractGroup(round);

        return FixtureDTO.builder()
                .apiExternalId(fixtureNode.path("id").asLong())
                .equipoLocalNombre(teamsNode.path("home").path("name").asText(""))
                .equipoLocalCodigo("")
                .equipoVisitanteNombre(teamsNode.path("away").path("name").asText(""))
                .equipoVisitanteCodigo("")
                .golLocal(goalsNode.path("home").isNull() ? null : goalsNode.path("home").asInt())
                .golVisitante(goalsNode.path("away").isNull() ? null : goalsNode.path("away").asInt())
                .fechaHora(fechaHora)
                .estadio(fixtureNode.path("venue").path("name").asText(""))
                .ciudad(fixtureNode.path("venue").path("city").asText(""))
                .estado(estado)
                .minuto(minuto)
                .faseNombre(round)
                .faseCodigo(faseCodigo)
                .grupo(grupo)
                .tipoPartido(tipoPartido)
                .build();
    }

    private String mapStatus(String apiStatus) {
        return switch (apiStatus) {
            case "NS", "TBD" -> "PENDIENTE";
            case "1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE" -> "EN_CURSO";
            case "FT", "AET", "PEN" -> "FINALIZADO";
            default -> "PENDIENTE";
        };
    }

    private String mapRound(String round) {
        if (round == null) return "GRUPOS";
        String lower = round.toLowerCase();
        if (lower.contains("group")) return "GRUPOS";
        if (lower.contains("round of 32")) return "TREINTAIDOSAVOS";
        if (lower.contains("round of 16")) return "OCTAVOS";
        if (lower.contains("quarter")) return "CUARTOS";
        if (lower.contains("semi")) return "SEMIFINAL";
        if (lower.contains("3rd") || lower.contains("third")) return "TERCER_PUESTO";
        if (lower.contains("final") && !lower.contains("semi") && !lower.contains("quarter")) return "FINAL";
        return "GRUPOS";
    }

    private String extractGroup(String round) {
        if (round != null && round.toLowerCase().contains("group")) {
            // "Group A - 1" → "A"
            String cleaned = round.replaceAll("(?i)group\\s*", "").trim();
            if (!cleaned.isEmpty()) {
                return String.valueOf(cleaned.charAt(0));
            }
        }
        return null;
    }

    /**
     * Limpia el cache manualmente (útil para forzar refresh)
     */
    public void clearCache() {
        cache.clear();
        log.info("Cache de API-Football limpiado");
    }

    // Inner class para cache entry
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
