package com.mundial2026.service;

import com.mundial2026.dto.prediccion.GuardarPrediccionTorneoRequest;
import com.mundial2026.dto.prediccion.PrediccionTorneoDTO;
import com.mundial2026.model.*;
import com.mundial2026.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class PrediccionTorneoService {

    private final PrediccionTorneoRepository prediccionTorneoRepository;
    private final UsuarioRepository          usuarioRepository;
    private final PaisRepository             paisRepository;
    private final JugadorRepository          jugadorRepository;

    /**
     * Obtener la predicción de torneo del usuario autenticado.
     * Retorna null si aún no creó una.
     */
    @Transactional(readOnly = true)
    public PrediccionTorneoDTO getMiPrediccion(String username) {
        Usuario usuario = findUsuario(username);
        return prediccionTorneoRepository.findByUsuarioId(usuario.getInternalId())
                .map(this::toDTO)
                .orElse(null);
    }

    /**
     * Guardar o actualizar la predicción de torneo.
     * Si ya existe, se actualiza (upsert). Si no, se crea.
     */
    @Transactional
    public PrediccionTorneoDTO guardar(String username, GuardarPrediccionTorneoRequest req) {
        Usuario usuario = findUsuario(username);

        Pais paisCampeon = paisRepository.findById(req.getPaisCampeonId())
                .orElseThrow(() -> new RuntimeException("País no encontrado: " + req.getPaisCampeonId()));

        Jugador goleador = jugadorRepository.findById(req.getJugadorGoleadorId())
                .orElseThrow(() -> new RuntimeException("Jugador no encontrado: " + req.getJugadorGoleadorId()));

        PrediccionTorneo prediccion = prediccionTorneoRepository
                .findByUsuarioId(usuario.getInternalId())
                .orElse(null);

        if (prediccion != null) {
            // Ya existe → actualizar
            if (Boolean.TRUE.equals(prediccion.getConfirmada())) {
                throw new RuntimeException("La predicción ya está confirmada y no se puede modificar");
            }
            prediccion.setPaisCampeon(paisCampeon);
            prediccion.setJugadorGoleador(goleador);
            prediccion.setFechaActualizacion(LocalDateTime.now());
        } else {
            // Nueva predicción
            prediccion = PrediccionTorneo.builder()
                    .usuario(usuario)
                    .paisCampeon(paisCampeon)
                    .jugadorGoleador(goleador)
                    .confirmada(false)
                    .build();
        }

        prediccionTorneoRepository.save(prediccion);
        return toDTO(prediccion);
    }

    // ---- helpers ----

    private Usuario findUsuario(String username) {
        return usuarioRepository.findByUser(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + username));
    }

    private PrediccionTorneoDTO toDTO(PrediccionTorneo pt) {
        Pais pais = pt.getPaisCampeon();
        Jugador jugador = pt.getJugadorGoleador();

        return PrediccionTorneoDTO.builder()
                .internalId(pt.getInternalId())
                .paisCampeonId(pais.getInternalId())
                .paisCampeonNombre(pais.getNombre())
                .paisCampeonCodigo(pais.getCodigo())
                .jugadorGoleadorId(jugador.getInternalId())
                .jugadorGoleadorNombre(jugador.getNombre() + " " + jugador.getApellido())
                .jugadorGoleadorPaisCodigo(jugador.getPais() != null ? jugador.getPais().getCodigo() : null)
                .jugadorGoleadorUrlFoto(jugador.getUrlFoto())
                .confirmada(pt.getConfirmada())
                .transDate(pt.getTransDate())
                .fechaActualizacion(pt.getFechaActualizacion())
                .build();
    }
}
