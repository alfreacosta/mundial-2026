package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * Catálogo de fases del torneo (GRUPOS, OCTAVOS, CUARTOS, SEMIFINAL, TERCER_PUESTO, FINAL)
 */
@Entity
@Table(name = "fase")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Fase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "internal_id")
    private Long internalId;

    @Column(name = "nombre", nullable = false, length = 100)
    private String nombre;

    @Column(name = "codigo", nullable = false, unique = true, length = 30)
    private String codigo;

    @Column(name = "orden", nullable = false)
    private Integer orden;

    @Column(name = "activo", nullable = false)
    @Builder.Default
    private Boolean activo = true;
}
