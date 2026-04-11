-- ============================================================
-- MUNDIAL 2026 - SEED GRUPOS
-- Sorteo oficial: 5 de diciembre de 2025, Kennedy Center, Washington D.C.
-- 12 grupos (A - L), 4 equipos cada uno, 48 selecciones
-- ============================================================
-- Ejecutar DESPUÉS de seed.sql
-- Idempotente: UPDATE + ON CONFLICT DO UPDATE
-- ============================================================

-- ============================================================
-- 1. INSERTAR PAÍSES CLASIFICADOS QUE FALTABAN EN SEED ORIGINAL
-- ============================================================
INSERT INTO pais (nombre, codigo, confederacion_id, grupo, activo) VALUES
    ('Haití',      'HAI', (SELECT internal_id FROM confederacion WHERE codigo = 'CONCACAF'), 'C', TRUE),
    ('Paraguay',   'PAR', (SELECT internal_id FROM confederacion WHERE codigo = 'CONMEBOL'), 'D', TRUE),
    ('Curaçao',    'CUW', (SELECT internal_id FROM confederacion WHERE codigo = 'CONCACAF'), 'E', TRUE),
    ('Cabo Verde', 'CPV', (SELECT internal_id FROM confederacion WHERE codigo = 'CAF'),      'H', TRUE),
    ('Noruega',    'NOR', (SELECT internal_id FROM confederacion WHERE codigo = 'UEFA'),     'I', TRUE),
    ('Argelia',    'ALG', (SELECT internal_id FROM confederacion WHERE codigo = 'CAF'),      'J', TRUE),
    ('Uzbekistán', 'UZB', (SELECT internal_id FROM confederacion WHERE codigo = 'AFC'),      'K', TRUE)
ON CONFLICT (codigo) DO UPDATE SET
    grupo  = EXCLUDED.grupo,
    activo = TRUE;

-- ============================================================
-- 2. ASIGNAR GRUPOS A PAÍSES YA EXISTENTES EN LA BD
-- ============================================================

-- GRUPO A: México (sede), Sudáfrica, Corea del Sur + TBD UEFA Path D
UPDATE pais SET grupo = 'A' WHERE codigo IN ('MEX', 'RSA', 'KOR');

-- GRUPO B: Canadá (sede), Qatar, Suiza + TBD UEFA Path A
UPDATE pais SET grupo = 'B' WHERE codigo IN ('CAN', 'QAT', 'SUI');

-- GRUPO C: Brasil, Marruecos, Haití, Escocia
UPDATE pais SET grupo = 'C' WHERE codigo IN ('BRA', 'MAR', 'HAI', 'SCO');

-- GRUPO D: Estados Unidos (sede), Paraguay, Australia + TBD UEFA Path C
UPDATE pais SET grupo = 'D' WHERE codigo IN ('USA', 'PAR', 'AUS');

-- GRUPO E: Alemania, Curaçao, Costa de Marfil, Ecuador
UPDATE pais SET grupo = 'E' WHERE codigo IN ('GER', 'CUW', 'CIV', 'ECU');

-- GRUPO F: Países Bajos, Japón, Túnez + TBD UEFA Path B
UPDATE pais SET grupo = 'F' WHERE codigo IN ('NED', 'JPN', 'TUN');

-- GRUPO G: Bélgica, Egipto, Irán, Nueva Zelanda
UPDATE pais SET grupo = 'G' WHERE codigo IN ('BEL', 'EGY', 'IRN', 'NZL');

-- GRUPO H: España, Cabo Verde, Arabia Saudita, Uruguay
UPDATE pais SET grupo = 'H' WHERE codigo IN ('ESP', 'CPV', 'SAU', 'URU');

-- GRUPO I: Francia, Senegal, Noruega + TBD IC Repechaje 2 (Irak/Bolivia/Surinam)
UPDATE pais SET grupo = 'I' WHERE codigo IN ('FRA', 'SEN', 'NOR');

-- GRUPO J: Argentina, Argelia, Austria, Jordania
UPDATE pais SET grupo = 'J' WHERE codigo IN ('ARG', 'ALG', 'AUT', 'JOR');

-- GRUPO K: Portugal, Uzbekistán, Colombia + TBD IC Repechaje 1 (DR Congo/Jamaica/Nueva Caledonia)
UPDATE pais SET grupo = 'K' WHERE codigo IN ('POR', 'UZB', 'COL');

-- GRUPO L: Inglaterra, Croacia, Ghana, Panamá
UPDATE pais SET grupo = 'L' WHERE codigo IN ('ENG', 'CRO', 'GHA', 'PAN');

-- ============================================================
-- 3. DESACTIVAR PAÍSES QUE NO CLASIFICARON
--    activo = FALSE → no aparecen en el frontend pero
--    la FK de jugadores/clubs no se rompe
-- ============================================================
UPDATE pais SET activo = FALSE, grupo = NULL
WHERE codigo IN (
    'CHI',  -- Chile: CONMEBOL — no clasificó (su plaza fue para Paraguay)
    'CRC',  -- Costa Rica: CONCACAF — no clasificó
    'SRB',  -- Serbia: UEFA — no clasificó
    'HUN',  -- Hungría: UEFA — no clasificó
    'CMR',  -- Camerún: CAF — no clasificó
    'NGA',  -- Nigeria: CAF — no clasificó
    'PER',  -- Perú: CONMEBOL — eliminado en repechaje IC
    'BHR'   -- Baréin: AFC — eliminado en repechaje IC
);

-- ============================================================
-- 4. PENDIENTES DE REPECHAJE (activo = TRUE, grupo = NULL por ahora)
-- ============================================================
-- Se completa cuando se conozcan los ganadores de:
--   UEFA Path A (→ Grupo B):  Italia / Gales / Bosnia / Irlanda del Norte
--   UEFA Path B (→ Grupo F):  Ucrania / Polonia / Albania / Suecia
--   UEFA Path C (→ Grupo D):  Turquía / Eslovaquia / Kosovo / Rumania
--   UEFA Path D (→ Grupo A):  Dinamarca / Rep. Checa / Irlanda / Macedonia del Norte
--   IC Repechaje 1 (→ Grupo K): DR Congo / Jamaica / Nueva Caledonia
--   IC Repechaje 2 (→ Grupo I): Irak / Bolivia / Surinam
--
-- ITA, DEN, POL ya están en la BD como activo=TRUE, grupo=NULL ✓
-- IRQ (Irak) ya está en la BD como activo=TRUE, grupo=NULL ✓
-- JAM (Jamaica) ya está en la BD como activo=TRUE, grupo=NULL ✓

-- ============================================================
-- 5. VERIFICACIÓN
-- ============================================================
-- Ejecutar para confirmar:
-- SELECT grupo, COUNT(*) as equipos, 
--        STRING_AGG(nombre, ', ' ORDER BY nombre) as paises
-- FROM pais 
-- WHERE activo = TRUE AND grupo IS NOT NULL
-- GROUP BY grupo 
-- ORDER BY grupo;
