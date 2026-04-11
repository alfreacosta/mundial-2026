package com.mundial2026.repository;

import com.mundial2026.model.Estadio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EstadioRepository extends JpaRepository<Estadio, Long> {
    Optional<Estadio> findByNombreIgnoreCase(String nombre);
}
