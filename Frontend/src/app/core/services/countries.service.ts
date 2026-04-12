import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Pais {
  internalId: number;
  nombre: string;
  codigo: string;
  grupo: string | null;
  activo: boolean;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  pts: number;
  apiTeamId: number | null;
  logoUrl: string | null;
  confederacion: {
    internalId: number;
    nombre: string;
    codigo: string;
    abreviatura: string;
  };
}

export interface Confederacion {
  internalId: number;
  nombre: string;
  codigo: string;
  abreviatura: string;
  activo: boolean;
}

export interface JugadorPais {
  internalId: number;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  numeroCamiseta: number | null;
  edad: number | null;
  urlFoto: string | null;
  partidosTemporada: number | null;
  convocadoEliminatoria: boolean;
  posicion: {
    internalId: number;
    codigo: string;
    nombre: string;
    abreviatura: string;
  };
  club: {
    internalId: number;
    nombre: string;
  } | null;
}

export interface ConvocatoriaResponse {
  totalJugadores: number;
  estado: string;
  jugadoresIds: number[];
  noVaIds: number[];
  titularesIds: number[];
  posicionesTitulares: { jugadorId: number; x: number; y: number }[];
}

@Injectable({ providedIn: 'root' })
export class CountriesService {
  private gql = environment.graphqlUrl;

  constructor(private http: HttpClient) {}

  /** Transforma URLs de media.api-sports.io para pasar por el proxy del backend */
  static proxyUrl(url: string | null): string | null {
    if (!url || !url.includes('media.api-sports.io')) return url;
    return `${environment.apiUrl}/images/proxy?url=${encodeURIComponent(url)}`;
  }

  /** Devuelve TODOS los países (incluyendo inactivos — filtrar en el componente por activo) */
  getPaises(): Observable<Pais[]> {
    const query = `{ paises {
      internalId nombre codigo grupo activo pj pg pe pp pts apiTeamId logoUrl
      confederacion { internalId nombre codigo abreviatura }
    } }`;
    return this.http
      .post<{ data: { paises: Pais[] } }>(this.gql, { query })
      .pipe(map(r => r.data.paises));
  }

  getPaisesPorConfederacion(codigoConf: string): Observable<Pais[]> {
    const query = `query($codigo: String!) { paisesPorConfederacion(codigo: $codigo) {
      internalId nombre codigo grupo activo pj pg pe pp pts apiTeamId logoUrl
      confederacion { internalId nombre codigo abreviatura }
    } }`;
    return this.http
      .post<{ data: { paisesPorConfederacion: Pais[] } }>(this.gql, { query, variables: { codigo: codigoConf } })
      .pipe(map(r => r.data.paisesPorConfederacion));
  }

  getConfederaciones(): Observable<Confederacion[]> {
    const query = `{ confederaciones { internalId nombre codigo abreviatura activo } }`;
    return this.http
      .post<{ data: { confederaciones: Confederacion[] } }>(this.gql, { query })
      .pipe(map(r => r.data.confederaciones));
  }

  getJugadoresPorPais(paisId: number): Observable<JugadorPais[]> {
    const query = `{ jugadoresPorPais(paisId: ${paisId}) {
      internalId nombre apellido nombreCompleto numeroCamiseta edad urlFoto convocadoEliminatoria
      posicion { internalId codigo nombre abreviatura }
      club { internalId nombre }
    } }`;
    return this.http
      .post<{ data: { jugadoresPorPais: JugadorPais[] } }>(this.gql, { query })
      .pipe(map(r => (r.data?.jugadoresPorPais ?? []).map(j => ({
        ...j,
        urlFoto: CountriesService.proxyUrl(j.urlFoto)
      }))));
  }

  getMiConvocatoria(paisId: number): Observable<ConvocatoriaResponse | null> {
    const query = `{ miConvocatoria(paisId: ${paisId}) {
      totalJugadores estado jugadoresIds noVaIds titularesIds
      posicionesTitulares { jugadorId x y }
    } }`;
    return this.http
      .post<{ data: { miConvocatoria: ConvocatoriaResponse | null } }>(this.gql, { query })
      .pipe(map(r => r.data?.miConvocatoria ?? null));
  }

  guardarConvocatoria(paisId: number, jugadorIds: number[], noVaIds: number[] = [], titularesIds: number[] = []): Observable<ConvocatoriaResponse> {
    const ids = JSON.stringify(jugadorIds);
    const noVa = JSON.stringify(noVaIds);
    const tit = JSON.stringify(titularesIds);
    const query = `mutation {
      guardarConvocatoria(paisId: ${paisId}, jugadorIds: ${ids}, noVaIds: ${noVa}, titularesIds: ${tit}) {
        totalJugadores estado jugadoresIds noVaIds titularesIds
        posicionesTitulares { jugadorId x y }
      }
    }`;
    return this.http
      .post<{ data: { guardarConvocatoria: ConvocatoriaResponse } }>(this.gql, { query })
      .pipe(map(r => r.data.guardarConvocatoria));
  }

  guardarPosicionesTitulares(paisId: number, posiciones: { jugadorId: number; x: number; y: number }[]): Observable<boolean> {
    const posArr = posiciones.map(p => `{jugadorId: ${p.jugadorId}, x: ${p.x}, y: ${p.y}}`).join(', ');
    const query = `mutation {
      guardarPosicionesTitulares(paisId: ${paisId}, posiciones: [${posArr}])
    }`;
    return this.http
      .post<{ data: { guardarPosicionesTitulares: boolean } }>(this.gql, { query })
      .pipe(map(r => r.data.guardarPosicionesTitulares));
  }
}

