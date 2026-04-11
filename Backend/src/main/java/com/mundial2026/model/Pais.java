package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * País participante del Mundial 2026
 */
@Entity
@Table(name = "pais")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Pais {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "internal_id")
    private Long internalId;

    @Column(name = "nombre", nullable = false, length = 100)
    private String nombre;

    @Column(name = "codigo", nullable = false, unique = true, length = 10)
    private String codigo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "confederacion_id", nullable = false)
    private Confederacion confederacion;

    /** Grupo del sorteo (A, B, C ... L) — se completa tras el sorteo oficial */
    @Column(name = "grupo", length = 5)
    private String grupo;

    @Column(name = "activo", nullable = false)
    @Builder.Default
    private Boolean activo = true;

    // Estadisticas de fase de grupos
    @Column(name = "pj", nullable = false)
    @Builder.Default
    private Integer pj = 0;

    @Column(name = "pg", nullable = false)
    @Builder.Default
    private Integer pg = 0;

    @Column(name = "pe", nullable = false)
    @Builder.Default
    private Integer pe = 0;

    @Column(name = "pp", nullable = false)
    @Builder.Default
    private Integer pp = 0;

    @Column(name = "pts", nullable = false)
    @Builder.Default
    private Integer pts = 0;

    // API-Football sync
    @Column(name = "api_team_id")
    private Long apiTeamId;

    @Column(name = "logo_url", length = 300)
    private String logoUrl;

    @Column(name = "ultimo_sync")
    private java.time.LocalDateTime ultimoSync;
}
