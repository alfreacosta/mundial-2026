import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { CountriesService } from './countries.service';

export interface Jugador {
  internalId: number;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  numeroCamiseta: number | null;
  edad: number | null;
  urlFoto: string | null;
  posicion: {
    internalId: number;
    codigo: string;       // 'ARQ', 'DEF', 'MED', 'DEL'
    nombre: string;
    abreviatura: string;
  };
  pais: {
    internalId: number;
    nombre: string;
    codigo: string;
  };
  club: {
    internalId: number;
    nombre: string;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class PlayersService {
  private gql = environment.graphqlUrl;

  constructor(private http: HttpClient) {}

  private proxyJugadores(list: Jugador[]): Jugador[] {
    return list.map(j => ({ ...j, urlFoto: CountriesService.proxyUrl(j.urlFoto) }));
  }

  getJugadores(): Observable<Jugador[]> {
    const query = `{ jugadores {
      internalId nombre apellido nombreCompleto numeroCamiseta edad urlFoto
      posicion { internalId codigo nombre abreviatura }
      pais { internalId nombre codigo }
      club { internalId nombre }
    } }`;
    return this.http
      .post<{ data: { jugadores: Jugador[] } }>(this.gql, { query })
      .pipe(map(r => this.proxyJugadores(r.data?.jugadores ?? [])));
  }

  getJugadorById(id: number): Observable<Jugador> {
    const query = `{ jugador(id: ${id}) {
      internalId nombre apellido nombreCompleto numeroCamiseta edad urlFoto
      posicion { internalId codigo nombre abreviatura }
      pais { internalId nombre codigo }
      club { internalId nombre }
    } }`;
    return this.http
      .post<{ data: { jugador: Jugador } }>(this.gql, { query })
      .pipe(map(r => ({ ...r.data.jugador, urlFoto: CountriesService.proxyUrl(r.data.jugador.urlFoto) })));
  }

  getJugadoresPorPosicion(codigo: string): Observable<Jugador[]> {
    const query = `query($codigo: String!) { jugadoresPorPosicion(codigo: $codigo) {
      internalId nombre apellido nombreCompleto numeroCamiseta edad urlFoto
      posicion { internalId codigo nombre abreviatura }
      pais { internalId nombre codigo }
      club { internalId nombre }
    } }`;
    return this.http
      .post<{ data: { jugadoresPorPosicion: Jugador[] } }>(this.gql, { query, variables: { codigo } })
      .pipe(map(r => this.proxyJugadores(r.data?.jugadoresPorPosicion ?? [])));
  }
}
