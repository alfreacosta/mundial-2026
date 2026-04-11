package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * Club de fútbol al que pertenece un jugador
 */
@Entity
@Table(name = "club")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Club {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "internal_id")
    private Long internalId;

    @Column(name = "nombre", nullable = false, length = 150)
    private String nombre;

    @Column(name = "codigo", nullable = false, unique = true, length = 20)
    private String codigo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pais_id", nullable = false)
    private Pais pais;

    @Column(name = "url_escudo", length = 255)
    private String urlEscudo;

    @Column(name = "activo", nullable = false)
    @Builder.Default
    private Boolean activo = true;
}
