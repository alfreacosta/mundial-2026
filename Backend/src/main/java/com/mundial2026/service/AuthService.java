package com.mundial2026.service;

import com.mundial2026.dto.auth.AuthResponse;
import com.mundial2026.dto.auth.ChangePasswordRequest;
import com.mundial2026.dto.auth.LoginRequest;
import com.mundial2026.dto.auth.ProfileUpdateRequest;
import com.mundial2026.dto.auth.RegisterRequest;
import com.mundial2026.model.PasswordResetToken;
import com.mundial2026.model.Usuario;
import com.mundial2026.repository.PasswordResetTokenRepository;
import com.mundial2026.repository.UsuarioRepository;
import com.mundial2026.security.JwtUtil;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UsuarioRepository              usuarioRepository;
    private final PasswordResetTokenRepository   resetTokenRepository;
    private final PasswordEncoder                passwordEncoder;
    private final JwtUtil                        jwtUtil;
    private final EmailService                   emailService;

    @Value("${google.client-id:}")
    private String googleClientId;

    // ----------------------------------------------------------------
    // REGISTRO
    // ----------------------------------------------------------------

    @Transactional
    public AuthResponse register(RegisterRequest req) {

        // Validar unicidad
        if (usuarioRepository.existsByUser(req.getUser())) {
            throw new IllegalArgumentException("El nombre de usuario '" + req.getUser() + "' ya está en uso");
        }
        if (usuarioRepository.existsByEmail(req.getEmail())) {
            throw new IllegalArgumentException("El email '" + req.getEmail() + "' ya está registrado");
        }

        // Crear y guardar usuario
        Usuario usuario = Usuario.builder()
                .user(req.getUser())
                .email(req.getEmail())
                .password(passwordEncoder.encode(req.getPassword()))
                .nombre(req.getNombre())
                .apellido(req.getApellido())
                .puntaje(0)
                .activo(true)
                .transDate(LocalDateTime.now())
                .build();

        usuarioRepository.save(usuario);

        // Enviar email de bienvenida (async, no bloquea el registro)
        emailService.sendWelcomeEmail(usuario.getEmail(), usuario.getNombre(), usuario.getUser());

        // Generar token y devolver respuesta
        String token = jwtUtil.generateToken(usuario.getUser());
        return buildResponse(token, usuario);
    }

    // ----------------------------------------------------------------
    // LOGIN
    // ----------------------------------------------------------------

    @Transactional
    public AuthResponse login(LoginRequest req) {

        // Buscar por user_name o email
        Usuario usuario = usuarioRepository.findByUser(req.getIdentifier())
                .or(() -> usuarioRepository.findByEmail(req.getIdentifier()))
                .orElseThrow(() -> new BadCredentialsException("Usuario o contraseña incorrectos"));

        if (!usuario.getActivo()) {
            throw new BadCredentialsException("La cuenta está desactivada");
        }

        if (!passwordEncoder.matches(req.getPassword(), usuario.getPassword())) {
            throw new BadCredentialsException("Usuario o contraseña incorrectos");
        }

        // Actualizar último acceso
        usuario.setUltimoAcceso(LocalDateTime.now());
        usuarioRepository.save(usuario);

        String token = jwtUtil.generateToken(usuario.getUser());
        return buildResponse(token, usuario);
    }

    // ----------------------------------------------------------------
    // GOOGLE SIGN-IN
    // ----------------------------------------------------------------

    @Transactional
    public AuthResponse loginWithGoogle(String credential) {
        GoogleIdToken.Payload payload = verifyGoogleToken(credential);

        String googleId = payload.getSubject();
        String email    = payload.getEmail();
        String nombre   = (String) payload.get("given_name");
        String apellido = (String) payload.get("family_name");
        String avatar   = (String) payload.get("picture");

        // Buscar usuario existente por Google ID
        Usuario usuario = usuarioRepository.findByOauthProviderAndOauthId("GOOGLE", googleId)
                .orElse(null);

        if (usuario == null) {
            // Buscar por email (puede haberse registrado antes con email/password)
            usuario = usuarioRepository.findByEmail(email).orElse(null);

            if (usuario != null) {
                // Vincular cuenta existente con Google
                usuario.setOauthProvider("GOOGLE");
                usuario.setOauthId(googleId);
                if (usuario.getUrlAvatar() == null && avatar != null) {
                    usuario.setUrlAvatar(avatar);
                }
            } else {
                // Crear cuenta nueva
                String username = generarUsername(email);
                usuario = Usuario.builder()
                        .user(username)
                        .email(email)
                        .nombre(nombre)
                        .apellido(apellido)
                        .urlAvatar(avatar)
                        .oauthProvider("GOOGLE")
                        .oauthId(googleId)
                        .puntaje(0)
                        .activo(true)
                        .transDate(LocalDateTime.now())
                        .build();
            }
        }

        usuario.setUltimoAcceso(LocalDateTime.now());
        usuarioRepository.save(usuario);

        String token = jwtUtil.generateToken(usuario.getUser());
        return buildResponse(token, usuario);
    }

    private GoogleIdToken.Payload verifyGoogleToken(String credential) {
        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(), GsonFactory.getDefaultInstance())
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(credential);
            if (idToken == null) {
                throw new BadCredentialsException("Token de Google inválido");
            }
            return idToken.getPayload();
        } catch (BadCredentialsException e) {
            throw e;
        } catch (Exception e) {
            throw new BadCredentialsException("Error verificando token de Google");
        }
    }

    private String generarUsername(String email) {
        String base = email.split("@")[0]
                .replaceAll("[^a-zA-Z0-9_]", "");
        if (base.length() > 20) base = base.substring(0, 20);

        String username = base;
        int suffix = 1;
        while (usuarioRepository.existsByUser(username)) {
            username = base + suffix++;
        }
        return username;
    }

    // ----------------------------------------------------------------
    // PROFILE
    // ----------------------------------------------------------------

    public AuthResponse getProfile(String username) {
        Usuario usuario = usuarioRepository.findByUser(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        String token = jwtUtil.generateToken(usuario.getUser());
        return buildResponse(token, usuario);
    }

    @Transactional
    public AuthResponse updateProfile(String username, ProfileUpdateRequest req) {
        Usuario usuario = usuarioRepository.findByUser(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        if (req.getNombre() != null)    usuario.setNombre(req.getNombre());
        if (req.getApellido() != null)  usuario.setApellido(req.getApellido());
        if (req.getTelefono() != null)  usuario.setTelefono(req.getTelefono());
        if (req.getUrlAvatar() != null) usuario.setUrlAvatar(req.getUrlAvatar());

        usuarioRepository.save(usuario);
        String token = jwtUtil.generateToken(usuario.getUser());
        return buildResponse(token, usuario);
    }

    @Transactional
    public void changePassword(String username, ChangePasswordRequest req) {
        Usuario usuario = usuarioRepository.findByUser(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        if (!passwordEncoder.matches(req.getCurrentPassword(), usuario.getPassword())) {
            throw new BadCredentialsException("La contraseña actual es incorrecta");
        }

        usuario.setPassword(passwordEncoder.encode(req.getNewPassword()));
        usuarioRepository.save(usuario);
    }

    // ----------------------------------------------------------------
    // FORGOT / RESET PASSWORD
    // ----------------------------------------------------------------

    @Transactional
    public void forgotPassword(String email) {
        Usuario usuario = usuarioRepository.findByEmail(email).orElse(null);
        if (usuario == null || !Boolean.TRUE.equals(usuario.getActivo())) {
            // No revelar si el email existe o no (seguridad)
            log.info("Forgot password solicitado para email inexistente o inactivo: {}", email);
            return;
        }

        String tokenStr = UUID.randomUUID().toString();
        PasswordResetToken resetToken = PasswordResetToken.builder()
                .usuario(usuario)
                .token(tokenStr)
                .expiryDate(LocalDateTime.now().plusHours(1))
                .build();
        resetTokenRepository.save(resetToken);

        emailService.sendPasswordResetEmail(usuario.getEmail(), usuario.getNombre(), tokenStr);
        log.info("Token de reset generado para user={}", usuario.getUser());
    }

    @Transactional
    public void resetPassword(String tokenStr, String newPassword) {
        PasswordResetToken resetToken = resetTokenRepository.findByTokenAndUsedFalse(tokenStr)
                .orElseThrow(() -> new IllegalArgumentException("Token inválido o ya utilizado"));

        if (resetToken.isExpired()) {
            throw new IllegalArgumentException("El enlace expiró. Solicitá uno nuevo.");
        }

        Usuario usuario = resetToken.getUsuario();
        usuario.setPassword(passwordEncoder.encode(newPassword));
        usuarioRepository.save(usuario);

        resetToken.setUsed(true);
        resetTokenRepository.save(resetToken);

        log.info("SECURITY: Password reseteado para user={}", usuario.getUser());
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    private AuthResponse buildResponse(String token, Usuario usuario) {
        return AuthResponse.builder()
                .token(token)
                .tipo("Bearer")
                .userId(usuario.getInternalId())
                .user(usuario.getUser())
                .email(usuario.getEmail())
                .nombre(usuario.getNombre())
                .apellido(usuario.getApellido())
                .telefono(usuario.getTelefono())
                .urlAvatar(usuario.getUrlAvatar())
                .puntaje(usuario.getPuntaje())
                .build();
    }
}
