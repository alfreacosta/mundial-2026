package com.mundial2026.repository;

import com.mundial2026.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    Optional<Usuario> findByUser(String user);

    Optional<Usuario> findByEmail(String email);

    boolean existsByUser(String user);

    boolean existsByEmail(String email);

    Optional<Usuario> findByOauthProviderAndOauthId(String oauthProvider, String oauthId);

    List<Usuario> findByUserNotOrderByPuntajeDesc(String user);

    /** Buscar usuarios públicos por nombre, apellido o username (case-insensitive) */
    @Query(value = """
        SELECT * FROM usuario
        WHERE perfil_publico = true
          AND activo = true
          AND (nombre    ILIKE CONCAT('%', :q, '%')
            OR apellido  ILIKE CONCAT('%', :q, '%')
            OR user_name ILIKE CONCAT('%', :q, '%'))
        ORDER BY nombre ASC
        """, nativeQuery = true)
    List<Usuario> buscarPerfilesPublicos(@Param("q") String q);
}
