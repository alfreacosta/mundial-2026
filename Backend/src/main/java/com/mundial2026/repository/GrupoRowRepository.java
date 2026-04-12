package com.mundial2026.repository;

import com.mundial2026.model.GrupoRow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GrupoRowRepository extends JpaRepository<GrupoRow, Long> {

    Optional<GrupoRow> findByGrupo_InternalIdAndUsuario_InternalId(Long grupoId, Long usuarioId);

    boolean existsByGrupo_InternalIdAndUsuario_InternalId(Long grupoId, Long usuarioId);

    @Query("""
        SELECT gr FROM GrupoRow gr
        LEFT JOIN FETCH gr.grupo g
        LEFT JOIN FETCH gr.paisCampeon
        LEFT JOIN FETCH gr.goleador
        WHERE gr.usuario.internalId = :usuarioId
        AND g.activo = true
        """)
    List<GrupoRow> findMisGrupos(@Param("usuarioId") Long usuarioId);

    @Query("""
        SELECT gr FROM GrupoRow gr
        LEFT JOIN FETCH gr.usuario u
        LEFT JOIN FETCH gr.paisCampeon
        LEFT JOIN FETCH gr.goleador
        WHERE gr.grupo.internalId = :grupoId
        ORDER BY gr.rol DESC, gr.fechaUnion ASC
        """)
    List<GrupoRow> findMiembrosDelGrupo(@Param("grupoId") Long grupoId);

    List<GrupoRow> findByUsuario_InternalId(Long usuarioId);

    long countByGrupo_InternalIdAndRolNot(Long grupoId, String rol);

    void deleteByGrupo_InternalId(Long grupoId);
}
