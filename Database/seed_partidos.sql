-- ============================================================
-- MUNDIAL 2026 - SEED PARTIDOS (FIXTURES)
-- Calendario oficial FIFA World Cup 2026™
-- 48 equipos · 12 grupos · 104 partidos
-- Sedes: Estados Unidos, México, Canadá
--
-- Ejecutar DESPUÉS de seed.sql y seed_grupos.sql
-- Idempotente: ON CONFLICT DO NOTHING (usar trans_date+fase como key)
-- ============================================================

-- ============================================================
-- FASES ADICIONALES (si no existen)
-- ============================================================
INSERT INTO fase (nombre, codigo, orden, activo) VALUES
    ('Treintaidosavos de Final', 'TREINTAIDOSAVOS', 2, TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- Ajustar orden de fases existentes para el formato de 48 equipos
UPDATE fase SET orden = 3 WHERE codigo = 'OCTAVOS';
UPDATE fase SET orden = 4 WHERE codigo = 'CUARTOS';
UPDATE fase SET orden = 5 WHERE codigo = 'SEMIFINAL';
UPDATE fase SET orden = 6 WHERE codigo = 'TERCER_PUESTO';
UPDATE fase SET orden = 7 WHERE codigo = 'FINAL';

-- ============================================================
-- FASE DE GRUPOS - JORNADA 1 (11–14 Jun 2026)
-- ============================================================

-- === GRUPO A: México, Sudáfrica, Corea del Sur, (TBD UEFA Path D) ===
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'MEX'),
    (SELECT internal_id FROM pais WHERE codigo = 'RSA'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-11 17:00:00',
    'Estadio Azteca',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'KOR'),
    NULL, -- TBD UEFA Path D
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-11 20:00:00',
    'Estadio Azteca',
    'PENDIENTE'
);

-- === GRUPO B: Canadá, Qatar, Suiza, (TBD UEFA Path A) ===
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'CAN'),
    (SELECT internal_id FROM pais WHERE codigo = 'QAT'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-12 13:00:00',
    'BMO Field',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'SUI'),
    NULL, -- TBD UEFA Path A
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-12 16:00:00',
    'BC Place',
    'PENDIENTE'
);

-- === GRUPO C: Brasil, Marruecos, Haití, Escocia ===
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'BRA'),
    (SELECT internal_id FROM pais WHERE codigo = 'MAR'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-12 19:00:00',
    'SoFi Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'HAI'),
    (SELECT internal_id FROM pais WHERE codigo = 'SCO'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-12 22:00:00',
    'Hard Rock Stadium',
    'PENDIENTE'
);

-- === GRUPO D: Estados Unidos, Paraguay, Australia, (TBD UEFA Path C) ===
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'USA'),
    (SELECT internal_id FROM pais WHERE codigo = 'PAR'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-13 13:00:00',
    'MetLife Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'AUS'),
    NULL, -- TBD UEFA Path C
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-13 16:00:00',
    'Lincoln Financial Field',
    'PENDIENTE'
);

-- === GRUPO E: Alemania, Curaçao, Costa de Marfil, Ecuador ===
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'GER'),
    (SELECT internal_id FROM pais WHERE codigo = 'CIV'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-13 19:00:00',
    'Mercedes-Benz Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'CUW'),
    (SELECT internal_id FROM pais WHERE codigo = 'ECU'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-13 22:00:00',
    'AT&T Stadium',
    'PENDIENTE'
);

-- === GRUPO F: Países Bajos, Japón, Túnez, (TBD UEFA Path B) ===
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'NED'),
    (SELECT internal_id FROM pais WHERE codigo = 'JPN'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-14 13:00:00',
    'Lumen Field',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'TUN'),
    NULL, -- TBD UEFA Path B
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-14 16:00:00',
    'Gillette Stadium',
    'PENDIENTE'
);

