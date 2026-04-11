package com.mundial2026.repository;

import com.mundial2026.model.EquipoFavorito;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EquipoFavoritoRepository extends JpaRepository<EquipoFavorito, Long> {

    @Query("SELECT ef FROM EquipoFavorito ef LEFT JOIN FETCH ef.pais WHERE ef.usuario.internalId = :usuarioId ORDER BY ef.orden ASC")
    List<EquipoFavorito> findByUsuarioId(@Param("usuarioId") Long usuarioId);

    Optional<EquipoFavorito> findByUsuario_InternalIdAndPais_InternalId(Long usuarioId, Long paisId);

    boolean existsByUsuario_InternalIdAndPais_InternalId(Long usuarioId, Long paisId);

    int countByUsuario_InternalId(Long usuarioId);
}
