package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Predicción del torneo completo — campeón y goleador
 * Un usuario solo puede tener una predicción de torneo (UNIQUE usuario_id)
 */
@Entity
@Table(name = "prediccion_torneo")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PrediccionTorneo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "internal_id")
    private Long internalId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pais_campeon_id", nullable = false)
    private Pais paisCampeon;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "jugador_goleador_id", nullable = false)
    private Jugador jugadorGoleador;

    @Column(name = "trans_date", nullable = false)
    @Builder.Default
    private LocalDateTime transDate = LocalDateTime.now();

    @Column(name = "fecha_actualizacion")
    private LocalDateTime fechaActualizacion;

    @Column(name = "end_date")
    private LocalDateTime endDate;

    @Column(name = "confirmada", nullable = false)
    @Builder.Default
    private Boolean confirmada = false;
}
