// ============================================================
// MUNDIAL 2026 - Modelos de autenticación
// ============================================================

/** Usuario del sistema */
export interface Usuario {
  userId: number;
  user: string;       // username
  email: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  urlAvatar: string | null;
  puntaje: number;
}

/** Respuesta del backend al hacer login o register */
export interface AuthResponse {
  token: string;
  tipo: string;       // "Bearer"
  userId: number;
  user: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  urlAvatar: string | null;
  puntaje: number;
}

/** Payload para login (user_name o email + password) */
export interface LoginRequest {
  identifier: string;   // puede ser user_name o email
  password: string;
}

/** Payload para registro */
export interface RegisterRequest {
  user: string;
  email: string;
  password: string;
  nombre?: string;
  apellido?: string;
}
