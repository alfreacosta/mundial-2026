package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Equipos favoritos globales de un usuario para todo el torneo.
 * Cada usuario puede elegir hasta 5 equipos (orden 1 a 5).
 * Son independientes de los grupos: aplican en todos los grupos en los que participe.
 */
@Entity
@Table(name = "equipo_favorito")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EquipoFavorito {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "internal_id")
    private Long internalId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pais_id", nullable = false)
    private Pais pais;

    /** Posición del equipo favorito: 1 a 5 */
    @Column(name = "orden", nullable = false)
    private Integer orden;

    @Column(name = "trans_date", nullable = false)
    @Builder.Default
    private LocalDateTime transDate = LocalDateTime.now();
}
