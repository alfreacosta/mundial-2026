package com.mundial2026.repository;

import com.mundial2026.model.Prediccion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PrediccionRepository extends JpaRepository<Prediccion, Long> {

    Optional<Prediccion> findByUsuario_UserAndPartido_InternalId(String username, Long partidoId);

    @Query("""
        SELECT p FROM Prediccion p
        JOIN FETCH p.partido pa
        JOIN FETCH pa.fase
        LEFT JOIN FETCH pa.equipoLocal
        LEFT JOIN FETCH pa.equipoVisitante
        WHERE p.usuario.user = :username AND pa.internalId = :partidoId
    """)
    Optional<Prediccion> findByUsuarioAndPartidoWithTeams(@Param("username") String username,
                                                          @Param("partidoId") Long partidoId);

    List<Prediccion> findByPartido_InternalId(Long partidoId);

    @Query("""
        SELECT p FROM Prediccion p
        JOIN FETCH p.partido pa
        JOIN FETCH pa.fase
        LEFT JOIN FETCH pa.equipoLocal
        LEFT JOIN FETCH pa.equipoVisitante
        WHERE p.usuario.user = :username
        ORDER BY pa.transDate ASC
    """)
    List<Prediccion> findByUsernameWithPartido(@Param("username") String username);

    long countByUsuario_User(String username);

    @Query("""
        SELECT COALESCE(SUM(p.puntajeObtenido), 0)
        FROM Prediccion p
        WHERE p.usuario.user = :username
          AND p.puntajeObtenido IS NOT NULL
    """)
    int sumPuntajeByUsername(@Param("username") String username);
}
