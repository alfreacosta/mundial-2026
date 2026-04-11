package com.mundial2026.controller;

import com.mundial2026.model.Mensaje;
import com.mundial2026.repository.MensajeRepository;
import com.mundial2026.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/mensajes")
@RequiredArgsConstructor
public class MensajeController {

    private final MensajeRepository mensajeRepository;
    private final UsuarioRepository usuarioRepository;

    @PostMapping
    public ResponseEntity<?> crear(@RequestBody Map<String, String> body) {
        String texto = body.get("mensaje");
        if (texto == null || texto.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "El mensaje no puede estar vacío"));
        }
        if (texto.length() > 2000) {
            return ResponseEntity.badRequest().body(Map.of("error", "El mensaje no puede superar 2000 caracteres"));
        }

        Mensaje.MensajeBuilder builder = Mensaje.builder()
                .mensaje(texto.trim())
                .transDate(LocalDateTime.now());

        String usuarioIdStr = body.get("usuarioId");
        if (usuarioIdStr != null && !usuarioIdStr.isBlank()) {
            try {
                Long uid = Long.parseLong(usuarioIdStr);
                usuarioRepository.findById(uid).ifPresent(builder::usuario);
            } catch (NumberFormatException ignored) {
            }
        }

        Mensaje saved = mensajeRepository.save(builder.build());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping
    public ResponseEntity<List<Mensaje>> listar() {
        return ResponseEntity.ok(mensajeRepository.findAllByOrderByTransDateDesc());
    }
}
