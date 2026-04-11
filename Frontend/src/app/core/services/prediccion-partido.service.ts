import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_AUTH_REDIRECT } from '../interceptors/auth.interceptor';

export interface PrediccionPartido {
  internalId:             number | null;
  partidoId:              number;
  equipoLocalNombre:      string;
  equipoLocalCodigo:      string;
  equipoVisitanteNombre:  string;
  equipoVisitanteCodigo:  string;
  fechaHora:              string;
  estadio:                string | null;
  faseCodigo:             string;
  faseNombre:             string;
  grupo:                  string | null;
  estadoPartido:          'PENDIENTE' | 'EN_CURSO' | 'FINALIZADO';
  golLocalReal:           number | null;
  golVisitanteReal:       number | null;
  golLocalPred:           number | null;
  golVisitantePred:       number | null;
  bloqueada:              boolean;
  puntajeObtenido:        number | null;
}

export interface ResumenPredicciones {
  totalPartidos:             number;
  predichas:                 number;
  bloqueadas:                number;
  totalPuntosPartidos:       number;
  exactas:                   number;
  correctas:                 number;
  incorrectas:               number;
  prediccionTorneoHecha:     boolean;
  prediccionTorneoConfirmada: boolean;
}

export interface GuardarPrediccionPartidoRequest {
  golLocal:     number;
  golVisitante: number;
}

@Injectable({ providedIn: 'root' })
export class PrediccionPartidoService {

  private readonly base = `${environment.apiUrl}/predicciones-partidos`;

  constructor(private http: HttpClient) {}

  /** Todas mis predicciones (skip redirect: el componente maneja el 401 con catchError) */
  getMisPredicciones(): Observable<PrediccionPartido[]> {
    return this.http.get<PrediccionPartido[]>(this.base, {
      headers: new HttpHeaders().set(SKIP_AUTH_REDIRECT, '1')
    });
  }

  /** Predicción de un partido específico */
  getMiPrediccionPartido(partidoId: number): Observable<PrediccionPartido> {
    return this.http.get<PrediccionPartido>(`${this.base}/partido/${partidoId}`);
  }

  /** Guardar o actualizar predicción */
  guardar(partidoId: number, req: GuardarPrediccionPartidoRequest): Observable<PrediccionPartido> {
    return this.http.post<PrediccionPartido>(`${this.base}/partido/${partidoId}`, req);
  }

  /** Resumen estadístico para el dashboard */
  getMiResumen(): Observable<ResumenPredicciones> {
    return this.http.get<ResumenPredicciones>(`${this.base}/resumen`);
  }
}
