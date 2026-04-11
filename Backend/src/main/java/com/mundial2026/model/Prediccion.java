package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Predicción de resultado de un partido por parte de un usuario
 */
@Entity
@Table(name = "prediccion")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Prediccion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "internal_id")
    private Long internalId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "partido_id", nullable = false)
    private Partido partido;

    @Column(name = "gol_local", nullable = false)
    @Builder.Default
    private Integer golLocal = 0;

    @Column(name = "gol_visitante", nullable = false)
    @Builder.Default
    private Integer golVisitante = 0;

    @Column(name = "aprobada", nullable = false)
    @Builder.Default
    private Boolean aprobada = false;

    @Column(name = "puntaje_obtenido")
    private Integer puntajeObtenido;

    @Column(name = "trans_date", nullable = false)
    @Builder.Default
    private LocalDateTime transDate = LocalDateTime.now();

    @Column(name = "fecha_actualizacion")
    private LocalDateTime fechaActualizacion;
}