-- === GRUPO G: Bélgica, Egipto, Irán, Nueva Zelanda ===
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'BEL'),
    (SELECT internal_id FROM pais WHERE codigo = 'EGY'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-14 19:00:00',
    'NRG Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'IRN'),
    (SELECT internal_id FROM pais WHERE codigo = 'NZL'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-14 22:00:00',
    'AT&T Stadium',
    'PENDIENTE'
);

-- === GRUPO H: España, Cabo Verde, Arabia Saudita, Uruguay ===
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'ESP'),
    (SELECT internal_id FROM pais WHERE codigo = 'URU'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-15 13:00:00',
    'Hard Rock Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'CPV'),
    (SELECT internal_id FROM pais WHERE codigo = 'SAU'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-15 16:00:00',
    'Arrowhead Stadium',
    'PENDIENTE'
);

-- === GRUPO I: Francia, Senegal, Noruega, (TBD IC Repechaje 2) ===
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'FRA'),
    (SELECT internal_id FROM pais WHERE codigo = 'SEN'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-15 19:00:00',
    'MetLife Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'NOR'),
    NULL, -- TBD IC Repechaje 2
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-15 22:00:00',
    'Levi''s Stadium',
    'PENDIENTE'
);

-- === GRUPO J: Argentina, Argelia, Austria, Jordania ===
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'ARG'),
    (SELECT internal_id FROM pais WHERE codigo = 'JOR'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-16 13:00:00',
    'SoFi Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'ALG'),
    (SELECT internal_id FROM pais WHERE codigo = 'AUT'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-16 16:00:00',
    'Lincoln Financial Field',
    'PENDIENTE'
);

-- === GRUPO K: Portugal, Uzbekistán, Colombia, (TBD IC Repechaje 1) ===
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'POR'),
    (SELECT internal_id FROM pais WHERE codigo = 'COL'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-16 19:00:00',
    'Mercedes-Benz Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'UZB'),
    NULL, -- TBD IC Repechaje 1
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-16 22:00:00',
    'NRG Stadium',
    'PENDIENTE'
);

-- === GRUPO L: Inglaterra, Croacia, Ghana, Panamá ===
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'ENG'),
    (SELECT internal_id FROM pais WHERE codigo = 'GHA'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-17 13:00:00',
    'Lumen Field',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'CRO'),
    (SELECT internal_id FROM pais WHERE codigo = 'PAN'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-17 16:00:00',
    'Gillette Stadium',
    'PENDIENTE'
);

-- ============================================================
-- FASE DE GRUPOS - JORNADA 2 (18–22 Jun 2026)
-- ============================================================

-- Grupo A J2
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'RSA'),
    (SELECT internal_id FROM pais WHERE codigo = 'KOR'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-18 13:00:00',
    'Estadio Azteca',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'MEX'),
    NULL, -- TBD UEFA Path D
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-18 16:00:00',
    'Estadio BBVA',
    'PENDIENTE'
);

