package com.mundial2026.repository;

import com.mundial2026.model.Convocatoria;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConvocatoriaRepository extends JpaRepository<Convocatoria, Long> {

    @Query("SELECT c FROM Convocatoria c LEFT JOIN FETCH c.rows r LEFT JOIN FETCH r.jugador WHERE c.usuario.user = :username AND c.pais.internalId = :paisId")
    Optional<Convocatoria> findByUsernameAndPaisId(@Param("username") String username,
                                                   @Param("paisId") Long paisId);

    /** Todas las convocatorias de un usuario con rows y jugadores en una sola query (evita N+1). */
    @Query("SELECT DISTINCT c FROM Convocatoria c LEFT JOIN FETCH c.rows r LEFT JOIN FETCH r.jugador j LEFT JOIN FETCH j.posicion WHERE c.usuario.user = :username")
    List<Convocatoria> findByUsuario_User(@Param("username") String username);
}
