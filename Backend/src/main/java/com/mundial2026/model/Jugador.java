package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Jugador de fútbol que participa en el Mundial 2026
 * nombre_completo es columna GENERADA en SQL (nombre || ' ' || apellido)
 * → solo lectura en JPA, no se persiste desde Java
 */
@Entity
@Table(name = "jugador")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Jugador {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "internal_id")
    private Long internalId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pais_id", nullable = false)
    private Pais pais;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "posicion_id", nullable = false)
    private PosicionJugador posicion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "club_id")
    private Club club;

    @Column(name = "nombre", nullable = false, length = 100)
    private String nombre;

    @Column(name = "apellido", nullable = false, length = 100)
    private String apellido;

    /**
     * Columna GENERADA en PostgreSQL (STORED).
     * JPA solo la lee, nunca la escribe.
     */
    @Column(name = "nombre_completo", insertable = false, updatable = false, length = 200)
    private String nombreCompleto;

    @Column(name = "fecha_nacimiento")
    private LocalDate fechaNacimiento;

    @Column(name = "edad")
    private Integer edad;

    @Column(name = "numero_camiseta")
    private Integer numeroCamiseta;

    @Column(name = "url_foto", length = 255)
    private String urlFoto;

    @Column(name = "api_player_id")
    private Long apiPlayerId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "stats_json", columnDefinition = "jsonb")
    private String statsJson;

    @Column(name = "ultima_stats_sync")
    private LocalDateTime ultimaStatsSync;

    @Column(name = "partidos_temporada")
    private Integer partidosTemporada;

    @Column(name = "convocado_eliminatoria")
    @Builder.Default
    private Boolean convocadoEliminatoria = false;

    @Column(name = "rating", precision = 4, scale = 2)
    private java.math.BigDecimal rating;
}
