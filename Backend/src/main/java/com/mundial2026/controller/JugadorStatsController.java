package com.mundial2026.controller;

import com.mundial2026.model.Jugador;
import com.mundial2026.dto.JugadorBusquedaDTO;
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
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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
        Jugador jugador = jugadorRepository.findByIdWithClub(id).orElse(null);
        if (jugador == null) {
            return ResponseEntity.notFound().build();
        }

        // 1) Si hay stats_json en BD → retornar siempre, independientemente del vencimiento
        if (jugador.getStatsJson() != null && !jugador.getStatsJson().isBlank()) {
            try {
                ObjectNode merged = (ObjectNode) objectMapper.readTree(jugador.getStatsJson());
                enrichWithEntityFields(merged, jugador);
                boolean vigente = jugador.getUltimaStatsSync() != null
                        && jugador.getUltimaStatsSync().isAfter(LocalDateTime.now().minusDays(CACHE_DAYS));
                return ResponseEntity.ok(Map.of("stats", merged, "cached", vigente,
                        "syncDate", jugador.getUltimaStatsSync() != null ? jugador.getUltimaStatsSync().toString() : ""));
            } catch (Exception e) {
                log.warn("Error leyendo stats cacheadas para jugador {}: {}", id, e.getMessage());
            }
        }

        // 2) Sin stats_json: construir respuesta solo con los campos de la entidad Jugador
        ObjectNode fromEntity = buildFromEntity(jugador);
        boolean hasEntityData = jugador.getFechaNacimiento() != null || jugador.getRating() != null
                || jugador.getPartidosTemporada() != null || jugador.getClub() != null;

        // 3) Si hay api_player_id y el cache está vacío/expirado, intentar API
        if (jugador.getApiPlayerId() != null) {
            try {
                String url = apiConfig.getBaseUrl() + "/players?id=" + jugador.getApiPlayerId() + "&season=2025";
                HttpHeaders headers = new HttpHeaders();
                headers.set("x-apisports-key", apiConfig.getApiKey());
                HttpEntity<Void> req = new HttpEntity<>(headers);

                ResponseEntity<JsonNode> resp = restTemplate.exchange(url, HttpMethod.GET, req, JsonNode.class);

                JsonNode body = resp.getBody();
                if (body != null && body.has("response") && !body.get("response").isEmpty()) {
                    JsonNode playerData = body.get("response").get(0);
                    JsonNode statsArr   = playerData.get("statistics");
                    JsonNode player     = playerData.get("player");

                    ObjectNode compact = objectMapper.createObjectNode();

                    if (player != null) {
                        compact.put("altura",           player.path("height").asText(""));
                        compact.put("peso",             player.path("weight").asText(""));
                        compact.put("nacimiento",       player.path("birth").path("date").asText(""));
                        compact.put("lugar_nacimiento", player.path("birth").path("place").asText(""));
                        compact.put("nacionalidad",     player.path("nationality").asText(""));
                    }

                    if (statsArr != null && !statsArr.isEmpty()) {
                        JsonNode s = statsArr.get(0);
                        compact.put("club",          s.path("team").path("name").asText(""));
                        compact.put("club_logo",     s.path("team").path("logo").asText(""));
                        compact.put("liga",          s.path("league").path("name").asText(""));
                        compact.put("temporada",     s.path("league").path("season").asText(""));
                        compact.put("partidos",      s.path("games").path("appearences").asInt(0));
                        compact.put("minutos",       s.path("games").path("minutes").asInt(0));
                        compact.put("rating",        s.path("games").path("rating").asText(""));
                        compact.put("goles",         s.path("goals").path("total").asInt(0));
                        compact.put("asistencias",   s.path("goals").path("assists").asInt(0));
                        compact.put("disparos",      s.path("shots").path("total").asInt(0));
                        compact.put("disparos_arco", s.path("shots").path("on").asInt(0));
                        compact.put("pases_clave",   s.path("passes").path("key").asInt(0));
                        compact.put("regates_ok",    s.path("dribbles").path("success").asInt(0));
                        compact.put("regates_int",   s.path("dribbles").path("attempts").asInt(0));
                        compact.put("amarillas",     s.path("cards").path("yellow").asInt(0));
                        compact.put("rojas",         s.path("cards").path("red").asInt(0));
                    }

                    enrichWithEntityFields(compact, jugador);
                    String json = objectMapper.writeValueAsString(compact);
                    jugador.setStatsJson(json);
                    jugador.setUltimaStatsSync(LocalDateTime.now());
                    jugadorRepository.save(jugador);
                    log.info("Stats sincronizadas desde API para jugador {}", id);
                    return ResponseEntity.ok(Map.of("stats", compact, "cached", false,
                            "syncDate", jugador.getUltimaStatsSync().toString()));
                }
            } catch (Exception e) {
                log.warn("Error obteniendo stats desde API para jugador {}: {}", id, e.getMessage());
            }
        }

        // 4) Fallback: devolver lo que tengamos de la entidad
        if (hasEntityData) {
            return ResponseEntity.ok(Map.of("stats", fromEntity, "cached", false, "message", "Datos locales"));
        }

        return ResponseEntity.ok(Map.of("stats", Map.of(), "cached", false, "message", "Sin estadísticas disponibles"));
    }

    /** Agrega campos directos de la entidad Jugador al nodo JSON (si no están ya presentes). */
    private void enrichWithEntityFields(ObjectNode node, Jugador jugador) {
        if (jugador.getFechaNacimiento() != null && !node.has("nacimiento")) {
            node.put("nacimiento", jugador.getFechaNacimiento().toString());
        }
        if (jugador.getEdad() != null && !node.has("edad")) {
            node.put("edad", jugador.getEdad());
        }
        if (jugador.getRating() != null && (!node.has("rating") || node.path("rating").asText("").isBlank())) {
            node.put("rating", jugador.getRating().toString());
        }
        if (jugador.getPartidosTemporada() != null && !node.has("partidos")) {
            node.put("partidos", jugador.getPartidosTemporada());
        }
        if (jugador.getClub() != null) {
            if (!node.has("club") || node.path("club").asText("").isBlank()) {
                node.put("club", jugador.getClub().getNombre());
            }
        }
        if (jugador.getNumeroCamiseta() != null && !node.has("camiseta")) {
            node.put("camiseta", jugador.getNumeroCamiseta());
        }
    }

    /** Construye un ObjectNode a partir únicamente de los campos de la entidad Jugador. */
    private ObjectNode buildFromEntity(Jugador jugador) {
        ObjectNode n = objectMapper.createObjectNode();
        if (jugador.getFechaNacimiento() != null) n.put("nacimiento", jugador.getFechaNacimiento().toString());
        if (jugador.getEdad()            != null) n.put("edad",       jugador.getEdad());
        if (jugador.getRating()          != null) n.put("rating",     jugador.getRating().toString());
        if (jugador.getPartidosTemporada() != null) n.put("partidos", jugador.getPartidosTemporada());
        if (jugador.getClub()            != null) n.put("club",       jugador.getClub().getNombre());
        if (jugador.getNumeroCamiseta()  != null) n.put("camiseta",   jugador.getNumeroCamiseta());
        return n;
    }

    /**
     * Búsqueda de jugadores por nombre (palabras separadas, con unaccent).
     * GET /api/jugadores/buscar?q=ceci domi&limit=50
     */
    @GetMapping("/buscar")
    public ResponseEntity<List<JugadorBusquedaDTO>> buscar(
            @RequestParam("q") String q,
            @RequestParam(value = "limit", defaultValue = "50") int limit) {

        if (q == null || q.trim().length() < 3) {
            return ResponseEntity.ok(List.of());
        }

        // Limitar a un máximo de 100
        int lim = Math.min(Math.max(limit, 1), 100);

        // Separar en palabras y armar los patrones %word%
        String[] words = q.trim().toLowerCase().split("\\s+");
        String word1 = words.length >= 1 ? "%" + words[0] + "%" : null;
        String word2 = words.length >= 2 ? "%" + words[1] + "%" : null;
        String word3 = words.length >= 3 ? "%" + words[2] + "%" : null;

        List<Object[]> rows = jugadorRepository.buscarPorPalabras(word1, word2, word3, lim);

        List<JugadorBusquedaDTO> result = rows.stream().map(r ->
            JugadorBusquedaDTO.builder()
                .internalId(((Number) r[0]).longValue())
                .nombre((String) r[1])
                .apellido((String) r[2])
                .nombreCompleto((String) r[3])
                .urlFoto((String) r[4])
                .posicionCodigo((String) r[5])
                .paisNombre((String) r[6])
                .paisCodigo((String) r[7])
                .clubNombre((String) r[8])
                .build()
        ).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }
}
