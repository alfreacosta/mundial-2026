-- ============================================================
-- MUNDIAL 2026 - SEED DATA
-- Datos de catálogos y países participantes
-- Ejecutar DESPUÉS de schema.sql
-- Idempotente: ON CONFLICT DO NOTHING
-- ============================================================

-- ============================================================
-- 1. CONFEDERACIONES
-- ============================================================
INSERT INTO confederacion (nombre, codigo, abreviatura, activo) VALUES
    ('Union of European Football Associations',                        'UEFA',     'UEFA',     TRUE),
    ('Confederación Sudamericana de Fútbol',                           'CONMEBOL', 'CSF',      TRUE),
    ('Confederation of North, Central America and Caribbean Football', 'CONCACAF', 'CONCACAF', TRUE),
    ('Confederation of African Football',                              'CAF',      'CAF',      TRUE),
    ('Asian Football Confederation',                                   'AFC',      'AFC',      TRUE),
    ('Oceania Football Confederation',                                 'OFC',      'OFC',      TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================
-- 2. FASES DEL TORNEO
-- ============================================================
INSERT INTO fase (nombre, codigo, orden, activo) VALUES
    ('Fase de Grupos',   'GRUPOS',        1, TRUE),
    ('Octavos de Final', 'OCTAVOS',       2, TRUE),
    ('Cuartos de Final', 'CUARTOS',       3, TRUE),
    ('Semifinal',        'SEMIFINAL',     4, TRUE),
    ('Tercer Puesto',    'TERCER_PUESTO', 5, TRUE),
    ('Final',            'FINAL',         6, TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================
-- 3. POSICIONES DE JUGADOR
-- ============================================================
INSERT INTO posicion_jugador (nombre, codigo, abreviatura, activo) VALUES
    ('Arquero',       'ARQ', 'ARQ', TRUE),
    ('Defensor',      'DEF', 'DEF', TRUE),
    ('Mediocampista', 'MED', 'MED', TRUE),
    ('Delantero',     'DEL', 'DEL', TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================
-- 4. PAISES PARTICIPANTES - MUNDIAL 2026 (48 selecciones)
-- grupo: se completa luego del sorteo oficial
-- ============================================================

-- UEFA (16 plazas)
INSERT INTO pais (nombre, codigo, confederacion_id, activo) VALUES
    ('Alemania',       'GER', (SELECT internal_id FROM confederacion WHERE codigo = 'UEFA'), TRUE),
    ('Francia',        'FRA', (SELECT internal_id FROM confederacion WHERE codigo = 'UEFA'), TRUE),
    ('Inglaterra',     'ENG', (SELECT internal_id FROM confederacion WHERE codigo = 'UEFA'), TRUE),
    ('España',         'ESP', (SELECT internal_id FROM confederacion WHERE codigo = 'UEFA'), TRUE),
    ('Portugal',       'POR', (SELECT internal_id FROM confederacion WHERE codigo = 'UEFA'), TRUE),
    ('Italia',         'ITA', (SELECT internal_id FROM confederacion WHERE codigo = 'UEFA'), TRUE),
    ('Países Bajos',   'NED', (SELECT internal_id FROM confederacion WHERE codigo = 'UEFA'), TRUE),
    ('Bélgica',        'BEL', (SELECT internal_id FROM confederacion WHERE codigo = 'UEFA'), TRUE),
    ('Suiza',          'SUI', (SELECT internal_id FROM confederacion WHERE codigo = 'UEFA'), TRUE),
    ('Austria',        'AUT', (SELECT internal_id FROM confederacion WHERE codigo = 'UEFA'), TRUE),
    ('Croacia',        'CRO', (SELECT internal_id FROM confederacion WHERE codigo = 'UEFA'), TRUE),
    ('Serbia',         'SRB', (SELECT internal_id FROM confederacion WHERE codigo = 'UEFA'), TRUE),
    ('Dinamarca',      'DEN', (SELECT internal_id FROM confederacion WHERE codigo = 'UEFA'), TRUE),
    ('Polonia',        'POL', (SELECT internal_id FROM confederacion WHERE codigo = 'UEFA'), TRUE),
    ('Hungría',        'HUN', (SELECT internal_id FROM confederacion WHERE codigo = 'UEFA'), TRUE),
    ('Escocia',        'SCO', (SELECT internal_id FROM confederacion WHERE codigo = 'UEFA'), TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- CONMEBOL (6 plazas)
INSERT INTO pais (nombre, codigo, confederacion_id, activo) VALUES
    ('Argentina',      'ARG', (SELECT internal_id FROM confederacion WHERE codigo = 'CONMEBOL'), TRUE),
    ('Brasil',         'BRA', (SELECT internal_id FROM confederacion WHERE codigo = 'CONMEBOL'), TRUE),
    ('Colombia',       'COL', (SELECT internal_id FROM confederacion WHERE codigo = 'CONMEBOL'), TRUE),
    ('Ecuador',        'ECU', (SELECT internal_id FROM confederacion WHERE codigo = 'CONMEBOL'), TRUE),
    ('Uruguay',        'URU', (SELECT internal_id FROM confederacion WHERE codigo = 'CONMEBOL'), TRUE),
    ('Chile',          'CHI', (SELECT internal_id FROM confederacion WHERE codigo = 'CONMEBOL'), TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- CONCACAF (6 plazas — incluye 3 sedes)
INSERT INTO pais (nombre, codigo, confederacion_id, activo) VALUES
    ('Estados Unidos', 'USA', (SELECT internal_id FROM confederacion WHERE codigo = 'CONCACAF'), TRUE),
    ('Canadá',         'CAN', (SELECT internal_id FROM confederacion WHERE codigo = 'CONCACAF'), TRUE),
    ('México',         'MEX', (SELECT internal_id FROM confederacion WHERE codigo = 'CONCACAF'), TRUE),
    ('Panamá',         'PAN', (SELECT internal_id FROM confederacion WHERE codigo = 'CONCACAF'), TRUE),
    ('Jamaica',        'JAM', (SELECT internal_id FROM confederacion WHERE codigo = 'CONCACAF'), TRUE),
    ('Costa Rica',     'CRC', (SELECT internal_id FROM confederacion WHERE codigo = 'CONCACAF'), TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- CAF (9 plazas)
INSERT INTO pais (nombre, codigo, confederacion_id, activo) VALUES
    ('Marruecos',       'MAR', (SELECT internal_id FROM confederacion WHERE codigo = 'CAF'), TRUE),
    ('Senegal',         'SEN', (SELECT internal_id FROM confederacion WHERE codigo = 'CAF'), TRUE),
    ('Egipto',          'EGY', (SELECT internal_id FROM confederacion WHERE codigo = 'CAF'), TRUE),
    ('Camerún',         'CMR', (SELECT internal_id FROM confederacion WHERE codigo = 'CAF'), TRUE),
    ('Nigeria',         'NGA', (SELECT internal_id FROM confederacion WHERE codigo = 'CAF'), TRUE),
    ('Sudáfrica',       'RSA', (SELECT internal_id FROM confederacion WHERE codigo = 'CAF'), TRUE),
    ('Costa de Marfil', 'CIV', (SELECT internal_id FROM confederacion WHERE codigo = 'CAF'), TRUE),
    ('Ghana',           'GHA', (SELECT internal_id FROM confederacion WHERE codigo = 'CAF'), TRUE),
    ('Túnez',           'TUN', (SELECT internal_id FROM confederacion WHERE codigo = 'CAF'), TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- AFC (8 plazas)
INSERT INTO pais (nombre, codigo, confederacion_id, activo) VALUES
    ('Japón',          'JPN', (SELECT internal_id FROM confederacion WHERE codigo = 'AFC'), TRUE),
    ('Corea del Sur',  'KOR', (SELECT internal_id FROM confederacion WHERE codigo = 'AFC'), TRUE),
    ('Australia',      'AUS', (SELECT internal_id FROM confederacion WHERE codigo = 'AFC'), TRUE),
    ('Irán',           'IRN', (SELECT internal_id FROM confederacion WHERE codigo = 'AFC'), TRUE),
    ('Arabia Saudita', 'SAU', (SELECT internal_id FROM confederacion WHERE codigo = 'AFC'), TRUE),
    ('Qatar',          'QAT', (SELECT internal_id FROM confederacion WHERE codigo = 'AFC'), TRUE),
    ('Irak',           'IRQ', (SELECT internal_id FROM confederacion WHERE codigo = 'AFC'), TRUE),
    ('Jordania',       'JOR', (SELECT internal_id FROM confederacion WHERE codigo = 'AFC'), TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- OFC (1 plaza)
INSERT INTO pais (nombre, codigo, confederacion_id, activo) VALUES
    ('Nueva Zelanda',  'NZL', (SELECT internal_id FROM confederacion WHERE codigo = 'OFC'), TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- Repechaje intercontinental (2 plazas)
INSERT INTO pais (nombre, codigo, confederacion_id, activo) VALUES
    ('Perú',           'PER', (SELECT internal_id FROM confederacion WHERE codigo = 'CONMEBOL'), TRUE),
    ('Baréin',         'BHR', (SELECT internal_id FROM confederacion WHERE codigo = 'AFC'),      TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================
-- VERIFICACION
-- ============================================================
SELECT 'Confederaciones: ' || COUNT(*) AS resumen FROM confederacion
UNION ALL
SELECT 'Fases: '           || COUNT(*) FROM fase
UNION ALL
SELECT 'Posiciones: '      || COUNT(*) FROM posicion_jugador
UNION ALL
SELECT 'Paises: '          || COUNT(*) FROM pais;

-- ============================================================
-- FIN DEL SEED
-- ============================================================
