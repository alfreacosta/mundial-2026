package com.mundial2026.service;

import com.mundial2026.dto.grupo.AgregarFavoritoRequest;
import com.mundial2026.dto.grupo.EquipoFavoritoDTO;
import com.mundial2026.model.EquipoFavorito;
import com.mundial2026.model.Pais;
import com.mundial2026.model.Usuario;
import com.mundial2026.repository.EquipoFavoritoRepository;
import com.mundial2026.repository.PaisRepository;
import com.mundial2026.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Gestión de los equipos favoritos globales de un usuario.
 * Un usuario tiene máximo 5 favoritos para todo el torneo,
 * independientemente de los grupos en los que participe.
 */
@Service
@RequiredArgsConstructor
public class EquipoFavoritoService {

    private final EquipoFavoritoRepository equipoFavoritoRepository;
    private final UsuarioRepository        usuarioRepository;
    private final PaisRepository           paisRepository;

    // ----------------------------------------------------------------
    // OBTENER MIS FAVORITOS
    // ----------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<EquipoFavoritoDTO> getMisFavoritos(String username) {
        Usuario usuario = getUsuario(username);
        return equipoFavoritoRepository.findByUsuarioId(usuario.getInternalId())
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    // ----------------------------------------------------------------
    // AGREGAR FAVORITO
    // ----------------------------------------------------------------

    @Transactional
    public EquipoFavoritoDTO agregarFavorito(String username, AgregarFavoritoRequest req) {
        Usuario usuario = getUsuario(username);

        int total = equipoFavoritoRepository.countByUsuario_InternalId(usuario.getInternalId());
        if (total >= 5) {
            throw new IllegalStateException("Ya elegiste 5 equipos favoritos");
        }

        if (equipoFavoritoRepository.existsByUsuario_InternalIdAndPais_InternalId(
                usuario.getInternalId(), req.getPaisId())) {
            throw new IllegalStateException("Ese equipo ya está en tus favoritos");
        }

        Pais pais = paisRepository.findById(req.getPaisId())
                .orElseThrow(() -> new RuntimeException("País no encontrado"));

        EquipoFavorito ef = EquipoFavorito.builder()
                .usuario(usuario)
                .pais(pais)
                .orden(req.getOrden())
                .build();

        equipoFavoritoRepository.save(ef);
        return toDTO(ef);
    }

    // ----------------------------------------------------------------
    // QUITAR FAVORITO
    // ----------------------------------------------------------------

    @Transactional
    public void quitarFavorito(String username, Long paisId) {
        Usuario usuario = getUsuario(username);

        EquipoFavorito ef = equipoFavoritoRepository
                .findByUsuario_InternalIdAndPais_InternalId(usuario.getInternalId(), paisId)
                .orElseThrow(() -> new RuntimeException("Equipo favorito no encontrado"));

        equipoFavoritoRepository.delete(ef);
    }

    // ----------------------------------------------------------------
    // REEMPLAZAR TODOS LOS FAVORITOS (set completo)
    // ----------------------------------------------------------------

    @Transactional
    public List<EquipoFavoritoDTO> setFavoritos(String username, List<Long> paisIds) {
        if (paisIds == null || paisIds.size() > 5) {
            throw new IllegalArgumentException("Podés elegir entre 1 y 5 equipos favoritos");
        }

        Usuario usuario = getUsuario(username);

        // Borrar todos los favoritos actuales del usuario
        List<EquipoFavorito> actuales = equipoFavoritoRepository.findByUsuarioId(usuario.getInternalId());
        equipoFavoritoRepository.deleteAll(actuales);
        equipoFavoritoRepository.flush(); // forzar DELETE antes de los INSERT

        // Crear los nuevos
        for (int i = 0; i < paisIds.size(); i++) {
            Pais pais = paisRepository.findById(paisIds.get(i))
                    .orElseThrow(() -> new RuntimeException("País no encontrado"));
            EquipoFavorito ef = EquipoFavorito.builder()
                    .usuario(usuario)
                    .pais(pais)
                    .orden(i + 1)
                    .build();
            equipoFavoritoRepository.save(ef);
        }

        return equipoFavoritoRepository.findByUsuarioId(usuario.getInternalId())
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    private Usuario getUsuario(String username) {
        return usuarioRepository.findByUser(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + username));
    }

    private EquipoFavoritoDTO toDTO(EquipoFavorito ef) {
        return EquipoFavoritoDTO.builder()
                .internalId(ef.getInternalId())
                .paisId(ef.getPais().getInternalId())
                .paisNombre(ef.getPais().getNombre())
                .paisCodigo(ef.getPais().getCodigo())
                .orden(ef.getOrden())
                .transDate(ef.getTransDate())
                .dtNombre(ef.getPais().getDtNombre())
                .dtFotoUrl(ef.getPais().getDtFotoUrl())
                .build();
    }
}