-- Grupo B J2
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'QAT'),
    (SELECT internal_id FROM pais WHERE codigo = 'SUI'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-18 19:00:00',
    'BMO Field',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, -- TBD UEFA Path A
    (SELECT internal_id FROM pais WHERE codigo = 'CAN'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-18 22:00:00',
    'BC Place',
    'PENDIENTE'
);

-- Grupo C J2
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'MAR'),
    (SELECT internal_id FROM pais WHERE codigo = 'HAI'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-19 13:00:00',
    'Hard Rock Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'SCO'),
    (SELECT internal_id FROM pais WHERE codigo = 'BRA'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-19 16:00:00',
    'SoFi Stadium',
    'PENDIENTE'
);

-- Grupo D J2
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'PAR'),
    (SELECT internal_id FROM pais WHERE codigo = 'AUS'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-19 19:00:00',
    'Lincoln Financial Field',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, -- TBD UEFA Path C
    (SELECT internal_id FROM pais WHERE codigo = 'USA'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-19 22:00:00',
    'MetLife Stadium',
    'PENDIENTE'
);

-- Grupo E J2
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'CIV'),
    (SELECT internal_id FROM pais WHERE codigo = 'CUW'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-20 13:00:00',
    'AT&T Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'ECU'),
    (SELECT internal_id FROM pais WHERE codigo = 'GER'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-20 16:00:00',
    'Mercedes-Benz Stadium',
    'PENDIENTE'
);

-- Grupo F J2
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'JPN'),
    (SELECT internal_id FROM pais WHERE codigo = 'TUN'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-20 19:00:00',
    'Lumen Field',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, -- TBD UEFA Path B
    (SELECT internal_id FROM pais WHERE codigo = 'NED'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-20 22:00:00',
    'Gillette Stadium',
    'PENDIENTE'
);

-- Grupo G J2
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'EGY'),
    (SELECT internal_id FROM pais WHERE codigo = 'IRN'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-21 13:00:00',
    'NRG Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'NZL'),
    (SELECT internal_id FROM pais WHERE codigo = 'BEL'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-21 16:00:00',
    'AT&T Stadium',
    'PENDIENTE'
);

-- Grupo H J2
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'URU'),
    (SELECT internal_id FROM pais WHERE codigo = 'CPV'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-21 19:00:00',
    'Arrowhead Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'SAU'),
    (SELECT internal_id FROM pais WHERE codigo = 'ESP'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-21 22:00:00',
    'Hard Rock Stadium',
    'PENDIENTE'
);

-- Grupo I J2
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'SEN'),
    (SELECT internal_id FROM pais WHERE codigo = 'NOR'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-22 13:00:00',
    'Levi''s Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, -- TBD IC Repechaje 2
    (SELECT internal_id FROM pais WHERE codigo = 'FRA'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-22 16:00:00',
    'MetLife Stadium',
    'PENDIENTE'
);

-- Grupo J J2
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'JOR'),
    (SELECT internal_id FROM pais WHERE codigo = 'ALG'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-22 19:00:00',
    'SoFi Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'AUT'),
    (SELECT internal_id FROM pais WHERE codigo = 'ARG'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-22 22:00:00',
    'Lincoln Financial Field',
    'PENDIENTE'
);

-- Grupo K J2
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'COL'),
    (SELECT internal_id FROM pais WHERE codigo = 'UZB'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-23 13:00:00',
    'NRG Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, -- TBD IC Repechaje 1
    (SELECT internal_id FROM pais WHERE codigo = 'POR'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-23 16:00:00',
    'Mercedes-Benz Stadium',
    'PENDIENTE'
);

-- Grupo L J2
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'GHA'),
    (SELECT internal_id FROM pais WHERE codigo = 'CRO'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-23 19:00:00',
    'Gillette Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'PAN'),
    (SELECT internal_id FROM pais WHERE codigo = 'ENG'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-23 22:00:00',
    'Lumen Field',
    'PENDIENTE'
);

-- ============================================================
-- FASE DE GRUPOS - JORNADA 3 (25–29 Jun 2026)
-- Partidos simultáneos por grupo
-- ============================================================

-- Grupo A J3
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'KOR'),
    (SELECT internal_id FROM pais WHERE codigo = 'MEX'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-25 16:00:00',
    'Estadio Azteca',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, -- TBD UEFA Path D
    (SELECT internal_id FROM pais WHERE codigo = 'RSA'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-25 16:00:00',
    'Estadio BBVA',
    'PENDIENTE'
);

-- Grupo B J3
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'SUI'),
    (SELECT internal_id FROM pais WHERE codigo = 'CAN'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-25 22:00:00',
    'BC Place',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, -- TBD UEFA Path A
    (SELECT internal_id FROM pais WHERE codigo = 'QAT'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-25 22:00:00',
    'BMO Field',
    'PENDIENTE'
);

-- Grupo C J3
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'SCO'),
    (SELECT internal_id FROM pais WHERE codigo = 'MAR'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-26 16:00:00',
    'Hard Rock Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'HAI'),
    (SELECT internal_id FROM pais WHERE codigo = 'BRA'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-26 16:00:00',
    'SoFi Stadium',
    'PENDIENTE'
);

-- Grupo D J3
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'AUS'),
    (SELECT internal_id FROM pais WHERE codigo = 'USA'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-26 22:00:00',
    'MetLife Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, -- TBD UEFA Path C
    (SELECT internal_id FROM pais WHERE codigo = 'PAR'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-26 22:00:00',
    'Lincoln Financial Field',
    'PENDIENTE'
);

-- Grupo E J3
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'ECU'),
    (SELECT internal_id FROM pais WHERE codigo = 'CIV'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-27 16:00:00',
    'AT&T Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'CUW'),
    (SELECT internal_id FROM pais WHERE codigo = 'GER'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-27 16:00:00',
    'Mercedes-Benz Stadium',
    'PENDIENTE'
);

-- Grupo F J3
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'TUN'),
    (SELECT internal_id FROM pais WHERE codigo = 'NED'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-27 22:00:00',
    'Lumen Field',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, -- TBD UEFA Path B
    (SELECT internal_id FROM pais WHERE codigo = 'JPN'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-27 22:00:00',
    'Gillette Stadium',
    'PENDIENTE'
);

-- Grupo G J3
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'NZL'),
    (SELECT internal_id FROM pais WHERE codigo = 'EGY'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-28 16:00:00',
    'NRG Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'IRN'),
    (SELECT internal_id FROM pais WHERE codigo = 'BEL'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-28 16:00:00',
    'AT&T Stadium',
    'PENDIENTE'
);

-- Grupo H J3
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'SAU'),
    (SELECT internal_id FROM pais WHERE codigo = 'URU'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-28 22:00:00',
    'Arrowhead Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'CPV'),
    (SELECT internal_id FROM pais WHERE codigo = 'ESP'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-28 22:00:00',
    'Hard Rock Stadium',
    'PENDIENTE'
);

-- Grupo I J3
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'NOR'),
    (SELECT internal_id FROM pais WHERE codigo = 'FRA'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-29 16:00:00',
    'MetLife Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, -- TBD IC Repechaje 2
    (SELECT internal_id FROM pais WHERE codigo = 'SEN'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-29 16:00:00',
    'Levi''s Stadium',
    'PENDIENTE'
);

-- Grupo J J3
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'AUT'),
    (SELECT internal_id FROM pais WHERE codigo = 'ALG'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-29 22:00:00',
    'SoFi Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'JOR'),
    (SELECT internal_id FROM pais WHERE codigo = 'ARG'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-29 22:00:00',
    'Lincoln Financial Field',
    'PENDIENTE'
);

-- Grupo K J3
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, -- TBD IC Repechaje 1
    (SELECT internal_id FROM pais WHERE codigo = 'COL'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-30 16:00:00',
    'NRG Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'UZB'),
    (SELECT internal_id FROM pais WHERE codigo = 'POR'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-30 16:00:00',
    'Mercedes-Benz Stadium',
    'PENDIENTE'
);

-- Grupo L J3
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'PAN'),
    (SELECT internal_id FROM pais WHERE codigo = 'CRO'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-30 22:00:00',
    'Gillette Stadium',
    'PENDIENTE'
);

INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    (SELECT internal_id FROM pais WHERE codigo = 'GHA'),
    (SELECT internal_id FROM pais WHERE codigo = 'ENG'),
    (SELECT internal_id FROM fase WHERE codigo = 'GRUPOS'),
    '2026-06-30 22:00:00',
    'Lumen Field',
    'PENDIENTE'
);

