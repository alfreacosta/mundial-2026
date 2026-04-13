package com.mundial2026.service;

import com.mundial2026.dto.grupo.*;
import com.mundial2026.model.*;
import com.mundial2026.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GrupoService {

    private final GrupoRepository              grupoRepository;
    private final GrupoRowRepository           grupoRowRepository;
    private final GrupoRowPaisRepository       grupoRowPaisRepository;
    private final EquipoFavoritoRepository     equipoFavoritoRepository;
    private final PaisRepository               paisRepository;
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
                .cantidadPaises(req.getCantidadPaises() != null ? req.getCantidadPaises() : 5)
                .codigoInvitacion(codigo)
                .creador(creador)
                .activo(true)
                .build();

        grupoRepository.save(grupo);

        // Validar países seleccionados
        int cantPaises = grupo.getCantidadPaises();
        validarPaisIds(req.getPaisIds(), cantPaises, creador.getInternalId());

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

        GrupoRow row = rowBuilder.build();
        grupoRowRepository.save(row);

        guardarPaisesDelGrupo(row, req.getPaisIds());

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

        // Validar países seleccionados
        validarPaisIds(req.getPaisIds(), grupo.getCantidadPaises(), usuario.getInternalId());

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

        guardarPaisesDelGrupo(row, req.getPaisIds());

        List<GrupoRowPais> paises = grupoRowPaisRepository.findByGrupoRowId(row.getInternalId());
        return toGrupoRowDTO(row, paises);
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
     * Construye la lista de DTOs de miembros leyendo la predicción
     * desde prediccion_torneo y los países desde grupo_row_pais.
     */
    private List<GrupoRowDTO> buildMiembrosDTO(List<GrupoRow> miembros) {
        return miembros.stream().map(r -> {
            Long uid = r.getUsuario().getInternalId();

            // Países específicos del grupo (no los globales)
            List<GrupoRowPais> paisesGrupo = grupoRowPaisRepository.findByGrupoRowId(r.getInternalId());

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
                    .equiposFavoritos(paisesGrupo.stream().map(this::toGrupoRowPaisDTO).collect(Collectors.toList()))
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
                .cantidadPaises(g.getCantidadPaises())
                .build();
    }

    private GrupoRowDTO toGrupoRowDTO(GrupoRow r, List<GrupoRowPais> paises) {
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
                .equiposFavoritos(paises.stream().map(this::toGrupoRowPaisDTO).collect(Collectors.toList()))
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

    private EquipoFavoritoDTO toGrupoRowPaisDTO(GrupoRowPais grp) {
        return EquipoFavoritoDTO.builder()
                .internalId(grp.getInternalId())
                .paisId(grp.getPais().getInternalId())
                .paisNombre(grp.getPais().getNombre())
                .paisCodigo(grp.getPais().getCodigo())
                .orden(grp.getOrden())
                .build();
    }

    /**
     * Valida que la cantidad de países coincida con la cantidad requerida
     * y que todos los países sean favoritos del usuario.
     */
    private void validarPaisIds(List<Long> paisIds, int cantidadRequerida, Long usuarioId) {
        if (paisIds == null || paisIds.size() != cantidadRequerida) {
            throw new IllegalArgumentException(
                    "Debés seleccionar exactamente " + cantidadRequerida + " país(es)");
        }
        // Verificar que no haya duplicados
        if (Set.copyOf(paisIds).size() != paisIds.size()) {
            throw new IllegalArgumentException("No se permiten países duplicados");
        }
        // Verificar que todos los países sean favoritos del usuario
        List<EquipoFavorito> favs = equipoFavoritoRepository.findByUsuarioId(usuarioId);
        Set<Long> favPaisIds = favs.stream()
                .map(f -> f.getPais().getInternalId())
                .collect(Collectors.toSet());
        for (Long paisId : paisIds) {
            if (!favPaisIds.contains(paisId)) {
                throw new IllegalArgumentException(
                        "El país con id " + paisId + " no está entre tus favoritos");
            }
        }
    }

    private void guardarPaisesDelGrupo(GrupoRow row, List<Long> paisIds) {
        for (int i = 0; i < paisIds.size(); i++) {
            Pais pais = paisRepository.findById(paisIds.get(i))
                    .orElseThrow(() -> new RuntimeException("País no encontrado"));
            GrupoRowPais grp = GrupoRowPais.builder()
                    .grupoRow(row)
                    .pais(pais)
                    .orden(i + 1)
                    .build();
            grupoRowPaisRepository.save(grp);
        }
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
