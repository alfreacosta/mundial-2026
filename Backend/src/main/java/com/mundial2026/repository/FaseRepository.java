package com.mundial2026.repository;

import com.mundial2026.model.Fase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FaseRepository extends JpaRepository<Fase, Long> {
    Optional<Fase> findByCodigo(String codigo);
    List<Fase> findAllByOrderByOrdenAsc();
}
