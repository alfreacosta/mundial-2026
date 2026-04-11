package com.mundial2026.controller;

import com.mundial2026.model.Jugador;
import com.mundial2026.repository.JugadorRepository;
import com.mundial2026.config.ApiFootballConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Endpoint de estadísticas de jugador con cache-aside en BD.
 * Primera consulta: llama API-Football y guarda en jugador.stats_json.
 * Consultas siguientes (dentro de 7 días): devuelve desde BD sin llamar API.
 */
@RestController
@RequestMapping("/api/jugadores")
@RequiredArgsConstructor
public class JugadorStatsController {

    private static final Logger log = LoggerFactory.getLogger(JugadorStatsController.class);
    private static final int CACHE_DAYS = 7;

    private final JugadorRepository jugadorRepository;
    private final ApiFootballConfig apiConfig;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @GetMapping("/{id}/stats")
    public ResponseEntity<Map<String, Object>> getStats(@PathVariable Long id) {
        Jugador jugador = jugadorRepository.findById(id).orElse(null);
        if (jugador == null) {
            return ResponseEntity.notFound().build();
        }

        // Cache hit: stats existentes y vigentes (menos de 7 días)
        if (jugador.getStatsJson() != null && jugador.getUltimaStatsSync() != null
                && jugador.getUltimaStatsSync().isAfter(LocalDateTime.now().minusDays(CACHE_DAYS))) {
            try {
                JsonNode cached = objectMapper.readTree(jugador.getStatsJson());
                return ResponseEntity.ok(Map.of("stats", cached, "cached", true,
                        "syncDate", jugador.getUltimaStatsSync().toString()));
            } catch (Exception e) {
                log.warn("Error leyendo stats cacheadas para jugador {}: {}", id, e.getMessage());
            }
        }

        // Cache miss: llamar API
        if (jugador.getApiPlayerId() == null) {
            return ResponseEntity.ok(Map.of("stats", Map.of(), "cached", false, "message", "Sin api_player_id"));
        }

        try {
            String url = apiConfig.getBaseUrl() + "/players?id=" + jugador.getApiPlayerId() + "&season=2025";
            HttpHeaders headers = new HttpHeaders();
            headers.set("x-apisports-key", apiConfig.getApiKey());
            HttpEntity<Void> req = new HttpEntity<>(headers);

            ResponseEntity<JsonNode> resp = restTemplate.exchange(url, HttpMethod.GET, req, JsonNode.class);

            JsonNode body = resp.getBody();
            if (body == null || !body.has("response") || body.get("response").isEmpty()) {
                return ResponseEntity.ok(Map.of("stats", Map.of(), "cached", false, "message", "Sin datos en API"));
            }

            JsonNode playerData = body.get("response").get(0);
            JsonNode statsArr   = playerData.get("statistics");
            JsonNode player     = playerData.get("player");

            // Construir objeto compacto con los datos más útiles
            ObjectNode compact = objectMapper.createObjectNode();

            if (player != null) {
                compact.put("altura",    player.path("height").asText(""));
                compact.put("peso",      player.path("weight").asText(""));
                compact.put("nacimiento", player.path("birth").path("date").asText(""));
                compact.put("lugar_nacimiento", player.path("birth").path("place").asText(""));
                compact.put("nacionalidad", player.path("nationality").asText(""));
            }

            if (statsArr != null && !statsArr.isEmpty()) {
                // Buscar stats de liga principal (la primera disponible)
                JsonNode s = statsArr.get(0);
                compact.put("club",         s.path("team").path("name").asText(""));
                compact.put("club_logo",    s.path("team").path("logo").asText(""));
                compact.put("liga",         s.path("league").path("name").asText(""));
                compact.put("temporada",    s.path("league").path("season").asText(""));
                compact.put("partidos",     s.path("games").path("appearences").asInt(0));
                compact.put("minutos",      s.path("games").path("minutes").asInt(0));
                compact.put("rating",       s.path("games").path("rating").asText(""));
                compact.put("goles",        s.path("goals").path("total").asInt(0));
                compact.put("asistencias",  s.path("goals").path("assists").asInt(0));
                compact.put("disparos",     s.path("shots").path("total").asInt(0));
                compact.put("disparos_arco", s.path("shots").path("on").asInt(0));
                compact.put("pases_clave",  s.path("passes").path("key").asInt(0));
                compact.put("regates_ok",   s.path("dribbles").path("success").asInt(0));
                compact.put("regates_int",  s.path("dribbles").path("attempts").asInt(0));
                compact.put("amarillas",    s.path("cards").path("yellow").asInt(0));
                compact.put("rojas",        s.path("cards").path("red").asInt(0));
            }

            String json = objectMapper.writeValueAsString(compact);
            jugador.setStatsJson(json);
            jugador.setUltimaStatsSync(LocalDateTime.now());
            jugadorRepository.save(jugador);

            log.info("Stats cacheadas para jugador {} (api_id={})", id, jugador.getApiPlayerId());
            return ResponseEntity.ok(Map.of("stats", compact, "cached", false,
                    "syncDate", jugador.getUltimaStatsSync().toString()));

        } catch (Exception e) {
            log.error("Error obteniendo stats para jugador {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error al obtener estadísticas"));
        }
    }
}
