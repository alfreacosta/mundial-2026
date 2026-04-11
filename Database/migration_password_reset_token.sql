-- Tabla para tokens de restablecimiento de contraseña
CREATE TABLE IF NOT EXISTS password_reset_token (
    internal_id   BIGSERIAL PRIMARY KEY,
    user_id       BIGINT       NOT NULL REFERENCES usuario(internal_id) ON DELETE CASCADE,
    token         VARCHAR(255) NOT NULL UNIQUE,
    expiry_date   TIMESTAMP    NOT NULL,
    used          BOOLEAN      NOT NULL DEFAULT false,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prt_token ON password_reset_token(token);
CREATE INDEX idx_prt_user  ON password_reset_token(user_id);
