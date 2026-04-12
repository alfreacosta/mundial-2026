package com.mundial2026.service;

import com.mundial2026.dto.convocatoria.ConvocatoriaDTO;
import com.mundial2026.model.Convocatoria;
import com.mundial2026.model.ConvocatoriaRow;
import com.mundial2026.model.Jugador;
import com.mundial2026.model.Pais;
import com.mundial2026.model.Usuario;
import com.mundial2026.repository.ConvocatoriaRepository;
import com.mundial2026.repository.EquipoFavoritoRepository;
import com.mundial2026.repository.JugadorRepository;
import com.mundial2026.repository.PaisRepository;
import com.mundial2026.repository.UsuarioRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ConvocatoriaService {

    private final ConvocatoriaRepository convocatoriaRepository;
    private final UsuarioRepository      usuarioRepository;
    private final PaisRepository         paisRepository;
    private final JugadorRepository      jugadorRepository;
    private final EquipoFavoritoRepository equipoFavoritoRepository;

    @PersistenceContext
    private EntityManager entityManager;

    /** Devuelve la convocatoria existente del usuario para un país (puede ser null). */
    @Transactional(readOnly = true)
    public Optional<ConvocatoriaDTO> getMiConvocatoria(String username, Long paisId) {
        System.out.println("🔍 getMiConvocatoria() - Buscando: username='" + username + "', paisId=" + paisId);
        var result = convocatoriaRepository.findByUsernameAndPaisId(username, paisId);
        System.out.println("🔍 getMiConvocatoria() - Resultado: " + result);
        return result.map(this::toDTO);
    }

    /**
     * Crea o reemplaza la convocatoria del usuario para un país.
     * Limpia las filas anteriores y persiste las nuevas.
     */
    @Transactional
    public ConvocatoriaDTO guardarConvocatoria(String username, Long paisId, List<Long> jugadorIds, List<Long> noVaIds, List<Long> titularesIds) {
        System.out.println("💾 guardarConvocatoria() - username='" + username + "', paisId=" + paisId + ", jugadorIds=" + jugadorIds + ", noVaIds=" + noVaIds);

        Usuario usuario = usuarioRepository.findByUser(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + username));

        // Validar que el país esté en los favoritos del usuario
        boolean esFavorito = equipoFavoritoRepository
                .existsByUsuario_InternalIdAndPais_InternalId(usuario.getInternalId(), paisId);
        if (!esFavorito) {
            throw new RuntimeException("No podés armar una convocatoria para este país — primero sumalo a tus equipos favoritos desde tu perfil.");
        }

        Pais pais = paisRepository.findById(paisId)
                .orElseThrow(() -> new RuntimeException("País no encontrado: " + paisId));

        // Buscar convocatoria existente o crear una nueva
        Convocatoria conv = convocatoriaRepository.findByUsernameAndPaisId(username, paisId)
                .orElseGet(() -> Convocatoria.builder()
                        .usuario(usuario)
                        .pais(pais)
                        .build());

        // Limpiar filas anteriores y forzar flush para que el DELETE ocurra
        // ANTES que el INSERT — evita violación de constraint uq_convocatoria_row_jugador
        conv.getRows().clear();
        convocatoriaRepository.saveAndFlush(conv);
        entityManager.flush();

        // Agregar filas CONVOCADO
        List<Jugador> jugadores = jugadorRepository.findAllById(jugadorIds);
        for (Jugador j : jugadores) {
            ConvocatoriaRow row = ConvocatoriaRow.builder()
                    .convocatoria(conv)
                    .jugador(j)
                    .estado("CONVOCADO")
                    .build();
            conv.getRows().add(row);
        }

        // Agregar filas NO_VA
        List<Long> safeNoVaIds = noVaIds != null ? noVaIds : List.of();
        if (!safeNoVaIds.isEmpty()) {
            List<Jugador> noVaJugadores = jugadorRepository.findAllById(safeNoVaIds);
            for (Jugador j : noVaJugadores) {
                ConvocatoriaRow row = ConvocatoriaRow.builder()
                        .convocatoria(conv)
                        .jugador(j)
                        .estado("NO_VA")
                        .build();
                conv.getRows().add(row);
            }
        }

        // Agregar filas TITULAR
        List<Long> safeTitularesIds = titularesIds != null ? titularesIds : List.of();
        if (!safeTitularesIds.isEmpty()) {
            List<Jugador> titulares = jugadorRepository.findAllById(safeTitularesIds);
            for (Jugador j : titulares) {
                ConvocatoriaRow row = ConvocatoriaRow.builder()
                        .convocatoria(conv)
                        .jugador(j)
                        .estado("TITULAR")
                        .build();
                conv.getRows().add(row);
            }
        }

        conv.setTotalJugadores(jugadores.size());
        conv.setEstado("EN_PROGRESO");

        Convocatoria saved = convocatoriaRepository.save(conv);
        System.out.println("✅ guardarConvocatoria() - Guardado: id=" + saved.getInternalId() + ", totalJugadores=" + saved.getTotalJugadores());
        return toDTO(saved);
    }

    private ConvocatoriaDTO toDTO(Convocatoria c) {
        List<Long> convocadoIds = c.getRows().stream()
                .filter(r -> "CONVOCADO".equals(r.getEstado()))
                .map(r -> r.getJugador().getInternalId())
                .collect(Collectors.toList());
        List<Long> noVaIds = c.getRows().stream()
                .filter(r -> "NO_VA".equals(r.getEstado()))
                .map(r -> r.getJugador().getInternalId())
                .collect(Collectors.toList());
        List<Long> titularesIds = c.getRows().stream()
                .filter(r -> "TITULAR".equals(r.getEstado()))
                .map(r -> r.getJugador().getInternalId())
                .collect(Collectors.toList());
        return new ConvocatoriaDTO(c.getTotalJugadores(), c.getEstado(), convocadoIds, noVaIds, titularesIds);
    }
}
