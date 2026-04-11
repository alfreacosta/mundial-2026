package com.mundial2026.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Rate limiter simple para proteger endpoints de autenticación contra fuerza bruta.
 * Limita por IP: máximo 10 intentos de login/register por minuto.
 * En producción considerar Redis para múltiples instancias.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    private static final int MAX_REQUESTS_PER_WINDOW = 10;
    private static final long WINDOW_MS = 60_000; // 1 minuto

    private final Map<String, RateBucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        // Solo aplicar rate limit a endpoints de autenticación
        return !path.startsWith("/api/auth/login")
            && !path.startsWith("/api/auth/register")
            && !path.startsWith("/api/auth/google");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String clientIp = getClientIp(request);
        String key = clientIp + ":" + request.getRequestURI();

        RateBucket bucket = buckets.compute(key, (k, existing) -> {
            long now = System.currentTimeMillis();
            if (existing == null || now - existing.windowStart > WINDOW_MS) {
                return new RateBucket(now, new AtomicInteger(1));
            }
            existing.count.incrementAndGet();
            return existing;
        });

        if (bucket.count.get() > MAX_REQUESTS_PER_WINDOW) {
            log.warn("Rate limit excedido para IP={} en {}", clientIp, request.getRequestURI());
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Demasiados intentos. Esperá un minuto.\"}");
            return;
        }

        // Limpieza periódica de buckets viejos (cada ~100 requests)
        if (buckets.size() > 1000) {
            long now = System.currentTimeMillis();
            buckets.entrySet().removeIf(e -> now - e.getValue().windowStart > WINDOW_MS * 2);
        }

        filterChain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            // Tomar solo la primera IP (la del cliente real)
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static class RateBucket {
        final long windowStart;
        final AtomicInteger count;

        RateBucket(long windowStart, AtomicInteger count) {
            this.windowStart = windowStart;
            this.count = count;
        }
    }
}
