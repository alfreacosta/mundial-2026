-- ============================================================
-- MUNDIAL 2026 - SCHEMA COMPLETO Y DEFINITIVO
-- PostgreSQL 14+
-- Fuente de verdad única — reemplaza schema.sql + todas las migrations
-- Última actualización: 2026-04-07
-- ============================================================

-- CREATE DATABASE mundial;

-- ============================================================
-- DROP TABLAS (orden inverso por dependencias)
-- ============================================================
DROP TABLE IF EXISTS equipo_favorito        CASCADE;
DROP TABLE IF EXISTS grupo_row              CASCADE;
DROP TABLE IF EXISTS grupo                  CASCADE;
DROP TABLE IF EXISTS mensaje                CASCADE;
DROP TABLE IF EXISTS prediccion_torneo      CASCADE;
DROP TABLE IF EXISTS prediccion             CASCADE;
DROP TABLE IF EXISTS alineacion_row         CASCADE;
DROP TABLE IF EXISTS alineacion             CASCADE;
DROP TABLE IF EXISTS convocatoria_row       CASCADE;
DROP TABLE IF EXISTS convocatoria           CASCADE;
DROP TABLE IF EXISTS partido                CASCADE;
DROP TABLE IF EXISTS estadio                CASCADE;
DROP TABLE IF EXISTS jugador                CASCADE;
DROP TABLE IF EXISTS club                   CASCADE;
DROP TABLE IF EXISTS pais                   CASCADE;
DROP TABLE IF EXISTS posicion_jugador       CASCADE;
DROP TABLE IF EXISTS fase                   CASCADE;
DROP TABLE IF EXISTS confederacion          CASCADE;
DROP TABLE IF EXISTS usuario                CASCADE;

