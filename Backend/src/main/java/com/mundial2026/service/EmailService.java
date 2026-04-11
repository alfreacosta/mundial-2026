package com.mundial2026.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${app.mail.from}")
    private String fromEmail;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Value("${resend.api-key}")
    private String resendApiKey;

    @Async
    public void sendWelcomeEmail(String toEmail, String nombre, String username) {
        String displayName = (nombre != null && !nombre.isBlank()) ? nombre : username;
        String subject = "¡Bienvenido a DT26! ⚽";
        String html = """
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0e17;color:#e0e0e0;border-radius:12px;overflow:hidden;">
              <div style="background:linear-gradient(135deg,#0891b2,#06b6d4);padding:32px;text-align:center;">
                <h1 style="margin:0;font-size:28px;color:#fff;">⚽ DT26</h1>
                <p style="margin:8px 0 0;color:rgba(255,255,255,.85);font-size:14px;">Mundial 2026 Fantasy Manager</p>
              </div>
              <div style="padding:32px;">
                <h2 style="color:#06b6d4;margin:0 0 16px;">¡Hola %s! 🎉</h2>
                <p style="line-height:1.6;margin:0 0 16px;">Tu cuenta <strong style="color:#06b6d4;">%s</strong> fue creada exitosamente.</p>
                <p style="line-height:1.6;margin:0 0 24px;">Ya podés empezar a armar tu equipo, elegir tus 5 selecciones favoritas, convocar a tus 26 jugadores y competir contra todos.</p>
                <div style="text-align:center;margin:24px 0;">
                  <a href="%s/register?mode=login" style="display:inline-block;background:#06b6d4;color:#000;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px;">Empezar a jugar →</a>
                </div>
                <p style="font-size:13px;color:#888;margin:24px 0 0;text-align:center;">Si no creaste esta cuenta, podés ignorar este email.</p>
              </div>
              <div style="background:#0d1117;padding:16px;text-align:center;font-size:12px;color:#555;">
                <p style="margin:0;">DT26 — Hecho con pasión 🇵🇾</p>
              </div>
            </div>
            """.formatted(displayName, username, frontendUrl);

        sendHtml(toEmail, subject, html);
    }

    // Sin @Async para forgot-password: necesitamos ver el error si falla
    public void sendPasswordResetEmail(String toEmail, String nombre, String token) {
        String displayName = (nombre != null && !nombre.isBlank()) ? nombre : "usuario";
        String resetUrl = frontendUrl + "/reset-password?token=" + token;
        String subject = "Restablecer tu contraseña — DT26";
        String html = """
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0e17;color:#e0e0e0;border-radius:12px;overflow:hidden;">
              <div style="background:linear-gradient(135deg,#0891b2,#06b6d4);padding:32px;text-align:center;">
                <h1 style="margin:0;font-size:28px;color:#fff;">⚽ DT26</h1>
                <p style="margin:8px 0 0;color:rgba(255,255,255,.85);font-size:14px;">Restablecimiento de contraseña</p>
              </div>
              <div style="padding:32px;">
                <h2 style="color:#06b6d4;margin:0 0 16px;">Hola %s 👋</h2>
                <p style="line-height:1.6;margin:0 0 16px;">Recibimos una solicitud para restablecer tu contraseña.</p>
                <p style="line-height:1.6;margin:0 0 24px;">Hacé clic en el botón para crear una nueva contraseña. Este enlace expira en <strong>1 hora</strong>.</p>
                <div style="text-align:center;margin:24px 0;">
                  <a href="%s" style="display:inline-block;background:#06b6d4;color:#000;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px;">Restablecer contraseña</a>
                </div>
                <p style="font-size:13px;color:#888;margin:24px 0 0;text-align:center;">Si no solicitaste esto, podés ignorar este email. Tu contraseña no será modificada.</p>
              </div>
              <div style="background:#0d1117;padding:16px;text-align:center;font-size:12px;color:#555;">
                <p style="margin:0;">DT26 — soporte@dt26.win</p>
              </div>
            </div>
            """.formatted(displayName, resetUrl);

        sendHtml(toEmail, subject, html);
    }

    private void sendHtml(String to, String subject, String html) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(resendApiKey);

            Map<String, Object> body = Map.of(
                "from", "DT26 <" + fromEmail + ">",
                "to", List.of(to),
                "subject", subject,
                "html", html
            );

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(
                "https://api.resend.com/emails", request, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Email enviado a {}: {}", to, subject);
            } else {
                log.error("Resend respondió {}: {}", response.getStatusCode(), response.getBody());
                throw new RuntimeException("Error enviando email: Resend respondió " + response.getStatusCode());
            }
        } catch (RuntimeException e) {
            if (e.getMessage() != null && e.getMessage().startsWith("Error enviando email")) throw e;
            log.error("Error enviando email a {}: {}", to, e.getMessage(), e);
            throw new RuntimeException("Error enviando email: " + e.getMessage(), e);
        }
    }
}
