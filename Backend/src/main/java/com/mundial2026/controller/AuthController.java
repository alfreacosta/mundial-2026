package com.mundial2026.controller;

import com.mundial2026.dto.auth.AuthResponse;
import com.mundial2026.dto.auth.ChangePasswordRequest;
import com.mundial2026.dto.auth.ForgotPasswordRequest;
import com.mundial2026.dto.auth.GoogleAuthRequest;
import com.mundial2026.dto.auth.LoginRequest;
import com.mundial2026.dto.auth.ProfileUpdateRequest;
import com.mundial2026.dto.auth.RegisterRequest;
import com.mundial2026.dto.auth.ResetPasswordRequest;
import com.mundial2026.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);
    private final AuthService authService;
    private final PasswordEncoder passwordEncoder;

    /**
     * POST /api/auth/register
     * Registra un nuevo usuario y devuelve token JWT
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req,
                                       HttpServletRequest httpReq) {
        try {
            AuthResponse response = authService.register(req);
            log.info("SECURITY: Registro exitoso user={} ip={}", req.getUser(), getClientIp(httpReq));
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            log.warn("SECURITY: Registro fallido user={} ip={} reason={}", req.getUser(), getClientIp(httpReq), e.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * POST /api/auth/login
     * Inicia sesión con user_name o email + contraseña
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req,
                                    HttpServletRequest httpReq) {
        try {
            AuthResponse response = authService.login(req);
            log.info("SECURITY: Login exitoso user={} ip={}", req.getIdentifier(), getClientIp(httpReq));
            return ResponseEntity.ok(response);
        } catch (BadCredentialsException e) {
            log.warn("SECURITY: Login fallido user={} ip={}", req.getIdentifier(), getClientIp(httpReq));
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * POST /api/auth/google
     * Login/registro con cuenta de Google (ID token)
     */
    @PostMapping("/google")
    public ResponseEntity<?> googleLogin(@Valid @RequestBody GoogleAuthRequest req) {
        try {
            AuthResponse response = authService.loginWithGoogle(req.getCredential());
            return ResponseEntity.ok(response);
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "No se pudo verificar la cuenta de Google."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error al iniciar sesión con Google."));
        }
    }

    /**
     * GET /api/auth/health
     * Endpoint de prueba para verificar que el backend responde
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "MUNDIAL 2026 Auth"
        ));
    }

    /**
     * POST /api/auth/forgot-password
     * Envía email con link de restablecimiento de contraseña
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPasswordRequest req,
                                            HttpServletRequest httpReq) {
        log.info("SECURITY: Forgot password solicitado email={} ip={}", req.getEmail(), getClientIp(httpReq));
        try {
            authService.forgotPassword(req.getEmail());
        } catch (Exception e) {
            log.error("FORGOT-PASSWORD ERROR: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("message",
                    "Error enviando email: " + e.getMessage()));
        }
        // Siempre responder OK para no revelar si el email existe
        return ResponseEntity.ok(Map.of("message",
                "Si el email está registrado, recibirás un enlace para restablecer tu contraseña."));
    }

    /**
     * POST /api/auth/reset-password
     * Restablece la contraseña usando el token del email
     */
    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequest req,
                                           HttpServletRequest httpReq) {
        try {
            authService.resetPassword(req.getToken(), req.getNewPassword());
            log.info("SECURITY: Password reseteado via token ip={}", getClientIp(httpReq));
            return ResponseEntity.ok(Map.of("message", "Contraseña actualizada correctamente."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getProfile(Authentication auth) {
        try {
            AuthResponse response = authService.getProfile(auth.getName());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(Authentication auth,
                                           @Valid @RequestBody ProfileUpdateRequest req) {
        try {
            AuthResponse response = authService.updateProfile(auth.getName(), req);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/password")
    public ResponseEntity<?> changePassword(Authentication auth,
                                            @Valid @RequestBody ChangePasswordRequest req,
                                            HttpServletRequest httpReq) {
        try {
            authService.changePassword(auth.getName(), req);
            log.info("SECURITY: Cambio de password user={} ip={}", auth.getName(), getClientIp(httpReq));
            return ResponseEntity.ok(Map.of("message", "Contraseña actualizada correctamente"));
        } catch (BadCredentialsException e) {
            log.warn("SECURITY: Cambio de password fallido user={} ip={}", auth.getName(), getClientIp(httpReq));
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * POST /api/auth/generate-hash
     * ENDPOINT TEMPORAL SOLO PARA DESARROLLO
     * Genera un hash BCrypt para una contraseña
     * ELIMINAR EN PRODUCCIÓN
     */
    @PostMapping("/generate-hash")
    public ResponseEntity<?> generateHash(@RequestBody Map<String, String> payload) {
        String password = payload.get("password");
        if (password == null || password.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "El campo 'password' es requerido"));
        }
        
        String hash = passwordEncoder.encode(password);
        log.info("TEMPORAL: Hash generado para contraseña");
        
        return ResponseEntity.ok(Map.of(
                "password", password,
                "hash", hash,
                "warning", "⚠️ ELIMINAR ESTE ENDPOINT EN PRODUCCIÓN"
        ));
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
