package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Detalle de Grupo — una fila por cada miembro del grupo.
 * rol: CREADOR | MIEMBRO
 * master_id → FK a grupo(internal_id)
 * Al unirse, el usuario debe elegir obligatoriamente:
 *   - paisCampeon: el país que predice campeón del torneo
 *   - goleador: el jugador que predice como goleador del torneo
 */
@Entity
@Table(name = "grupo_row")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GrupoRow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "internal_id")
    private Long internalId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "master_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Grupo grupo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Usuario usuario;

    /** CREADOR | MIEMBRO */
    @Column(name = "rol", nullable = false, length = 20)
    @Builder.Default
    private String rol = "MIEMBRO";

    /** Predicción obligatoria: país campeón del torneo */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pais_campeon_id", nullable = false)
    private Pais paisCampeon;

    /** Predicción obligatoria: goleador del torneo */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "goleador_id", nullable = false)
    private Jugador goleador;

    @Column(name = "fecha_union", nullable = false)
    @Builder.Default
    private LocalDateTime fechaUnion = LocalDateTime.now();
}
