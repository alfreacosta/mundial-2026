package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "estadio")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Estadio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "internal_id")
    private Long internalId;

    @Column(name = "nombre", length = 150)
    private String nombre;

    @Column(name = "ciudad", length = 100)
    private String ciudad;

    @Column(name = "pais", length = 50)
    private String pais;

    @Column(name = "capacidad")
    private Integer capacidad;

    @Column(name = "url_foto", length = 255)
    private String urlFoto;

    @Column(name = "api_venue_id")
    private Long apiVenueId;

    @Column(name = "activo")
    private Boolean activo;
}
