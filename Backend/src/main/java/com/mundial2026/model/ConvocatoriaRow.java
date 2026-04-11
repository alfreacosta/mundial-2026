package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Detalle de Convocatoria — cada jugador convocado por el usuario
 * estado: PENDIENTE | CONVOCADO | NO_VA
 * master_id → FK a convocatoria(internal_id)
 */
@Entity
@Table(name = "convocatoria_row")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConvocatoriaRow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "internal_id")
    private Long internalId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "master_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Convocatoria convocatoria;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "jugador_id", nullable = false)
    private Jugador jugador;

    /** PENDIENTE | CONVOCADO | NO_VA */
    @Column(name = "estado", nullable = false, length = 20)
    @Builder.Default
    private String estado = "PENDIENTE";

    @Column(name = "trans_date", nullable = false)
    @Builder.Default
    private LocalDateTime transDate = LocalDateTime.now();
}
