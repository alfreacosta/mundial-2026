-- Eliminar países que no clasificaron al Mundial 2026 + placeholders de repechaje
-- Ejecutado en LOCAL y RAILWAY el 2026-04-12
-- Países eliminados (18):
--   Italia (6), Dinamarca (13), Polonia (14), Perú (47),
--   Repechaje UEFA A-D (56-59), Repechaje IC 1-2 (60-61),
--   Nigeria (33), Chile (22), Serbia (12), Hungría (15),
--   Costa Rica (28), Camerún (32), Baréin (48), Jamaica (27)

BEGIN;

DELETE FROM equipo_favorito WHERE pais_id IN (6,13,14,47,56,57,58,59,60,61,33,22,12,15,28,32,48,27);
DELETE FROM jugador WHERE pais_id IN (6,13,14,47,56,57,58,59,60,61,33,22,12,15,28,32,48,27);
DELETE FROM convocatoria WHERE pais_id IN (6,13,14,47,56,57,58,59,60,61,33,22,12,15,28,32,48,27);
DELETE FROM alineacion WHERE pais_id IN (6,13,14,47,56,57,58,59,60,61,33,22,12,15,28,32,48,27);
DELETE FROM pais WHERE internal_id IN (6,13,14,47,56,57,58,59,60,61,33,22,12,15,28,32,48,27);

COMMIT;
