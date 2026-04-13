// ============================================================
// MUNDIAL 2026 - Modelos de Grupos
// ============================================================

export interface EquipoFavorito {
  internalId: number;
  paisId: number;
  paisNombre: string;
  paisCodigo: string;
  orden: number;
  transDate: string;
}

export interface GrupoRow {
  internalId: number;
  grupoId: number;
  usuarioId: number;
  usuarioNombre: string | null;
  usuarioApellido: string | null;
  urlAvatar: string | null;
  rol: 'CREADOR' | 'MIEMBRO';
  paisCampeonId: number;
  paisCampeonNombre: string;
  paisCampeonCodigo: string;
  goleadorId: number;
  goleadorNombre: string;
  goleadorApellido: string;
  goleadorFoto: string | null;
  fechaUnion: string;
  equiposFavoritos: EquipoFavorito[];
  puntaje: number;
  perfilPublico: boolean;
  user?: string;
}

export interface Grupo {
  internalId: number;
  numero: number;
  nombre: string;
  premio: string | null;
  codigoInvitacion: string;
  creadorId: number;
  creadorNombre: string;
  transDate: string;
  activo: boolean;
  cantidadPaises: number;
  cantidadMiembros: number | null;
  miembros: GrupoRow[] | null;
}

// ---- Requests ----

export interface CrearGrupoRequest {
  nombre: string;
  premio?: string;
  cantidadPaises?: number;
  paisIds: number[];
}

export interface UnirseGrupoRequest {
  codigoInvitacion: string;
  paisIds: number[];
}

export interface AgregarFavoritoRequest {
  paisId: number;
  orden: number;
}

// ---- Perfil público ----

export interface PerfilPublico {
  internalId: number;
  user: string;
  nombre: string | null;
  apellido: string | null;
  urlAvatar: string | null;
  puntaje: number;
}

// ---- Juego público de un usuario ----

export interface JugadorResumen {
  id: number;
  nombre: string;
  numeroCamiseta: number | null;
  posicion: string;
  posicionAbr: string;
  urlFoto: string | null;
}

export interface PrediccionPublica {
  internalId: number;
  paisCampeonId: number;
  paisCampeonNombre: string;
  paisCampeonCodigo: string;
  jugadorGoleadorId: number;
  jugadorGoleadorNombre: string;
  jugadorGoleadorPaisCodigo: string;
  jugadorGoleadorUrlFoto: string | null;
  confirmada: boolean;
}

export interface ConvocatoriaResumen {
  paisNombre: string;
  paisCodigo: string;
  jugadores: JugadorResumen[];
  titularesIds?: number[];
  posicionesTitulares?: { jugadorId: number; x: number; y: number }[];
}

export interface PerfilJuego {
  favoritos: EquipoFavorito[];
  prediccion: PrediccionPublica | null;
  convocatorias: { [paisId: number]: ConvocatoriaResumen };
}
