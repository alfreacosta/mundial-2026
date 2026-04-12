import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { CountriesService } from './countries.service';

// ── Interfaces ──────────────────────────────────────────

export interface JugadorSeleccion {
  id: number;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  numeroCamiseta: number | null;
  edad: number | null;
  posicion: string;
  posicionCodigo: string;
  fotoUrl: string | null;
  apiPlayerId: number | null;
  clubNombre: string | null;
  clubLogoUrl: string | null;
  partidosTemporada: number | null;
  convocadoEliminatoria: boolean;
  rating: number | null;
}

export interface Seleccion {
  id: number;
  nombre: string;
  codigo: string;
  grupo: string | null;
  confederacion: string;
  confederacionCodigo: string;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  pts: number;
  apiTeamId: number | null;
  logoUrl: string | null;
  banderaUrl: string | null;
  apiVenueId: number | null;
  estadioNombre: string | null;
  estadioCiudad: string | null;
  estadioFotoUrl: string | null;
  estadioCapacidad: number | null;
  plantel: JugadorSeleccion[];
  dtNombre: string | null;
  dtFotoUrl: string | null;
}

export interface Venue {
  apiVenueId: number | null;
  nombre: string;
  ciudad: string;
  pais: string;
  capacidad: number | null;
  superficie: string | null;
  fotoUrl: string | null;
}

@Injectable({ providedIn: 'root' })
export class SeleccionService {

  private readonly base = `${environment.apiUrl}/selecciones`;

  private detailCache = new Map<string, Observable<Seleccion>>();

  constructor(private http: HttpClient) {}

  /** Transforma todas las URLs de media.api-sports.io en un objeto Seleccion */
  private proxySeleccion(s: Seleccion): Seleccion {
    const p = CountriesService.proxyUrl;
    return {
      ...s,
      logoUrl: p(s.logoUrl),
      banderaUrl: p(s.banderaUrl),
      estadioFotoUrl: p(s.estadioFotoUrl),
      dtFotoUrl: p(s.dtFotoUrl),
      plantel: s.plantel?.map(j => ({
        ...j,
        fotoUrl: p(j.fotoUrl),
        clubLogoUrl: p(j.clubLogoUrl)
      })) ?? []
    };
  }

  /** Detalle completo de una selección (con plantel, DT, estadio) */
  getDetalle(codigo: string): Observable<Seleccion> {
    const key = codigo.toUpperCase();
    if (!this.detailCache.has(key)) {
      this.detailCache.set(key, this.http.get<Seleccion>(`${this.base}/${key}`).pipe(
        map(s => this.proxySeleccion(s)),
        shareReplay({ bufferSize: 1, refCount: true })
      ));
    }
    return this.detailCache.get(key)!;
  }

  /** Estadios del Mundial */
  getVenues(): Observable<Venue[]> {
    return this.http.get<Venue[]>(`${this.base}/venues`);
  }

  /** Invalida cache de un equipo específico */
  clearTeamCache(codigo: string): void {
    this.detailCache.delete(codigo.toUpperCase());
  }
}
