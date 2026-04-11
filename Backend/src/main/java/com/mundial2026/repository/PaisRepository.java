package com.mundial2026.repository;

import com.mundial2026.model.Pais;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaisRepository extends JpaRepository<Pais, Long> {
    Optional<Pais> findByCodigo(String codigo);
    List<Pais> findByConfederacionCodigo(String confederacionCodigo);
    List<Pais> findByGrupo(String grupo);

    /** Carga un país con su confederación (evita LazyInitializationException) */
    @Query("SELECT p FROM Pais p JOIN FETCH p.confederacion WHERE p.codigo = :codigo")
    Optional<Pais> findByCodigoWithConfederacion(String codigo);

    /** Carga todos los países con su confederación en una sola query (evita N+1 con LAZY) */
    @Query("SELECT p FROM Pais p JOIN FETCH p.confederacion")
    List<Pais> findAllWithConfederacion();

    /** Carga países por confederación con JOIN FETCH */
    @Query("SELECT p FROM Pais p JOIN FETCH p.confederacion c WHERE c.codigo = :codigo")
    List<Pais> findByConfederacionCodigoWithFetch(String codigo);

    Optional<Pais> findByApiTeamId(Long apiTeamId);
}