-- ============================================================
-- 1. USUARIO
-- ============================================================
CREATE TABLE usuario (
    internal_id    BIGSERIAL       PRIMARY KEY,
    user_name      VARCHAR(50)     NOT NULL UNIQUE,
    email          VARCHAR(100)    NOT NULL UNIQUE,
    pass           VARCHAR(255),                        -- NULL si login con OAuth
    oauth_provider VARCHAR(20),                         -- 'google' | NULL
    oauth_id       VARCHAR(255),                        -- ID externo del proveedor
    nombre         VARCHAR(100),
    apellido       VARCHAR(100),
    telefono       VARCHAR(30),
    url_avatar     VARCHAR(255),
    puntaje        INTEGER         NOT NULL DEFAULT 0,
    trans_date     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso  TIMESTAMP,
    activo         BOOLEAN         NOT NULL DEFAULT TRUE,
    perfil_publico BOOLEAN         NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_usuario_user_name ON usuario(user_name);
CREATE INDEX idx_usuario_email     ON usuario(email);
CREATE INDEX idx_usuario_activo    ON usuario(activo);

-- ============================================================
-- 2. CONFEDERACION (Catalogo)
-- ============================================================
CREATE TABLE confederacion (
    internal_id  BIGSERIAL      PRIMARY KEY,
    nombre       VARCHAR(150)   NOT NULL,
    codigo       VARCHAR(20)    NOT NULL UNIQUE,
    abreviatura  VARCHAR(20)    NOT NULL,
    activo       BOOLEAN        NOT NULL DEFAULT TRUE
);

-- ============================================================
-- 3. FASE (Catalogo)
-- ============================================================
CREATE TABLE fase (
    internal_id  BIGSERIAL      PRIMARY KEY,
    nombre       VARCHAR(100)   NOT NULL,
    codigo       VARCHAR(30)    NOT NULL UNIQUE,
    orden        INTEGER        NOT NULL,
    activo       BOOLEAN        NOT NULL DEFAULT TRUE
);

-- ============================================================
-- 4. POSICION_JUGADOR (Catalogo)
-- ============================================================
CREATE TABLE posicion_jugador (
    internal_id  BIGSERIAL      PRIMARY KEY,
    nombre       VARCHAR(50)    NOT NULL,
    codigo       VARCHAR(10)    NOT NULL UNIQUE,
    abreviatura  VARCHAR(10)    NOT NULL,
    activo       BOOLEAN        NOT NULL DEFAULT TRUE
);

-- ============================================================
-- 5. PAIS
-- ============================================================
CREATE TABLE pais (
    internal_id       BIGSERIAL      PRIMARY KEY,
    nombre            VARCHAR(100)   NOT NULL,
    codigo            VARCHAR(10)    NOT NULL UNIQUE,
    confederacion_id  BIGINT         NOT NULL REFERENCES confederacion(internal_id),
    grupo             VARCHAR(5),
    activo            BOOLEAN        NOT NULL DEFAULT TRUE,
    -- Estadísticas fase de grupos
    pj                INTEGER        NOT NULL DEFAULT 0,
    pg                INTEGER        NOT NULL DEFAULT 0,
    pe                INTEGER        NOT NULL DEFAULT 0,
    pp                INTEGER        NOT NULL DEFAULT 0,
    pts               INTEGER        NOT NULL DEFAULT 0,
    -- Sync con API-Football
    api_team_id       BIGINT,
    logo_url          VARCHAR(300),
    ultimo_sync       TIMESTAMP
);

CREATE INDEX idx_pais_confederacion ON pais(confederacion_id);
CREATE INDEX idx_pais_codigo        ON pais(codigo);

-- ============================================================
-- 6. CLUB (Catalogo)
-- ============================================================
CREATE TABLE club (
    internal_id  BIGSERIAL      PRIMARY KEY,
    nombre       VARCHAR(150)   NOT NULL,
    codigo       VARCHAR(20)    NOT NULL UNIQUE,
    pais_id      BIGINT         NOT NULL REFERENCES pais(internal_id),
    url_escudo   VARCHAR(255),
    activo       BOOLEAN        NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_club_pais ON club(pais_id);

-- ============================================================
-- 7. JUGADOR
-- ============================================================
CREATE TABLE jugador (
    internal_id      BIGSERIAL      PRIMARY KEY,
    pais_id          BIGINT         NOT NULL REFERENCES pais(internal_id),
    posicion_id      BIGINT         NOT NULL REFERENCES posicion_jugador(internal_id),
    club_id          BIGINT         REFERENCES club(internal_id),
    nombre           VARCHAR(100)   NOT NULL,
    apellido         VARCHAR(100)   NOT NULL,
    nombre_completo  VARCHAR(200)   GENERATED ALWAYS AS (nombre || ' ' || apellido) STORED,
    fecha_nacimiento DATE,
    edad             INTEGER,
    numero_camiseta  INTEGER,
    url_foto         VARCHAR(255),
    api_player_id    BIGINT          UNIQUE, -- ID en API-Football (único para evitar duplicados entre ligas)
    stats_json       JSONB,
    ultima_stats_sync TIMESTAMP,
    partidos_temporada INTEGER,
    convocado_eliminatoria BOOLEAN DEFAULT false
);

CREATE INDEX idx_jugador_pais        ON jugador(pais_id);
CREATE INDEX idx_jugador_posicion    ON jugador(posicion_id);
CREATE INDEX idx_jugador_club        ON jugador(club_id);
CREATE INDEX idx_jugador_api_player  ON jugador(api_player_id);

-- ============================================================
-- 8. ESTADIO
-- ============================================================
CREATE TABLE estadio (
    internal_id  BIGSERIAL      PRIMARY KEY,
    nombre       VARCHAR(150)   NOT NULL,
    ciudad       VARCHAR(100)   NOT NULL,
    pais         VARCHAR(50)    NOT NULL,
    capacidad    INTEGER,
    url_foto     VARCHAR(255),
    api_venue_id BIGINT,
    activo       BOOLEAN        NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_estadio_nombre ON estadio(nombre);

-- ============================================================
-- 9. PARTIDO
-- ============================================================
CREATE TABLE partido (
    internal_id          BIGSERIAL      PRIMARY KEY,
    equipo_local_id      BIGINT         REFERENCES pais(internal_id),
    equipo_visitante_id  BIGINT         REFERENCES pais(internal_id),
    fase_id              BIGINT         NOT NULL REFERENCES fase(internal_id),
    estadio_id           BIGINT         REFERENCES estadio(internal_id),
    trans_date           TIMESTAMP      NOT NULL,
    estadio              VARCHAR(150),  -- nombre de texto (redundante con estadio_id, se mantiene por compatibilidad)
    gol_local            INTEGER,
    gol_visitante        INTEGER,
    estado               VARCHAR(20)    NOT NULL DEFAULT 'PENDIENTE'
                             CHECK (estado IN ('PENDIENTE', 'EN_CURSO', 'FINALIZADO')),
    finalizado           BOOLEAN        NOT NULL DEFAULT FALSE,
    end_date             TIMESTAMP
);

CREATE INDEX idx_partido_fase             ON partido(fase_id);
CREATE INDEX idx_partido_equipo_local     ON partido(equipo_local_id);
CREATE INDEX idx_partido_equipo_visitante ON partido(equipo_visitante_id);
CREATE INDEX idx_partido_estado           ON partido(estado);
CREATE INDEX idx_partido_trans_date       ON partido(trans_date);

-- ============================================================
-- 9. CONVOCATORIA (Cabecera)
-- ============================================================
CREATE TABLE convocatoria (
    internal_id     BIGSERIAL      PRIMARY KEY,
    usuario_id      BIGINT         NOT NULL REFERENCES usuario(internal_id),
    pais_id         BIGINT         NOT NULL REFERENCES pais(internal_id),
    trans_date      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_date        TIMESTAMP,
    cerrada         BOOLEAN        NOT NULL DEFAULT FALSE,
    total_jugadores INTEGER        NOT NULL DEFAULT 0,
    estado          VARCHAR(20)    NOT NULL DEFAULT 'EN_PROGRESO'
                        CHECK (estado IN ('EN_PROGRESO', 'CERRADA', 'EVALUADA')),

    CONSTRAINT uq_convocatoria_usuario_pais UNIQUE (usuario_id, pais_id)
);

CREATE INDEX idx_convocatoria_usuario ON convocatoria(usuario_id);
CREATE INDEX idx_convocatoria_pais    ON convocatoria(pais_id);
CREATE INDEX idx_convocatoria_estado  ON convocatoria(estado);

-- ============================================================
-- 10. CONVOCATORIA_ROW (Detalle)
-- ============================================================
CREATE TABLE convocatoria_row (
    internal_id  BIGSERIAL      PRIMARY KEY,
    master_id    BIGINT         NOT NULL REFERENCES convocatoria(internal_id) ON DELETE CASCADE,
    jugador_id   BIGINT         NOT NULL REFERENCES jugador(internal_id),
    estado       VARCHAR(20)    NOT NULL DEFAULT 'PENDIENTE'
                     CHECK (estado IN ('PENDIENTE', 'CONVOCADO', 'NO_VA', 'TITULAR')),
    trans_date   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_convocatoria_row_jugador UNIQUE (master_id, jugador_id)
);

CREATE INDEX idx_convocatoria_row_master  ON convocatoria_row(master_id);
CREATE INDEX idx_convocatoria_row_jugador ON convocatoria_row(jugador_id);
CREATE INDEX idx_convocatoria_row_estado  ON convocatoria_row(estado);

-- ============================================================
-- 11. ALINEACION (Cabecera)
-- ============================================================
CREATE TABLE alineacion (
    internal_id                BIGSERIAL      PRIMARY KEY,
    usuario_id                 BIGINT         NOT NULL REFERENCES usuario(internal_id),
    partido_id                 BIGINT         NOT NULL REFERENCES partido(internal_id),
    pais_id                    BIGINT         NOT NULL REFERENCES pais(internal_id),
    trans_date                 TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion        TIMESTAMP,
    confirmada                 BOOLEAN        NOT NULL DEFAULT FALSE,
    formacion                  VARCHAR(10),
    total_jugadores_convocados INTEGER        NOT NULL DEFAULT 0
);

CREATE INDEX idx_alineacion_usuario ON alineacion(usuario_id);
CREATE INDEX idx_alineacion_partido ON alineacion(partido_id);
CREATE INDEX idx_alineacion_pais    ON alineacion(pais_id);

-- ============================================================
-- 12. ALINEACION_ROW (Detalle)
-- ============================================================
CREATE TABLE alineacion_row (
    internal_id  BIGSERIAL      PRIMARY KEY,
    master_id    BIGINT         NOT NULL REFERENCES alineacion(internal_id) ON DELETE CASCADE,
    jugador_id   BIGINT         NOT NULL REFERENCES jugador(internal_id),
    estado       VARCHAR(20)    NOT NULL
                     CHECK (estado IN ('TITULAR', 'SUPLENTE')),

    CONSTRAINT uq_alineacion_row_jugador UNIQUE (master_id, jugador_id)
);

CREATE INDEX idx_alineacion_row_master  ON alineacion_row(master_id);
CREATE INDEX idx_alineacion_row_jugador ON alineacion_row(jugador_id);
CREATE INDEX idx_alineacion_row_estado  ON alineacion_row(estado);

-- ============================================================
-- 13. PREDICCION
-- ============================================================
CREATE TABLE prediccion (
    internal_id          BIGSERIAL      PRIMARY KEY,
    usuario_id           BIGINT         NOT NULL REFERENCES usuario(internal_id),
    partido_id           BIGINT         NOT NULL REFERENCES partido(internal_id),
    gol_local            INTEGER        NOT NULL DEFAULT 0,
    gol_visitante        INTEGER        NOT NULL DEFAULT 0,
    aprobada             BOOLEAN        NOT NULL DEFAULT FALSE,
    puntaje_obtenido     INTEGER,
    trans_date           TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion  TIMESTAMP,

    CONSTRAINT uq_prediccion_usuario_partido UNIQUE (usuario_id, partido_id)
);

CREATE INDEX idx_prediccion_usuario  ON prediccion(usuario_id);
CREATE INDEX idx_prediccion_partido  ON prediccion(partido_id);
CREATE INDEX idx_prediccion_aprobada ON prediccion(aprobada);

-- ============================================================
-- 14. PREDICCION_TORNEO
-- ============================================================
CREATE TABLE prediccion_torneo (
    internal_id           BIGSERIAL      PRIMARY KEY,
    usuario_id            BIGINT         NOT NULL REFERENCES usuario(internal_id),
    pais_campeon_id       BIGINT         REFERENCES pais(internal_id),
    jugador_goleador_id   BIGINT         REFERENCES jugador(internal_id),
    trans_date            TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion   TIMESTAMP,
    end_date              TIMESTAMP,
    confirmada            BOOLEAN        NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_prediccion_torneo_usuario UNIQUE (usuario_id)
);

CREATE INDEX idx_prediccion_torneo_usuario  ON prediccion_torneo(usuario_id);
CREATE INDEX idx_prediccion_torneo_campeon  ON prediccion_torneo(pais_campeon_id);
CREATE INDEX idx_prediccion_torneo_goleador ON prediccion_torneo(jugador_goleador_id);

-- ============================================================
-- PROCEDIMIENTO ALMACENADO: Cierre automatico de predicciones
-- ============================================================
CREATE OR REPLACE FUNCTION cerrar_predicciones_automatico()
RETURNS void AS $$
BEGIN
    UPDATE prediccion
    SET aprobada = TRUE
    WHERE aprobada = FALSE
      AND partido_id IN (
          SELECT internal_id
          FROM partido
          WHERE trans_date <= NOW()
            AND finalizado = FALSE
      );
END;
$$ LANGUAGE plpgsql;

-- Job con pg_cron: ejecuta cada minuto
-- SELECT cron.schedule('cerrar-predicciones', '* * * * *', 'SELECT cerrar_predicciones_automatico();');

-- ============================================================
-- 15. MENSAJE (Sugerencias / opiniones de usuarios)
-- ============================================================
CREATE TABLE mensaje (
    internal_id  BIGSERIAL      PRIMARY KEY,
    usuario_id   BIGINT         REFERENCES usuario(internal_id),
    mensaje      TEXT           NOT NULL,
    trans_date   TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mensaje_usuario ON mensaje(usuario_id);
CREATE INDEX idx_mensaje_fecha   ON mensaje(trans_date);

-- ============================================================
-- 16. GRUPO (Cabecera del grupo de predicciones)
-- ============================================================
CREATE TABLE grupo (
    internal_id       BIGSERIAL       PRIMARY KEY,
    numero            INTEGER         NOT NULL,
    nombre            VARCHAR(100)    NOT NULL,
    premio            VARCHAR(255),
    codigo_invitacion VARCHAR(20)     NOT NULL,
    creador_id        BIGINT          NOT NULL REFERENCES usuario(internal_id) ON DELETE RESTRICT,
    cantidad_paises   INTEGER         NOT NULL DEFAULT 5,
    trans_date        TIMESTAMP       NOT NULL DEFAULT NOW(),
    activo            BOOLEAN         NOT NULL DEFAULT TRUE,

    CONSTRAINT uq_grupo_codigo UNIQUE (codigo_invitacion),
    CONSTRAINT chk_grupo_cantidad_paises CHECK (cantidad_paises BETWEEN 1 AND 5)
);

CREATE INDEX idx_grupo_creador ON grupo(creador_id);
CREATE INDEX idx_grupo_codigo  ON grupo(codigo_invitacion);

-- ============================================================
-- 17. GRUPO_ROW (Un registro por miembro del grupo)
-- ============================================================
CREATE TABLE grupo_row (
    internal_id     BIGSERIAL       PRIMARY KEY,
    master_id       BIGINT          NOT NULL REFERENCES grupo(internal_id) ON DELETE CASCADE,
    usuario_id      BIGINT          NOT NULL REFERENCES usuario(internal_id) ON DELETE RESTRICT,
    rol             VARCHAR(20)     NOT NULL DEFAULT 'MIEMBRO',
    pais_campeon_id BIGINT          REFERENCES pais(internal_id) ON DELETE RESTRICT,
    goleador_id     BIGINT          REFERENCES jugador(internal_id) ON DELETE RESTRICT,
    fecha_union     TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_grupo_row_usuario UNIQUE (master_id, usuario_id),
    CONSTRAINT chk_grupo_row_rol CHECK (rol IN ('CREADOR', 'MIEMBRO'))
);

CREATE INDEX idx_grupo_row_master  ON grupo_row(master_id);
CREATE INDEX idx_grupo_row_usuario ON grupo_row(usuario_id);

-- ============================================================
-- 18. EQUIPO_FAVORITO (Hasta 5 equipos favoritos por usuario — global)
-- ============================================================
CREATE TABLE equipo_favorito (
    internal_id BIGSERIAL   PRIMARY KEY,
    usuario_id  BIGINT      NOT NULL REFERENCES usuario(internal_id) ON DELETE CASCADE,
    pais_id     BIGINT      NOT NULL REFERENCES pais(internal_id) ON DELETE RESTRICT,
    orden       INTEGER     NOT NULL,
    trans_date  TIMESTAMP   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_ef_usuario_pais  UNIQUE (usuario_id, pais_id),
    CONSTRAINT uq_ef_usuario_orden UNIQUE (usuario_id, orden),
    CONSTRAINT chk_ef_orden CHECK (orden BETWEEN 1 AND 5)
);

CREATE INDEX idx_equipo_fav_usuario ON equipo_favorito(usuario_id);

-- 19. GRUPO_ROW_PAIS (Países seleccionados por un usuario para un grupo específico)
CREATE TABLE grupo_row_pais (
    internal_id     BIGSERIAL       PRIMARY KEY,
    grupo_row_id    BIGINT          NOT NULL REFERENCES grupo_row(internal_id) ON DELETE CASCADE,
    pais_id         BIGINT          NOT NULL REFERENCES pais(internal_id) ON DELETE RESTRICT,
    orden           INTEGER         NOT NULL,
    CONSTRAINT uq_grp_row_pais UNIQUE (grupo_row_id, pais_id),
    CONSTRAINT uq_grp_row_orden UNIQUE (grupo_row_id, orden),
    CONSTRAINT chk_grp_row_orden CHECK (orden BETWEEN 1 AND 5)
);
CREATE INDEX idx_grupo_row_pais_row ON grupo_row_pais(grupo_row_id);

-- ============================================================
-- FIN DEL SCHEMA
-- ============================================================
