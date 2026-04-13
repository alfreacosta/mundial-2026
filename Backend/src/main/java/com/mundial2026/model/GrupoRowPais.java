package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "grupo_row_pais")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GrupoRowPais {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "internal_id")
    private Long internalId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "grupo_row_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private GrupoRow grupoRow;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pais_id", nullable = false)
    private Pais pais;

    @Column(name = "orden", nullable = false)
    private Integer orden;
}
