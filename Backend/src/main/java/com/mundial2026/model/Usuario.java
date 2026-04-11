package com.mundial2026.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * * Usuario del sistema Mundial 2026
 * NOTA de mapeo:
 *   Java field 'user'     → SQL column 'user_name'  (user es reservado en SQL)
 *   Java field 'password' → SQL column 'pass'        (password es reservado en SQL)
 */
@Entity
@Table(name = "usuario")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "internal_id")
    private Long internalId;

    @Column(name = "user_name", nullable = false, unique = true, length = 50)
    private String user;

    @Column(name = "email", nullable = false, unique = true, length = 100)
    private String email;

    @Column(name = "pass", length = 255)
    private String password;

    @Column(name = "oauth_provider", length = 20)
    private String oauthProvider;

    @Column(name = "oauth_id", length = 255)
    private String oauthId;

    @Column(name = "nombre", length = 100)
    private String nombre;

    @Column(name = "apellido", length = 100)
    private String apellido;

    @Column(name = "telefono", length = 30)
    private String telefono;

    @Column(name = "url_avatar", length = 255)
    private String urlAvatar;

    @Column(name = "puntaje", nullable = false)
    @Builder.Default
    private Integer puntaje = 0;

    @Column(name = "trans_date", nullable = false)
    @Builder.Default
    private LocalDateTime transDate = LocalDateTime.now();

    @Column(name = "ultimo_acceso")
    private LocalDateTime ultimoAcceso;

    @Column(name = "activo", nullable = false)
    @Builder.Default
    private Boolean activo = true;

    /** Si true, otros usuarios pueden buscar y ver el perfil público de este usuario */
    @Column(name = "perfil_publico", nullable = false)
    @Builder.Default
    private Boolean perfilPublico = true;
}
