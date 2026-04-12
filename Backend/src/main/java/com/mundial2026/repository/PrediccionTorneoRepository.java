package com.mundial2026.repository;

import com.mundial2026.model.PrediccionTorneo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PrediccionTorneoRepository extends JpaRepository<PrediccionTorneo, Long> {

    @Query("SELECT pt FROM PrediccionTorneo pt " +
           "LEFT JOIN FETCH pt.paisCampeon " +
           "LEFT JOIN FETCH pt.jugadorGoleador " +
           "WHERE pt.usuario.internalId = :usuarioId")
    Optional<PrediccionTorneo> findByUsuarioId(@Param("usuarioId") Long usuarioId);

    boolean existsByUsuario_InternalId(Long usuarioId);

    java.util.Optional<PrediccionTorneo> findByUsuario_User(String username);
}
