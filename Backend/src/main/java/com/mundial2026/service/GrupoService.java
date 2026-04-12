package com.mundial2026.service;

import com.mundial2026.dto.grupo.*;
import com.mundial2026.model.*;
import com.mundial2026.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GrupoService {

    private final GrupoRepository              grupoRepository;
    private final GrupoRowRepository           grupoRowRepository;
    private final EquipoFavoritoRepository     equipoFavoritoRepository;
    private final UsuarioRepository            usuarioRepository;
    private final PrediccionTorneoRepository   prediccionTorneoRepository;

    // ----------------------------------------------------------------
    // CREAR GRUPO
    // ----------------------------------------------------------------

    @Transactional
    public GrupoDTO crearGrupo(String username, CrearGrupoRequest req) {
        Usuario creador = usuarioRepository.findByUser(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + username));

        int totalGrupos = (int) grupoRepository.count();

        String codigo = generarCodigoUnico();

        Grupo grupo = Grupo.builder()
                .numero(totalGrupos + 1)
                .nombre(req.getNombre())
                .premio(req.getPremio())
                .codigoInvitacion(codigo)
                .creador(creador)
                .activo(true)
                .build();

        grupoRepository.save(grupo);

        // Auto-unir al creador como miembro con rol CREADOR
        GrupoRow.GrupoRowBuilder rowBuilder = GrupoRow.builder()
                .grupo(grupo)
                .usuario(creador)
                .rol("CREADOR");

        prediccionTorneoRepository.findByUsuarioId(creador.getInternalId())
                .ifPresent(pred -> {
                    rowBuilder.paisCampeon(pred.getPaisCampeon());
                    rowBuilder.goleador(pred.getJugadorGoleador());
                });

        grupoRowRepository.save(rowBuilder.build());

        return toGrupoDTO(grupo, false);
    }

    // ----------------------------------------------------------------
    // UNIRSE AL GRUPO
    // ----------------------------------------------------------------

    @Transactional
    public GrupoRowDTO unirseAlGrupo(String username, UnirseGrupoRequest req) {
        Usuario usuario = usuarioRepository.findByUser(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        Grupo grupo = grupoRepository.findByCodigoInvitacion(req.getCodigoInvitacion())
                .orElseThrow(() -> new RuntimeException("Código de invitación inválido"));

        if (!grupo.getActivo()) {
            throw new IllegalStateException("El grupo ya no está activo");
        }

        if (grupoRowRepository.existsByGrupo_InternalIdAndUsuario_InternalId(grupo.getInternalId(), usuario.getInternalId())) {
            throw new IllegalStateException("Ya eres miembro de este grupo");
        }

        // Determinar rol
        String rol = grupo.getCreador().getInternalId().equals(usuario.getInternalId()) ? "CREADOR" : "MIEMBRO";

        // Si el usuario ya configuró campeón/goleador, se asignan; si no, quedan null
        GrupoRow.GrupoRowBuilder rowBuilder = GrupoRow.builder()
                .grupo(grupo)
                .usuario(usuario)
                .rol(rol);

        prediccionTorneoRepository.findByUsuarioId(usuario.getInternalId())
                .ifPresent(pred -> {
                    rowBuilder.paisCampeon(pred.getPaisCampeon());
                    rowBuilder.goleador(pred.getJugadorGoleador());
                });

        GrupoRow row = rowBuilder.build();

        grupoRowRepository.save(row);

        return toGrupoRowDTO(row, List.of());
    }

    // ----------------------------------------------------------------
    // MIS GRUPOS
    // ----------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<GrupoDTO> getMisGrupos(String username) {
        Usuario usuario = usuarioRepository.findByUser(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        List<GrupoRow> rows = grupoRowRepository.findMisGrupos(usuario.getInternalId());

        return rows.stream()
                .map(r -> toGrupoDTO(r.getGrupo(), false))
                .distinct()
                .collect(Collectors.toList());
    }

    // ----------------------------------------------------------------
    // DETALLE GRUPO
    // ----------------------------------------------------------------

    @Transactional(readOnly = true)
    public GrupoDTO getDetalleGrupo(Long grupoId, String username) {
        Grupo grupo = grupoRepository.findById(grupoId)
                .orElseThrow(() -> new RuntimeException("Grupo no encontrado"));

        // Solo miembros pueden ver el detalle
        Usuario usuario = usuarioRepository.findByUser(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        boolean esMiembro = grupoRowRepository.existsByGrupo_InternalIdAndUsuario_InternalId(grupoId, usuario.getInternalId());
        boolean esCreador = grupo.getCreador().getInternalId().equals(usuario.getInternalId());
        if (!esMiembro && !esCreador) {
            throw new SecurityException("No eres miembro de este grupo");
        }

        List<GrupoRow> miembros = grupoRowRepository.findMiembrosDelGrupo(grupoId);
        List<GrupoRowDTO> miembrosDTO = buildMiembrosDTO(miembros);

        GrupoDTO dto = toGrupoDTO(grupo, false);
        dto.setMiembros(miembrosDTO);
        dto.setCantidadMiembros(miembros.size());
        return dto;
    }

    // ----------------------------------------------------------------
    // PREVIEW PÚBLICO (sin autenticación)
    // ----------------------------------------------------------------

    @Transactional(readOnly = true)
    public GrupoDTO getPreviewPublico(String codigoInvitacion) {
        Grupo grupo = grupoRepository.findByCodigoInvitacion(codigoInvitacion)
                .orElseThrow(() -> new RuntimeException("Grupo no encontrado"));

        List<GrupoRow> miembros = grupoRowRepository.findMiembrosDelGrupo(grupo.getInternalId());
        List<GrupoRowDTO> miembrosDTO = buildMiembrosDTO(miembros);

        GrupoDTO dto = toGrupoDTO(grupo, false);
        dto.setMiembros(miembrosDTO);
        dto.setCantidadMiembros(miembros.size());
        return dto;
    }

    // ----------------------------------------------------------------
    // SALIR DEL GRUPO
    // ----------------------------------------------------------------

    @Transactional
    public void salirDeGrupo(Long grupoId, String username) {
        Usuario usuario = usuarioRepository.findByUser(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        GrupoRow row = grupoRowRepository.findByGrupo_InternalIdAndUsuario_InternalId(grupoId, usuario.getInternalId())
                .orElseThrow(() -> new RuntimeException("No eres miembro de este grupo"));

        grupoRowRepository.delete(row);
    }

    // ----------------------------------------------------------------
    // ELIMINAR GRUPO (solo el creador)
    // ----------------------------------------------------------------

    @Transactional
    public void eliminarGrupo(Long grupoId, String username) {
        Grupo grupo = grupoRepository.findById(grupoId)
                .orElseThrow(() -> new RuntimeException("Grupo no encontrado"));

        if (!grupo.getCreador().getUser().equals(username)) {
            throw new SecurityException("Solo el creador puede eliminar el grupo");
        }

        long miembros = grupoRowRepository.countByGrupo_InternalIdAndRolNot(grupoId, "CREADOR");
        if (miembros > 0) {
            throw new IllegalStateException(
                    "No se puede eliminar el grupo porque tiene " + miembros + " miembro(s). Primero deben salir todos.");
        }

        grupoRowRepository.deleteByGrupo_InternalId(grupoId);
        grupoRepository.delete(grupo);
    }

    // ----------------------------------------------------------------
    // Helpers / Mappers
    // ----------------------------------------------------------------

    private String generarCodigoUnico() {
        String codigo;
        do {
            codigo = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        } while (grupoRepository.findByCodigoInvitacion(codigo).isPresent());
        return codigo;
    }

    /**
     * Construye la lista de DTOs de miembros leyendo siempre la predicción
     * desde prediccion_torneo (fuente de verdad), no desde grupo_row.
     */
    private List<GrupoRowDTO> buildMiembrosDTO(List<GrupoRow> miembros) {
        return miembros.stream().map(r -> {
            Long uid = r.getUsuario().getInternalId();
            List<EquipoFavorito> favs = equipoFavoritoRepository.findByUsuarioId(uid);

            // Siempre leer la predicción fresca desde prediccion_torneo
            PrediccionTorneo pred = prediccionTorneoRepository.findByUsuarioId(uid).orElse(null);

            Pais campeon   = pred != null ? pred.getPaisCampeon()      : null;
            Jugador goleador = pred != null ? pred.getJugadorGoleador() : null;

            return GrupoRowDTO.builder()
                    .internalId(r.getInternalId())
                    .grupoId(r.getGrupo().getInternalId())
                    .usuarioId(uid)
                    .usuarioNombre(r.getUsuario().getNombre())
                    .usuarioApellido(r.getUsuario().getApellido())
                    .urlAvatar(r.getUsuario().getUrlAvatar())
                    .rol(r.getRol())
                    .paisCampeonId(campeon != null ? campeon.getInternalId() : null)
                    .paisCampeonNombre(campeon != null ? campeon.getNombre() : null)
                    .paisCampeonCodigo(campeon != null ? campeon.getCodigo() : null)
                    .goleadorId(goleador != null ? goleador.getInternalId() : null)
                    .goleadorNombre(goleador != null ? goleador.getNombre() : null)
                    .goleadorApellido(goleador != null ? goleador.getApellido() : null)
                    .goleadorFoto(goleador != null ? goleador.getUrlFoto() : null)
                    .fechaUnion(r.getFechaUnion())
                    .equiposFavoritos(favs.stream().map(this::toEquipoFavoritoDTO).collect(Collectors.toList()))
                    .puntaje(r.getUsuario().getPuntaje())
                    .perfilPublico(r.getUsuario().getPerfilPublico())
                    .build();
        }).collect(Collectors.toList());
    }

    private GrupoDTO toGrupoDTO(Grupo g, boolean conMiembros) {
        return GrupoDTO.builder()
                .internalId(g.getInternalId())
                .numero(g.getNumero())
                .nombre(g.getNombre())
                .premio(g.getPremio())
                .codigoInvitacion(g.getCodigoInvitacion())
                .creadorId(g.getCreador().getInternalId())
                .creadorNombre(g.getCreador().getNombre() + " " + g.getCreador().getApellido())
                .transDate(g.getTransDate())
                .activo(g.getActivo())
                .build();
    }

    private GrupoRowDTO toGrupoRowDTO(GrupoRow r, List<EquipoFavorito> favs) {
        Pais campeon = r.getPaisCampeon();
        Jugador goleador = r.getGoleador();

        return GrupoRowDTO.builder()
                .internalId(r.getInternalId())
                .grupoId(r.getGrupo().getInternalId())
                .usuarioId(r.getUsuario().getInternalId())
                .usuarioNombre(r.getUsuario().getNombre())
                .usuarioApellido(r.getUsuario().getApellido())
                .urlAvatar(r.getUsuario().getUrlAvatar())
                .rol(r.getRol())
                .paisCampeonId(campeon != null ? campeon.getInternalId() : null)
                .paisCampeonNombre(campeon != null ? campeon.getNombre() : null)
                .paisCampeonCodigo(campeon != null ? campeon.getCodigo() : null)
                .goleadorId(goleador != null ? goleador.getInternalId() : null)
                .goleadorNombre(goleador != null ? goleador.getNombre() : null)
                .goleadorApellido(goleador != null ? goleador.getApellido() : null)
                .goleadorFoto(goleador != null ? goleador.getUrlFoto() : null)
                .fechaUnion(r.getFechaUnion())
                .equiposFavoritos(favs.stream().map(this::toEquipoFavoritoDTO).collect(Collectors.toList()))
                .puntaje(r.getUsuario().getPuntaje())
                .perfilPublico(r.getUsuario().getPerfilPublico())
                .build();
    }

    private EquipoFavoritoDTO toEquipoFavoritoDTO(EquipoFavorito ef) {
        return EquipoFavoritoDTO.builder()
                .internalId(ef.getInternalId())
                .paisId(ef.getPais().getInternalId())
                .paisNombre(ef.getPais().getNombre())
                .paisCodigo(ef.getPais().getCodigo())
                .orden(ef.getOrden())
                .transDate(ef.getTransDate())
                .build();
    }

    // ----------------------------------------------------------------
    // RANKING DE GRUPOS
    // ----------------------------------------------------------------
    @Transactional(readOnly = true)
    public List<GrupoRankingDTO> getRankingGrupos() {
        return grupoRepository.findTopGrupos().stream().map(row ->
            GrupoRankingDTO.builder()
                .internalId(((Number) row[0]).longValue())
                .nombre((String) row[1])
                .creadorNombre((String) row[2])
                .cantidadMiembros(((Number) row[3]).intValue())
                .puntajeTotal(((Number) row[4]).longValue())
                .build()
        ).collect(Collectors.toList());
    }
}
