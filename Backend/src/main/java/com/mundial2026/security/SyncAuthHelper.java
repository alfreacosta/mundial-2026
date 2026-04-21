package com.mundial2026.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Centraliza la validación de la API key de administrador (X-Sync-Key).
 * Usado por FixtureController y SyncController para evitar duplicar lógica de seguridad.
 */
@Component
public class SyncAuthHelper {

    @Value("${app.sync.api-key:}")
    private String syncApiKey;

    /**
     * Devuelve true si el request está autorizado.
     * En dev (sin key configurada) siempre permite; en prod requiere la key exacta.
     */
    public boolean isAuthorized(String providedKey) {
        if (syncApiKey == null || syncApiKey.isBlank()) {
            return true;
        }
        return syncApiKey.equals(providedKey);
    }
}
