package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Cabecera de Alineación — el usuario arma su 11 para un partido
 */
@Entity
@Table(name = "alineacion")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Alineacion {

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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pais_id", nullable = false)
    private Pais pais;

    @Column(name = "trans_date", nullable = false)
    @Builder.Default
    private LocalDateTime transDate = LocalDateTime.now();

    @Column(name = "fecha_actualizacion")
    private LocalDateTime fechaActualizacion;

    @Column(name = "confirmada", nullable = false)
    @Builder.Default
    private Boolean confirmada = false;

    /** Formación táctica: 4-3-3, 4-4-2, etc. */
    @Column(name = "formacion", length = 10)
    private String formacion;

    @Column(name = "total_jugadores_convocados", nullable = false)
    @Builder.Default
    private Integer totalJugadoresConvocados = 0;

    @OneToMany(mappedBy = "alineacion", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<AlineacionRow> rows = new ArrayList<>();
}