-- ============================================================
-- FASE ELIMINATORIA - TREINTAIDOSAVOS (1–4 Jul 2026)
-- 32 equipos: 1ros y 2dos de cada grupo + 8 mejores terceros
-- ============================================================
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, NULL,
    (SELECT internal_id FROM fase WHERE codigo = 'TREINTAIDOSAVOS'),
    '2026-07-01 13:00:00', 'MetLife Stadium', 'PENDIENTE'
);
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, NULL,
    (SELECT internal_id FROM fase WHERE codigo = 'TREINTAIDOSAVOS'),
    '2026-07-01 16:00:00', 'SoFi Stadium', 'PENDIENTE'
);
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, NULL,
    (SELECT internal_id FROM fase WHERE codigo = 'TREINTAIDOSAVOS'),
    '2026-07-01 19:00:00', 'AT&T Stadium', 'PENDIENTE'
);
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, NULL,
    (SELECT internal_id FROM fase WHERE codigo = 'TREINTAIDOSAVOS'),
    '2026-07-01 22:00:00', 'Hard Rock Stadium', 'PENDIENTE'
);
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, NULL,
    (SELECT internal_id FROM fase WHERE codigo = 'TREINTAIDOSAVOS'),
    '2026-07-02 13:00:00', 'Mercedes-Benz Stadium', 'PENDIENTE'
);
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, NULL,
    (SELECT internal_id FROM fase WHERE codigo = 'TREINTAIDOSAVOS'),
    '2026-07-02 16:00:00', 'NRG Stadium', 'PENDIENTE'
);
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, NULL,
    (SELECT internal_id FROM fase WHERE codigo = 'TREINTAIDOSAVOS'),
    '2026-07-02 19:00:00', 'Lumen Field', 'PENDIENTE'
);
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, NULL,
    (SELECT internal_id FROM fase WHERE codigo = 'TREINTAIDOSAVOS'),
    '2026-07-02 22:00:00', 'Lincoln Financial Field', 'PENDIENTE'
);
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, NULL,
    (SELECT internal_id FROM fase WHERE codigo = 'TREINTAIDOSAVOS'),
    '2026-07-03 13:00:00', 'Estadio Azteca', 'PENDIENTE'
);
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, NULL,
    (SELECT internal_id FROM fase WHERE codigo = 'TREINTAIDOSAVOS'),
    '2026-07-03 16:00:00', 'BC Place', 'PENDIENTE'
);
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, NULL,
    (SELECT internal_id FROM fase WHERE codigo = 'TREINTAIDOSAVOS'),
    '2026-07-03 19:00:00', 'Arrowhead Stadium', 'PENDIENTE'
);
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, NULL,
    (SELECT internal_id FROM fase WHERE codigo = 'TREINTAIDOSAVOS'),
    '2026-07-03 22:00:00', 'Gillette Stadium', 'PENDIENTE'
);
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, NULL,
    (SELECT internal_id FROM fase WHERE codigo = 'TREINTAIDOSAVOS'),
    '2026-07-04 13:00:00', 'SoFi Stadium', 'PENDIENTE'
);
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, NULL,
    (SELECT internal_id FROM fase WHERE codigo = 'TREINTAIDOSAVOS'),
    '2026-07-04 16:00:00', 'MetLife Stadium', 'PENDIENTE'
);
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, NULL,
    (SELECT internal_id FROM fase WHERE codigo = 'TREINTAIDOSAVOS'),
    '2026-07-04 19:00:00', 'AT&T Stadium', 'PENDIENTE'
);
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (
    NULL, NULL,
    (SELECT internal_id FROM fase WHERE codigo = 'TREINTAIDOSAVOS'),
    '2026-07-04 22:00:00', 'Hard Rock Stadium', 'PENDIENTE'
);

