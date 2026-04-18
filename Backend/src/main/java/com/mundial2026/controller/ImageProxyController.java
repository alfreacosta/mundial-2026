package com.mundial2026.controller;

import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.time.Duration;

/**
 * Proxy de imágenes para media.api-sports.io.
 * Las imágenes de esa CDN devuelven 403 cuando el navegador las pide directamente,
 * así que este endpoint las descarga server-side y las sirve al frontend.
 */
@RestController
@RequestMapping("/api/images")
public class ImageProxyController {

    private static final String ALLOWED_HOST = "media.api-sports.io";
    private final RestTemplate restTemplate;

    public ImageProxyController() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(10000);
        this.restTemplate = new RestTemplate(factory);
    }

    @GetMapping("/proxy")
    public ResponseEntity<byte[]> proxyImage(@RequestParam String url) {
        // Validar que la URL pertenece al dominio permitido
        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }

        if (uri.getHost() == null || !uri.getHost().equals(ALLOWED_HOST)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        if (!"https".equals(uri.getScheme())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        try {
            byte[] imageBytes = restTemplate.getForObject(uri, byte[].class);
            if (imageBytes == null) {
                return ResponseEntity.notFound().build();
            }

            // Límite de 5MB para prevenir memory exhaustion
            if (imageBytes.length > 5_000_000) {
                return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).build();
            }

            String contentType = url.endsWith(".svg") ? "image/svg+xml" : "image/png";

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic())
                    .body(imageBytes);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }
    }
}
