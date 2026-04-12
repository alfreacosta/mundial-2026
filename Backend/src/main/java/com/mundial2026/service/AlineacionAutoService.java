package com.mundial2026.service;

import com.mundial2026.model.*;
import com.mundial2026.repository.*;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Cada minuto revisa si hay partidos que empiezan AHORA.
 * Para cada partido que arranca, toma los titulares (TITULAR en convocatoria_row)
 * de cada usuario que tenga ese equipo como favorito y crea automáticamente
 * la Alineacion + AlineacionRow. Queda confirmada = true (cerrada).
 */
@Service
@RequiredArgsConstructor
public class AlineacionAutoService {

    private static final Logger log = LoggerFactory.getLogger(AlineacionAutoService.class);

    private final PartidoRepository partidoRepository;
    private final EquipoFavoritoRepository equipoFavoritoRepository;
    private final ConvocatoriaRepository convocatoriaRepository;
    private final AlineacionRepository alineacionRepository;

    /**
     * Se ejecuta cada 60 segundos.
     * Busca partidos cuya trans_date esté en la ventana [ahora-1min, ahora+1min]
     * y que estén en estado PENDIENTE → los marca EN_CURSO y crea alineaciones.
     */
    @Scheduled(fixedRate = 60_000)
    @Transactional
    public void procesarPartidosQueInician() {
        LocalDateTime ahora = LocalDateTime.now();
        LocalDateTime desde = ahora.minusMinutes(1);
        LocalDateTime hasta = ahora.plusMinutes(1);

        List<Partido> partidos = partidoRepository.findByDateRange(desde, hasta);

        for (Partido partido : partidos) {
            if (!"PENDIENTE".equals(partido.getEstado())) continue;

            log.info("⚽ Partido iniciando: {} vs {} (id={})",
                    partido.getEquipoLocal() != null ? partido.getEquipoLocal().getNombre() : "TBD",
                    partido.getEquipoVisitante() != null ? partido.getEquipoVisitante().getNombre() : "TBD",
                    partido.getInternalId());

            // Marcar partido como EN_CURSO
            partido.setEstado("EN_CURSO");

            // Crear alineaciones para equipo local
            if (partido.getEquipoLocal() != null) {
                crearAlineacionesPara(partido, partido.getEquipoLocal());
            }
            // Crear alineaciones para equipo visitante
            if (partido.getEquipoVisitante() != null) {
                crearAlineacionesPara(partido, partido.getEquipoVisitante());
            }
        }
    }

    /**
     * Para un partido + país, busca todos los usuarios que tengan ese país como favorito
     * Y tengan titulares configurados → crea Alineacion + AlineacionRow.
     */
    private void crearAlineacionesPara(Partido partido, Pais pais) {
        // Todos los usuarios que tienen este país como favorito
        List<EquipoFavorito> favoritos = equipoFavoritoRepository.findByPaisInternalId(pais.getInternalId());

        for (EquipoFavorito fav : favoritos) {
            Usuario usuario = fav.getUsuario();

            // Verificar que no exista ya una alineación para este usuario/partido/pais
            if (alineacionRepository.existsByUsuario_InternalIdAndPartido_InternalIdAndPais_InternalId(
                    usuario.getInternalId(), partido.getInternalId(), pais.getInternalId())) {
                continue;
            }

            // Buscar la convocatoria del usuario para este país
            var convOpt = convocatoriaRepository.findByUsernameAndPaisId(
                    usuario.getUser(), pais.getInternalId());

            if (convOpt.isEmpty()) continue;

            Convocatoria conv = convOpt.get();

            // Filtrar rows con estado TITULAR
            List<ConvocatoriaRow> titulares = conv.getRows().stream()
                    .filter(r -> "TITULAR".equals(r.getEstado()))
                    .toList();

            if (titulares.isEmpty()) continue;

            // Crear la alineación
            Alineacion alineacion = Alineacion.builder()
                    .usuario(usuario)
                    .partido(partido)
                    .pais(pais)
                    .confirmada(true)
                    .totalJugadoresConvocados(titulares.size())
                    .build();

            // Crear las filas
            for (ConvocatoriaRow cr : titulares) {
                AlineacionRow row = AlineacionRow.builder()
                        .alineacion(alineacion)
                        .jugador(cr.getJugador())
                        .estado("TITULAR")
                        .build();
                alineacion.getRows().add(row);
            }

            alineacionRepository.save(alineacion);

            log.info("✅ Alineación creada: usuario='{}', país={}, partido={}, titulares={}",
                    usuario.getUser(), pais.getNombre(), partido.getInternalId(), titulares.size());
        }
    }
}