-- ============================================================
-- OCTAVOS DE FINAL (5–8 Jul 2026) - 8 partidos
-- ============================================================
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (NULL, NULL, (SELECT internal_id FROM fase WHERE codigo = 'OCTAVOS'),
    '2026-07-05 16:00:00', 'MetLife Stadium', 'PENDIENTE');
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (NULL, NULL, (SELECT internal_id FROM fase WHERE codigo = 'OCTAVOS'),
    '2026-07-05 22:00:00', 'SoFi Stadium', 'PENDIENTE');
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (NULL, NULL, (SELECT internal_id FROM fase WHERE codigo = 'OCTAVOS'),
    '2026-07-06 16:00:00', 'AT&T Stadium', 'PENDIENTE');
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (NULL, NULL, (SELECT internal_id FROM fase WHERE codigo = 'OCTAVOS'),
    '2026-07-06 22:00:00', 'Hard Rock Stadium', 'PENDIENTE');
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (NULL, NULL, (SELECT internal_id FROM fase WHERE codigo = 'OCTAVOS'),
    '2026-07-07 16:00:00', 'Mercedes-Benz Stadium', 'PENDIENTE');
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (NULL, NULL, (SELECT internal_id FROM fase WHERE codigo = 'OCTAVOS'),
    '2026-07-07 22:00:00', 'NRG Stadium', 'PENDIENTE');
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (NULL, NULL, (SELECT internal_id FROM fase WHERE codigo = 'OCTAVOS'),
    '2026-07-08 16:00:00', 'Lincoln Financial Field', 'PENDIENTE');
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (NULL, NULL, (SELECT internal_id FROM fase WHERE codigo = 'OCTAVOS'),
    '2026-07-08 22:00:00', 'Lumen Field', 'PENDIENTE');

