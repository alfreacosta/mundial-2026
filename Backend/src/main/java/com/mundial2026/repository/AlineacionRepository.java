package com.mundial2026.repository;

import com.mundial2026.model.Alineacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AlineacionRepository extends JpaRepository<Alineacion, Long> {

    boolean existsByUsuario_InternalIdAndPartido_InternalIdAndPais_InternalId(
            Long usuarioId, Long partidoId, Long paisId);
}
