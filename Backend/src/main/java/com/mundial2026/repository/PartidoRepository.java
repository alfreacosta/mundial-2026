package com.mundial2026.repository;

import com.mundial2026.model.Partido;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PartidoRepository extends JpaRepository<Partido, Long> {
    List<Partido> findByFaseCodigo(String faseCodigo);
    List<Partido> findByEstado(String estado);

    @Query("SELECT p FROM Partido p " +
           "LEFT JOIN FETCH p.equipoLocal " +
           "LEFT JOIN FETCH p.equipoVisitante " +
           "JOIN FETCH p.fase " +
           "WHERE p.internalId = :id")
    java.util.Optional<Partido> findByIdWithTeams(@Param("id") Long id);

    @Query("SELECT p FROM Partido p " +
           "LEFT JOIN FETCH p.equipoLocal " +
           "LEFT JOIN FETCH p.equipoVisitante " +
           "JOIN FETCH p.fase " +
           "ORDER BY p.transDate ASC")
    List<Partido> findAllWithTeams();

    @Query("SELECT p FROM Partido p " +
           "LEFT JOIN FETCH p.equipoLocal " +
           "LEFT JOIN FETCH p.equipoVisitante " +
           "JOIN FETCH p.fase f " +
           "WHERE f.codigo = :faseCodigo " +
           "ORDER BY p.transDate ASC")
    List<Partido> findByFaseCodigoWithTeams(@Param("faseCodigo") String faseCodigo);

    @Query("SELECT p FROM Partido p " +
           "LEFT JOIN FETCH p.equipoLocal " +
           "LEFT JOIN FETCH p.equipoVisitante " +
           "JOIN FETCH p.fase " +
           "WHERE p.transDate BETWEEN :start AND :end " +
           "ORDER BY p.transDate ASC")
    List<Partido> findByDateRange(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

}
