// ============================================================
// MUNDIAL 2026 - Modelos de Grupos
// ============================================================

/** A = Convocatoria + Predicciones | B = Convocatoria | C = Predicciones */
export type TipoJuego = 'A' | 'B' | 'C';

export const TIPO_JUEGO_LABELS: Record<TipoJuego, string> = {
  A: 'Conv. + Pred.',
  B: 'Convocatoria',
  C: 'Predicciones',
};

export const TIPO_JUEGO_DESC: Record<TipoJuego, string> = {
  A: 'Convocatoria + Predicciones',
  B: 'Solo Convocatoria',
  C: 'Solo Predicciones',
};

export interface EquipoFavorito {
  internalId: number;
  paisId: number;
  paisNombre: string;
  paisCodigo: string;
  orden: number;
  transDate: string;
  dtNombre?: string | null;
  dtFotoUrl?: string | null;
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
  tipoJuego: TipoJuego;
}

// ---- Requests ----

export interface CrearGrupoRequest {
  nombre: string;
  premio?: string;
  cantidadPaises?: number;
  paisIds: number[];
  tipoJuego?: TipoJuego;
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
  dtNombre?: string | null;
  dtFotoUrl?: string | null;
}

export interface PerfilJuego {
  favoritos: EquipoFavorito[];
  prediccion: PrediccionPublica | null;
  convocatorias: { [paisId: number]: ConvocatoriaResumen };
}
