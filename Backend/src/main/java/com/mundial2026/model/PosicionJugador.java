package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * Catálogo de posiciones de jugador (ARQ, DEF, MED, DEL)
 */
@Entity
@Table(name = "posicion_jugador")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PosicionJugador {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "internal_id")
    private Long internalId;

    @Column(name = "nombre", nullable = false, length = 50)
    private String nombre;

    @Column(name = "codigo", nullable = false, unique = true, length = 10)
    private String codigo;

    @Column(name = "abreviatura", nullable = false, length = 10)
    private String abreviatura;

    @Column(name = "activo", nullable = false)
    @Builder.Default
    private Boolean activo = true;
}
