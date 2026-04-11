package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Partido del Mundial 2026
 * estado: PENDIENTE | EN_CURSO | FINALIZADO
 */
@Entity
@Table(name = "partido")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Partido {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "internal_id")
    private Long internalId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "equipo_local_id")
    private Pais equipoLocal;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "equipo_visitante_id")
    private Pais equipoVisitante;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fase_id", nullable = false)
    private Fase fase;

    /** Fecha y hora del partido */
    @Column(name = "trans_date", nullable = false)
    private LocalDateTime transDate;

    @Column(name = "estadio", length = 150)
    private String estadio;

    @Column(name = "gol_local")
    private Integer golLocal;

    @Column(name = "gol_visitante")
    private Integer golVisitante;

    /** PENDIENTE | EN_CURSO | FINALIZADO */
    @Column(name = "estado", nullable = false, length = 20)
    @Builder.Default
    private String estado = "PENDIENTE";

    @Column(name = "finalizado", nullable = false)
    @Builder.Default
    private Boolean finalizado = false;

    /** Fecha/hora de cierre del partido */
    @Column(name = "end_date")
    private LocalDateTime endDate;
}
