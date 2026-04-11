package com.mundial2026.repository;

import com.mundial2026.model.Club;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClubRepository extends JpaRepository<Club, Long> {
    Optional<Club> findByCodigo(String codigo);
    List<Club> findByPaisInternalId(Long paisId);
}
