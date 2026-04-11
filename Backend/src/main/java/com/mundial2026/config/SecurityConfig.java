package com.mundial2026.config;

import com.mundial2026.security.JwtAuthFilter;
import com.mundial2026.security.RateLimitFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.XXssProtectionHeaderWriter;
import org.springframework.http.MediaType;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.cors.CorsConfigurationSource;

import jakarta.servlet.http.HttpServletResponse;
import java.util.ArrayList;
import java.util.List;

@Configuration
@RequiredArgsConstructor
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthFilter      jwtAuthFilter;
    private final RateLimitFilter    rateLimitFilter;
    private final UserDetailsService userDetailsService;

    @Value("${app.cors.allowed-origins:}")
    private String corsAllowedOrigins;

    @Value("${spring.profiles.active:default}")
    private String activeProfile;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // ── Security Headers ──
                .headers(headers -> headers
                    .contentSecurityPolicy(csp -> csp
                        .policyDirectives("default-src 'self'; " +
                            "script-src 'self'; " +
                            "style-src 'self' 'unsafe-inline'; " +
                            "img-src 'self' https://media.api-sports.io data:; " +
                            "font-src 'self'; " +
                            "connect-src 'self'; " +
                            "frame-ancestors 'none'"))
                    .xssProtection(xss -> xss
                        .headerValue(XXssProtectionHeaderWriter.HeaderValue.ENABLED_MODE_BLOCK))
                    .frameOptions(frame -> frame.deny())
                )

                .exceptionHandling(ex -> ex
                    .authenticationEntryPoint((request, response, authException) -> {
                        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                        response.setContentType("application/json;charset=UTF-8");
                        response.setCharacterEncoding("UTF-8");
                        response.getWriter().write("{\"error\":\"No autenticado. Token invalido o expirado.\"}");
                    })
                )

                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // Auth endpoints públicos (login, register, health, password reset, etc.)
                        .requestMatchers("/api/auth/register", "/api/auth/login", "/api/auth/google", 
                                       "/api/auth/health", "/api/auth/generate-hash",
                                       "/api/auth/forgot-password", "/api/auth/reset-password").permitAll()
                        // Auth endpoints protegidos (requieren autenticación)
                        .requestMatchers("/api/auth/me", "/api/auth/profile", "/api/auth/password").authenticated()
                        // Otros endpoints públicos
                        .requestMatchers("/api/fixtures/**").permitAll()
                        .requestMatchers("/api/selecciones/**").permitAll()
                        .requestMatchers("/api/images/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/jugadores/*/stats").permitAll()
                        .requestMatchers("/graphql").permitAll()
                        .requestMatchers("/graphiql/**").permitAll()
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/grupos/public/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/grupos/ranking").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/mensajes").permitAll()
                        // Endpoints protegidos
                        .requestMatchers("/api/sync/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/mensajes").authenticated()
                        .requestMatchers("/api/grupos/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/usuarios/*/perfil").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/usuarios/*/juego").authenticated()
                        .requestMatchers("/api/usuarios/buscar").authenticated()
                        .requestMatchers("/api/usuarios/favoritos/**").authenticated()
                        .requestMatchers("/api/usuarios/perfil-publico").authenticated()
                        // Predicciones de partidos (autenticado)
                        .requestMatchers("/api/predicciones-partidos/**").authenticated()
                        // Actualizar resultado de partido (admin via X-Sync-Key, endpoint público en el handler)
                        .requestMatchers(HttpMethod.PUT, "/api/fixtures/*/resultado").permitAll()
                        .anyRequest().authenticated()
                )
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        List<String> origins = new ArrayList<>();

        boolean isProd = "prod".equals(activeProfile);

        if (!isProd) {
            // Desarrollo: permitir localhost y cualquier red local (LAN)
            origins.add("http://localhost:4200");
            origins.add("http://localhost:4201");
            origins.add("http://127.0.0.1:4200");
            origins.add("http://10.*.*.*:4200");
            origins.add("http://172.16.*.*:4200");
            origins.add("http://192.168.*.*:4200");
        }

        // Producción: solo dominios explícitos de la variable de entorno
        if (corsAllowedOrigins != null && !corsAllowedOrigins.isBlank()) {
            for (String origin : corsAllowedOrigins.split(",")) {
                origins.add(origin.trim());
            }
        }
        cfg.setAllowedOriginPatterns(origins);
        cfg.setAllowedMethods(List.of("GET","POST","PUT","DELETE","PATCH","OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin"));
        cfg.setExposedHeaders(List.of("X-RateLimit-Remaining"));
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}
