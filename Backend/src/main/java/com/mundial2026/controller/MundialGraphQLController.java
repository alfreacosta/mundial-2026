package com.mundial2026.controller;

import com.mundial2026.dto.convocatoria.ConvocatoriaDTO;
import com.mundial2026.model.Confederacion;
import com.mundial2026.model.Fase;
import com.mundial2026.model.Pais;
import com.mundial2026.model.PosicionJugador;
import com.mundial2026.model.Jugador;
import com.mundial2026.model.Partido;
import com.mundial2026.repository.ConfederacionRepository;
import com.mundial2026.repository.FaseRepository;
import com.mundial2026.repository.PaisRepository;
import com.mundial2026.repository.PosicionJugadorRepository;
import com.mundial2026.repository.JugadorRepository;
import com.mundial2026.model.Usuario;
import com.mundial2026.repository.PartidoRepository;
import com.mundial2026.repository.UsuarioRepository;
import com.mundial2026.service.ConvocatoriaService;
import lombok.RequiredArgsConstructor;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;

import java.security.Principal;
import java.util.List;

@Controller
@RequiredArgsConstructor
public class MundialGraphQLController {

    private final ConfederacionRepository   confederacionRepository;
    private final FaseRepository            faseRepository;
    private final PosicionJugadorRepository posicionRepository;
    private final PaisRepository            paisRepository;
    private final JugadorRepository         jugadorRepository;
    private final PartidoRepository         partidoRepository;
    private final ConvocatoriaService       convocatoriaService;
    private final UsuarioRepository         usuarioRepository;

    // ---- Ranking ----

    @QueryMapping
    public List<Usuario> ranking() {
        return usuarioRepository.findByUserNotOrderByPuntajeDesc("admin");
    }

    // ---- Catálogos ----

    @QueryMapping
    public List<Confederacion> confederaciones() {
        return confederacionRepository.findAll();
    }

    @QueryMapping
    public List<Fase> fases() {
        return faseRepository.findAllByOrderByOrdenAsc();
    }

    @QueryMapping
    public List<PosicionJugador> posiciones() {
        return posicionRepository.findAll();
    }

    // ---- Países ----

    @QueryMapping
    @Transactional(readOnly = true)
    public List<Pais> paises() {
        return paisRepository.findAllWithConfederacion();
    }

    @QueryMapping
    @Transactional(readOnly = true)
    public List<Pais> paisesPorConfederacion(@Argument String codigo) {
        return paisRepository.findByConfederacionCodigoWithFetch(codigo);
    }

    // ---- Jugadores ----

    @QueryMapping
    @Transactional(readOnly = true)
    public List<Jugador> jugadores() {
        return jugadorRepository.findAllWithFetch();
    }

    @QueryMapping
    @Transactional(readOnly = true)
    public Jugador jugador(@Argument Long id) {
        return jugadorRepository.findById(id).orElse(null);
    }

    @QueryMapping
    @Transactional(readOnly = true)
    public List<Jugador> jugadoresPorPais(@Argument Long paisId) {
        return jugadorRepository.findByPaisInternalId(paisId);
    }

    @QueryMapping
    @Transactional(readOnly = true)
    public List<Jugador> jugadoresPorPosicion(@Argument String codigo) {
        return jugadorRepository.findByPosicionCodigo(codigo);
    }

    // ---- Partidos ----

    @QueryMapping
    public List<Partido> partidos() {
        return partidoRepository.findAll();
    }

    @QueryMapping
    public List<Partido> partidosPorFase(@Argument String faseCodigo) {
        return partidoRepository.findByFaseCodigo(faseCodigo);
    }

    // ---- Convocatorias ----

    @QueryMapping
    @PreAuthorize("isAuthenticated()")
    public ConvocatoriaDTO miConvocatoria(@Argument Long paisId, Principal principal) {
        return convocatoriaService.getMiConvocatoria(principal.getName(), paisId).orElse(null);
    }

    @MutationMapping
    @PreAuthorize("isAuthenticated()")
    public ConvocatoriaDTO guardarConvocatoria(@Argument Long paisId,
                                               @Argument List<Long> jugadorIds,
                                               @Argument List<Long> noVaIds,
                                               Principal principal) {
        return convocatoriaService.guardarConvocatoria(principal.getName(), paisId, jugadorIds, noVaIds);
    }
}
