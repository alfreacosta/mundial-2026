package com.mundial2026.repository;

import com.mundial2026.model.ConvocatoriaRow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConvocatoriaRowRepository extends JpaRepository<ConvocatoriaRow, Long> {

    List<ConvocatoriaRow> findByConvocatoriaInternalId(Long convocatoriaId);
}
