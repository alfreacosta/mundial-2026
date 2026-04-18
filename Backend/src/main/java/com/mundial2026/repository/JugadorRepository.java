package com.mundial2026.repository;

import com.mundial2026.model.Jugador;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JugadorRepository extends JpaRepository<Jugador, Long> {

    @Query("SELECT j FROM Jugador j JOIN FETCH j.posicion JOIN FETCH j.pais LEFT JOIN FETCH j.club ORDER BY j.pais.nombre, j.posicion.internalId, j.apellido")
    List<Jugador> findAllWithFetch();

    @Query("SELECT j FROM Jugador j JOIN FETCH j.posicion LEFT JOIN FETCH j.club WHERE j.pais.internalId = :paisId ORDER BY j.posicion.internalId, j.apellido")
    List<Jugador> findByPaisInternalId(@Param("paisId") Long paisId);

    @Query("SELECT j FROM Jugador j JOIN FETCH j.posicion JOIN FETCH j.pais LEFT JOIN FETCH j.club WHERE j.posicion.codigo = :codigo ORDER BY j.pais.nombre, j.apellido")
    List<Jugador> findByPosicionCodigo(@Param("codigo") String codigo);

    Optional<Jugador> findByApiPlayerId(Long apiPlayerId);

    @Query("SELECT j FROM Jugador j LEFT JOIN FETCH j.club LEFT JOIN FETCH j.posicion WHERE j.internalId = :id")
    Optional<Jugador> findByIdWithClub(@Param("id") Long id);

    @Query("SELECT j FROM Jugador j WHERE j.pais.internalId = :paisId AND j.apiPlayerId IS NOT NULL")
    List<Jugador> findSyncedByPaisId(@Param("paisId") Long paisId);

    long countByPaisInternalId(Long paisId);

    void deleteByPaisInternalId(Long paisId);

    /**
     * Búsqueda por palabras separadas usando unaccent + ILIKE en nombre_completo.
     * Cada palabra debe coincidir (AND). Retorna máximo :limit resultados.
     * Se espera que las palabras vengan ya armadas como '%palabra%' desde el service.
     */
    @Query(value =
        "SELECT j.internal_id AS internalId, j.nombre, j.apellido, j.nombre_completo AS nombreCompleto, " +
        "  j.url_foto AS urlFoto, pos.codigo AS posicionCodigo, " +
        "  p.nombre AS paisNombre, p.codigo AS paisCodigo, c.nombre AS clubNombre " +
        "FROM jugador j " +
        "JOIN posicion_jugador pos ON pos.internal_id = j.posicion_id " +
        "JOIN pais p ON p.internal_id = j.pais_id " +
        "LEFT JOIN club c ON c.internal_id = j.club_id " +
        "WHERE (:word1 IS NULL OR unaccent(LOWER(j.nombre_completo)) ILIKE unaccent(:word1)) " +
        "  AND (:word2 IS NULL OR unaccent(LOWER(j.nombre_completo)) ILIKE unaccent(:word2)) " +
        "  AND (:word3 IS NULL OR unaccent(LOWER(j.nombre_completo)) ILIKE unaccent(:word3)) " +
        "ORDER BY j.apellido, j.nombre " +
        "LIMIT :lim",
        nativeQuery = true)
    List<Object[]> buscarPorPalabras(
        @Param("word1") String word1,
        @Param("word2") String word2,
        @Param("word3") String word3,
        @Param("lim") int limit);
}
