package com.mundial2026.repository;

import com.mundial2026.model.GrupoRowPais;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GrupoRowPaisRepository extends JpaRepository<GrupoRowPais, Long> {

    @Query("""
        SELECT grp FROM GrupoRowPais grp
        JOIN FETCH grp.pais
        WHERE grp.grupoRow.internalId = :grupoRowId
        ORDER BY grp.orden
        """)
    List<GrupoRowPais> findByGrupoRowId(@Param("grupoRowId") Long grupoRowId);

    void deleteByGrupoRow_InternalId(Long grupoRowId);
}
