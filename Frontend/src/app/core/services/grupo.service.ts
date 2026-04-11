import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Grupo,
  GrupoRow,
  EquipoFavorito,
  CrearGrupoRequest,
  UnirseGrupoRequest,
  AgregarFavoritoRequest,
  PerfilPublico,
  PerfilJuego
} from '../models/grupo.models';

@Injectable({ providedIn: 'root' })
export class GrupoService {

  private readonly base = `${environment.apiUrl}/grupos`;
  private readonly usuariosBase = `${environment.apiUrl}/usuarios`;

  constructor(private http: HttpClient) {}

  // ---- Grupos ----

  crearGrupo(req: CrearGrupoRequest): Observable<Grupo> {
    return this.http.post<Grupo>(this.base, req);
  }

  getMisGrupos(): Observable<Grupo[]> {
    return this.http.get<Grupo[]>(`${this.base}/mis-grupos`);
  }

  getDetalleGrupo(id: number): Observable<Grupo> {
    return this.http.get<Grupo>(`${this.base}/${id}`);
  }

  getPreviewPublico(codigo: string): Observable<Grupo> {
    return this.http.get<Grupo>(`${this.base}/public/${codigo}`);
  }

  unirseAlGrupo(req: UnirseGrupoRequest): Observable<GrupoRow> {
    return this.http.post<GrupoRow>(`${this.base}/unirse`, req);
  }

  salirDeGrupo(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/salir`);
  }

  eliminarGrupo(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  // ---- Favoritos (globales por usuario) ----

  getMisFavoritos(): Observable<EquipoFavorito[]> {
    return this.http.get<EquipoFavorito[]>(`${this.usuariosBase}/favoritos`);
  }

  setFavoritos(paisIds: number[]): Observable<EquipoFavorito[]> {
    return this.http.put<EquipoFavorito[]>(`${this.usuariosBase}/favoritos`, paisIds);
  }

  agregarFavorito(req: AgregarFavoritoRequest): Observable<EquipoFavorito> {
    return this.http.post<EquipoFavorito>(`${this.usuariosBase}/favoritos`, req);
  }

  quitarFavorito(paisId: number): Observable<void> {
    return this.http.delete<void>(`${this.usuariosBase}/favoritos/${paisId}`);
  }

  // ---- Usuarios / Perfiles públicos ----

  buscarUsuarios(q: string): Observable<PerfilPublico[]> {
    return this.http.get<PerfilPublico[]>(`${this.usuariosBase}/buscar`, { params: { q } });
  }

  getPerfilPublico(user: string): Observable<PerfilPublico> {
    return this.http.get<PerfilPublico>(`${this.usuariosBase}/${user}/perfil`);
  }

  getJuegoPerfil(user: string): Observable<PerfilJuego> {
    return this.http.get<PerfilJuego>(`${this.usuariosBase}/${user}/juego`);
  }

  togglePerfilPublico(perfilPublico: boolean): Observable<void> {
    return this.http.patch<void>(`${this.usuariosBase}/perfil-publico`, { perfilPublico });
  }

  // ---- Ranking de Grupos ----

  getRankingGrupos(): Observable<GrupoRanking[]> {
    return this.http.get<GrupoRanking[]>(`${this.base}/ranking`);
  }
}

export interface GrupoRanking {
  internalId: number;
  nombre: string;
  creadorNombre: string;
  cantidadMiembros: number;
  puntajeTotal: number;
}
