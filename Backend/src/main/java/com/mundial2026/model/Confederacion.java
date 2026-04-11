package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * Catálogo de confederaciones (UEFA, CONMEBOL, CONCACAF, CAF, AFC, OFC)
 */
@Entity
@Table(name = "confederacion")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Confederacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "internal_id")
    private Long internalId;

    @Column(name = "nombre", nullable = false, length = 150)
    private String nombre;

    @Column(name = "codigo", nullable = false, unique = true, length = 20)
    private String codigo;

    @Column(name = "abreviatura", nullable = false, length = 20)
    private String abreviatura;

    @Column(name = "activo", nullable = false)
    @Builder.Default
    private Boolean activo = true;
}
