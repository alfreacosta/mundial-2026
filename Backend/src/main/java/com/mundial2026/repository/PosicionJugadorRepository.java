package com.mundial2026.repository;

import com.mundial2026.model.PosicionJugador;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PosicionJugadorRepository extends JpaRepository<PosicionJugador, Long> {
    Optional<PosicionJugador> findByCodigo(String codigo);
}
