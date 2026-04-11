package com.mundial2026.controller;

import com.mundial2026.dto.grupo.AgregarFavoritoRequest;
import com.mundial2026.dto.grupo.EquipoFavoritoDTO;
import com.mundial2026.dto.prediccion.PrediccionTorneoDTO;
import com.mundial2026.model.Convocatoria;
import com.mundial2026.model.ConvocatoriaRow;
import com.mundial2026.model.Usuario;
import com.mundial2026.repository.ConvocatoriaRepository;
import com.mundial2026.repository.UsuarioRepository;
import com.mundial2026.service.EquipoFavoritoService;
import com.mundial2026.service.PrediccionTorneoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Controller para buscar usuarios y ver perfiles públicos.
 * Solo retorna usuarios con perfilPublico = true.
 */
@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
public class UsuarioController {

    private final UsuarioRepository         usuarioRepository;
    private final EquipoFavoritoService     equipoFavoritoService;
    private final ConvocatoriaRepository    convocatoriaRepository;
    private final PrediccionTorneoService   prediccionTorneoService;

    /**
     * Ver perfil público de un usuario por su username.
     * Solo retorna si perfilPublico = true.
     */
    @GetMapping("/{user}/perfil")
    public ResponseEntity<PerfilPublicoDTO> getPerfilPublico(@PathVariable("user") String user) {
        return usuarioRepository.findByUser(user)
                .filter(u -> Boolean.TRUE.equals(u.getPerfilPublico()) && Boolean.TRUE.equals(u.getActivo()))
                .map(PerfilPublicoDTO::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Datos de juego públicos de un usuario: favoritos, predicción y convocados por equipo.
     * Solo disponible si perfilPublico = true.
     */
    @GetMapping("/{user}/juego")
    @Transactional(readOnly = true)
    public ResponseEntity<JuegoPublicoDTO> getJuegoPerfil(@PathVariable("user") String user) {
        Usuario u = usuarioRepository.findByUser(user)
                .filter(uu -> Boolean.TRUE.equals(uu.getPerfilPublico()) && Boolean.TRUE.equals(uu.getActivo()))
                .orElse(null);
        if (u == null) return ResponseEntity.notFound().build();

        // Favoritos
        List<EquipoFavoritoDTO> favoritos = equipoFavoritoService.getMisFavoritos(user);

        // Predicción
        PrediccionTorneoDTO prediccion = prediccionTorneoService.getMiPrediccion(user);

        // Convocatorias: paisId -> resumen (datos país + jugadores CONVOCADOS)
        List<Convocatoria> convocatorias = convocatoriaRepository.findByUsuario_User(user);
        Map<Long, ConvocatoriaResumenDTO> convMap = new java.util.HashMap<>();
        for (Convocatoria conv : convocatorias) {
            List<JugadorResumenDTO> jugadores = conv.getRows().stream()
                    .filter(r -> "CONVOCADO".equals(r.getEstado()))
                    .map(r -> JugadorResumenDTO.from(r))
                    .sorted(java.util.Comparator.comparing(j -> j.posicionAbr()))
                    .collect(Collectors.toList());
            if (!jugadores.isEmpty()) {
                var pais = conv.getPais();
                convMap.put(pais.getInternalId(), new ConvocatoriaResumenDTO(
                        pais.getNombre(), pais.getCodigo(), jugadores));
            }
        }

        return ResponseEntity.ok(new JuegoPublicoDTO(favoritos, prediccion, convMap));
    }

    /**
     * Buscar usuarios por nombre, apellido o username.
     * Solo retorna perfiles públicos.
     * Parámetro: q (query de búsqueda)
     */
    @GetMapping("/buscar")
    public ResponseEntity<List<PerfilPublicoDTO>> buscarUsuarios(
            @RequestParam String q,
            @AuthenticationPrincipal UserDetails userDetails) {

        if (q == null || q.trim().length() < 2) {
            return ResponseEntity.badRequest().build();
        }

        List<Usuario> usuarios = usuarioRepository.buscarPerfilesPublicos(q.trim());

        List<PerfilPublicoDTO> resultado = usuarios.stream()
                .filter(u -> !u.getUser().equals(userDetails.getUsername()))
                .map(PerfilPublicoDTO::from)
                .collect(Collectors.toList());

        return ResponseEntity.ok(resultado);
    }

    /** Activar/desactivar el perfil público del usuario autenticado */
    @PatchMapping("/perfil-publico")
    public ResponseEntity<Void> togglePerfilPublico(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody java.util.Map<String, Boolean> body) {

        Boolean value = body.get("perfilPublico");
        if (value == null) return ResponseEntity.badRequest().build();

        Usuario usuario = usuarioRepository.findByUser(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        usuario.setPerfilPublico(value);
        usuarioRepository.save(usuario);
        return ResponseEntity.noContent().build();
    }

    // ----------------------------------------------------------------
    // FAVORITOS (globales del usuario para todo el torneo)
    // ----------------------------------------------------------------

    /** Obtener mis equipos favoritos */
    @GetMapping("/favoritos")
    public ResponseEntity<List<EquipoFavoritoDTO>> getMisFavoritos(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(equipoFavoritoService.getMisFavoritos(userDetails.getUsername()));
    }

    /** Agregar un equipo favorito */
    @PostMapping("/favoritos")
    public ResponseEntity<EquipoFavoritoDTO> agregarFavorito(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody AgregarFavoritoRequest req) {
        return ResponseEntity.ok(equipoFavoritoService.agregarFavorito(userDetails.getUsername(), req));
    }

    /** Reemplazar todos los favoritos de una vez (lista de hasta 5 paisIds en orden) */
    @PutMapping("/favoritos")
    public ResponseEntity<List<EquipoFavoritoDTO>> setFavoritos(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody List<Long> paisIds) {
        return ResponseEntity.ok(equipoFavoritoService.setFavoritos(userDetails.getUsername(), paisIds));
    }

    /** Quitar un equipo favorito por paisId */
    @DeleteMapping("/favoritos/{paisId}")
    public ResponseEntity<Void> quitarFavorito(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long paisId) {
        equipoFavoritoService.quitarFavorito(userDetails.getUsername(), paisId);
        return ResponseEntity.noContent().build();
    }

    /** DTO datos de juego público: favoritos + predicción + convocados */
    public record JuegoPublicoDTO(
            List<EquipoFavoritoDTO> favoritos,
            PrediccionTorneoDTO prediccion,
            Map<Long, ConvocatoriaResumenDTO> convocatorias
    ) {}

    /** DTO resumen de convocatoria con datos del país */
    public record ConvocatoriaResumenDTO(
            String paisNombre,
            String paisCodigo,
            List<JugadorResumenDTO> jugadores
    ) {}

    /** DTO resumido de jugador para perfil público */
    public record JugadorResumenDTO(
            Long id,
            String nombre,
            Integer numeroCamiseta,
            String posicion,
            String posicionAbr,
            String urlFoto
    ) {
        public static JugadorResumenDTO from(ConvocatoriaRow row) {
            var j = row.getJugador();
            var pos = j.getPosicion();
            return new JugadorResumenDTO(
                    j.getInternalId(),
                    j.getNombreCompleto() != null ? j.getNombreCompleto() : j.getNombre() + " " + (j.getApellido() != null ? j.getApellido() : ""),
                    j.getNumeroCamiseta(),
                    pos != null ? pos.getNombre() : "",
                    pos != null ? pos.getAbreviatura() : "",
                    j.getUrlFoto()
            );
        }
    }

    /** DTO interno para perfiles públicos */
    public record PerfilPublicoDTO(
            Long internalId,
            String user,
            String nombre,
            String apellido,
            String urlAvatar,
            Integer puntaje
    ) {
        public static PerfilPublicoDTO from(Usuario u) {
            return new PerfilPublicoDTO(
                    u.getInternalId(),
                    u.getUser(),
                    u.getNombre(),
                    u.getApellido(),
                    u.getUrlAvatar(),
                    u.getPuntaje()
            );
        }
    }
}
