package com.mundial2026.repository;

import com.mundial2026.model.Jugador;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JugadorRepository extends JpaRepository<Jugador, Long> {

    @Query("SELECT j FROM Jugador j JOIN FETCH j.posicion JOIN FETCH j.pais LEFT JOIN FETCH j.club ORDER BY j.pais.nombre, j.posicion.internalId, j.apellido")
    List<Jugador> findAllWithFetch();

    @Query("SELECT j FROM Jugador j JOIN FETCH j.posicion LEFT JOIN FETCH j.club WHERE j.pais.internalId = :paisId ORDER BY j.posicion.internalId, j.apellido")
    List<Jugador> findByPaisInternalId(@Param("paisId") Long paisId);

    @Query("SELECT j FROM Jugador j JOIN FETCH j.posicion JOIN FETCH j.pais LEFT JOIN FETCH j.club WHERE j.posicion.codigo = :codigo ORDER BY j.pais.nombre, j.apellido")
    List<Jugador> findByPosicionCodigo(@Param("codigo") String codigo);

    Optional<Jugador> findByApiPlayerId(Long apiPlayerId);

    @Query("SELECT j FROM Jugador j WHERE j.pais.internalId = :paisId AND j.apiPlayerId IS NOT NULL")
    List<Jugador> findSyncedByPaisId(@Param("paisId") Long paisId);

    long countByPaisInternalId(Long paisId);

    void deleteByPaisInternalId(Long paisId);
}
