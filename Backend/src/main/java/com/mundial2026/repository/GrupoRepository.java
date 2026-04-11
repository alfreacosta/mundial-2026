package com.mundial2026.repository;

import com.mundial2026.model.Grupo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GrupoRepository extends JpaRepository<Grupo, Long> {

    Optional<Grupo> findByCodigoInvitacion(String codigoInvitacion);

    @Query("SELECT g FROM Grupo g WHERE g.creador.internalId = :usuarioId AND g.activo = true")
    List<Grupo> findGruposCreados(@Param("usuarioId") Long usuarioId);

    @Query(value = """
        SELECT g.internal_id, g.nombre,
               COALESCE(u.nombre,'') || ' ' || COALESCE(u.apellido,'') AS creador_nombre,
               COUNT(gr.internal_id) AS cantidad_miembros,
               COALESCE(SUM(m.puntaje), 0) AS puntaje_total
        FROM grupo g
        JOIN usuario u ON u.internal_id = g.creador_id
        LEFT JOIN grupo_row gr ON gr.master_id = g.internal_id
        LEFT JOIN usuario m ON m.internal_id = gr.usuario_id
        WHERE g.activo = true
        GROUP BY g.internal_id, g.nombre, u.nombre, u.apellido
        ORDER BY puntaje_total DESC
        LIMIT 10
        """, nativeQuery = true)
    List<Object[]> findTopGrupos();
}
