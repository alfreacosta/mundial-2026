package com.mundial2026.repository;

import com.mundial2026.model.Confederacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ConfederacionRepository extends JpaRepository<Confederacion, Long> {
    Optional<Confederacion> findByCodigo(String codigo);
}