-- ============================================================
-- CUARTOS DE FINAL (10–11 Jul 2026) - 4 partidos
-- ============================================================
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (NULL, NULL, (SELECT internal_id FROM fase WHERE codigo = 'CUARTOS'),
    '2026-07-10 16:00:00', 'SoFi Stadium', 'PENDIENTE');
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (NULL, NULL, (SELECT internal_id FROM fase WHERE codigo = 'CUARTOS'),
    '2026-07-10 22:00:00', 'MetLife Stadium', 'PENDIENTE');
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (NULL, NULL, (SELECT internal_id FROM fase WHERE codigo = 'CUARTOS'),
    '2026-07-11 16:00:00', 'AT&T Stadium', 'PENDIENTE');
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (NULL, NULL, (SELECT internal_id FROM fase WHERE codigo = 'CUARTOS'),
    '2026-07-11 22:00:00', 'Hard Rock Stadium', 'PENDIENTE');

-- ============================================================
-- SEMIFINALES (14–15 Jul 2026) - 2 partidos
-- ============================================================
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (NULL, NULL, (SELECT internal_id FROM fase WHERE codigo = 'SEMIFINAL'),
    '2026-07-14 20:00:00', 'MetLife Stadium', 'PENDIENTE');
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (NULL, NULL, (SELECT internal_id FROM fase WHERE codigo = 'SEMIFINAL'),
    '2026-07-15 20:00:00', 'AT&T Stadium', 'PENDIENTE');

-- ============================================================
-- TERCER PUESTO (18 Jul 2026)
-- ============================================================
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (NULL, NULL, (SELECT internal_id FROM fase WHERE codigo = 'TERCER_PUESTO'),
    '2026-07-18 16:00:00', 'Hard Rock Stadium', 'PENDIENTE');

-- ============================================================
-- FINAL (19 Jul 2026)
-- ============================================================
INSERT INTO partido (equipo_local_id, equipo_visitante_id, fase_id, trans_date, estadio, estado)
VALUES (NULL, NULL, (SELECT internal_id FROM fase WHERE codigo = 'FINAL'),
    '2026-07-19 16:00:00', 'MetLife Stadium', 'PENDIENTE');

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
SELECT 'Total partidos insertados: ' || COUNT(*) as resumen FROM partido;
SELECT fase.nombre, COUNT(p.internal_id) as partidos
FROM partido p JOIN fase ON p.fase_id = fase.internal_id
GROUP BY fase.nombre, fase.orden
ORDER BY fase.orden;
