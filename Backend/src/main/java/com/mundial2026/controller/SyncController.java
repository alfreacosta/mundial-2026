package com.mundial2026.controller;

import com.mundial2026.security.SyncAuthHelper;
import com.mundial2026.service.SyncService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Endpoints de sincronización con API-Football.
 * Protegidos con API key de administrador (header X-Sync-Key).
 * En desarrollo sin key configurada, se permite acceso con autenticación JWT.
 */
@RestController
@RequestMapping("/api/sync")
@RequiredArgsConstructor
public class SyncController {

    private static final Logger log = LoggerFactory.getLogger(SyncController.class);
    private final SyncService   syncService;
    private final SyncAuthHelper syncAuthHelper;

    /**
     * Sincroniza UN equipo específico (1 API call).
     * Ejemplo: POST /api/sync/team/ARG
     */
    @PostMapping("/team/{codigo}")
    public ResponseEntity<Map<String, Object>> syncTeam(
            @PathVariable String codigo,
            @RequestHeader(value = "X-Sync-Key", required = false) String key) {
        if (!syncAuthHelper.isAuthorized(key)) {
            log.warn("SECURITY: Acceso no autorizado a sync/team/{}", codigo);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "No autorizado"));
        }
        return ResponseEntity.ok(syncService.syncTeam(codigo.toUpperCase()));
    }

    /**
     * Sincroniza todos los equipos de una confederación.
     * Ejemplo: POST /api/sync/confederacion/CONMEBOL (8 API calls)
     */
    @PostMapping("/confederacion/{codigo}")
    public ResponseEntity<Map<String, Object>> syncConfederacion(
            @PathVariable String codigo,
            @RequestHeader(value = "X-Sync-Key", required = false) String key) {
        if (!syncAuthHelper.isAuthorized(key)) {
            log.warn("SECURITY: Acceso no autorizado a sync/confederacion/{}", codigo);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "No autorizado"));
        }
        return ResponseEntity.ok(syncService.syncConfederacion(codigo.toUpperCase()));
    }

    /**
     * Sincroniza los N equipos que más necesitan actualización.
     * Prioriza los que nunca fueron sincronizados, luego los más antiguos.
     * Ejemplo: POST /api/sync/next/10 (10 API calls)
     */
    @PostMapping("/next/{cantidad}")
    public ResponseEntity<Map<String, Object>> syncNext(
            @PathVariable int cantidad,
            @RequestHeader(value = "X-Sync-Key", required = false) String key) {
        if (!syncAuthHelper.isAuthorized(key)) {
            log.warn("SECURITY: Acceso no autorizado a sync/next/{}", cantidad);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "No autorizado"));
        }
        if (cantidad < 1 || cantidad > 48) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cantidad debe ser entre 1 y 48"));
        }
        return ResponseEntity.ok(syncService.syncNext(cantidad));
    }

    /**
     * Resync limpio: borra todos los jugadores del país y re-descarga el squad actual.
     * No usa competición, usa el plantel actual de la selección.
     * Ejemplo: POST /api/sync/resync/COL
     */
    @PostMapping("/resync/{codigo}")
    public ResponseEntity<Map<String, Object>> resyncTeamClean(
            @PathVariable String codigo,
            @RequestHeader(value = "X-Sync-Key", required = false) String key) {
        if (!syncAuthHelper.isAuthorized(key)) {
            log.warn("SECURITY: Acceso no autorizado a sync/resync/{}", codigo);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "No autorizado"));
        }
        return ResponseEntity.ok(syncService.resyncTeamClean(codigo.toUpperCase()));
    }

    /**
     * Estado de sincronización de todos los equipos.
     * Muestra: código, nombre, confederación, si está sincronizado, última fecha, jugadores en BD.
     */
    @GetMapping("/status")
    public ResponseEntity<?> getSyncStatus(
            @RequestHeader(value = "X-Sync-Key", required = false) String key) {
        if (!syncAuthHelper.isAuthorized(key)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "No autorizado"));
        }
        return ResponseEntity.ok(syncService.getSyncStatus());
    }

    /**
     * Enriquece jugadores de países específicos usando datos de una liga de la API.
     * Recorre todas las páginas; solo agrega jugadores que no existen en BD.
     *
     * Ejemplo: POST /api/sync/enrich/league/1/season/2026?paises=ARG,BRA,COL,URU,ECU,PAR
     *   → Mundial 2026 (league=1, season=2026), filtra por nacionalidad
     */
    @PostMapping("/enrich/league/{leagueId}/season/{season}")
    public ResponseEntity<Map<String, Object>> syncFromLeague(
            @PathVariable int leagueId,
            @PathVariable int season,
            @RequestParam(defaultValue = "ARG,BRA,PAR,URU,COL,ECU") String paises,
            @RequestParam(defaultValue = "0") int maxPages,
            @RequestHeader(value = "X-Sync-Key", required = false) String key) {
        if (!syncAuthHelper.isAuthorized(key)) {
            log.warn("SECURITY: Acceso no autorizado a sync/enrich");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "No autorizado"));
        }
        List<String> codigosPais = List.of(paises.toUpperCase().split(","));
        return ResponseEntity.ok(syncService.syncPlayersFromLeague(leagueId, season, codigosPais, maxPages));
    }
}
