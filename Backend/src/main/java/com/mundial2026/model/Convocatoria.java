package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Cabecera de Convocatoria — un usuario elige su selección para un país
 * estado: EN_PROGRESO | CERRADA | EVALUADA
 */
@Entity
@Table(name = "convocatoria")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Convocatoria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "internal_id")
    private Long internalId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pais_id", nullable = false)
    private Pais pais;

    @Column(name = "trans_date", nullable = false)
    @Builder.Default
    private LocalDateTime transDate = LocalDateTime.now();

    @Column(name = "end_date")
    private LocalDateTime endDate;

    @Column(name = "cerrada", nullable = false)
    @Builder.Default
    private Boolean cerrada = false;

    @Column(name = "total_jugadores", nullable = false)
    @Builder.Default
    private Integer totalJugadores = 0;

    /** EN_PROGRESO | CERRADA | EVALUADA */
    @Column(name = "estado", nullable = false, length = 20)
    @Builder.Default
    private String estado = "EN_PROGRESO";

    @OneToMany(mappedBy = "convocatoria", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<ConvocatoriaRow> rows = new ArrayList<>();
}
