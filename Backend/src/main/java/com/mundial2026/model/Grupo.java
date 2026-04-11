package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * * Grupo de amigos de Mundial 2026.
 * Cada grupo tiene un código de invitación único para que otros usuarios se unan.
 * creador_id → FK al Usuario que creó el grupo (tiene rol=CREADOR en GrupoRow).
 */
@Entity
@Table(name = "grupo")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Grupo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "internal_id")
    private Long internalId;

    @Column(name = "numero", nullable = false)
    private Integer numero;

    @Column(name = "nombre", nullable = false, length = 100)
    private String nombre;

    @Column(name = "premio", length = 255)
    private String premio;

    /** Código único que se comparte para invitar miembros al grupo */
    @Column(name = "codigo_invitacion", nullable = false, unique = true, length = 20)
    private String codigoInvitacion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creador_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Usuario creador;

    @Column(name = "trans_date", nullable = false)
    @Builder.Default
    private LocalDateTime transDate = LocalDateTime.now();

    @Column(name = "activo", nullable = false)
    @Builder.Default
    private Boolean activo = true;
}
