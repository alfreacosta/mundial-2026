import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface UsuarioRanking {
  internalId: number;
  user: string;
  nombre: string | null;
  apellido: string | null;
  urlAvatar: string | null;
  puntaje: number;
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private gql = environment.graphqlUrl;

  constructor(private http: HttpClient) {}

  getRanking(): Observable<UsuarioRanking[]> {
    const query = `
      query {
        ranking {
          internalId
          user
          nombre
          apellido
          urlAvatar
          puntaje
        }
      }
    `;
    return this.http
      .post<{ data: { ranking: UsuarioRanking[] } }>(this.gql, { query })
      .pipe(map(res => res.data.ranking));
  }
}
