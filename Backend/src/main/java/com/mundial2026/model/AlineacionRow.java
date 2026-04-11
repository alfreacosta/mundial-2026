package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * Detalle de Alineación — cada jugador en la alineación
 * estado: TITULAR | SUPLENTE
 * master_id → FK a alineacion(internal_id)
 */
@Entity
@Table(name = "alineacion_row")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlineacionRow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "internal_id")
    private Long internalId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "master_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Alineacion alineacion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "jugador_id", nullable = false)
    private Jugador jugador;

    /** TITULAR | SUPLENTE */
    @Column(name = "estado", nullable = false, length = 20)
    private String estado;
}
