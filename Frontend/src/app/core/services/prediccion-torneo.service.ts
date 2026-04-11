import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { CountriesService } from './countries.service';
import { SKIP_AUTH_REDIRECT } from '../interceptors/auth.interceptor';

export interface PrediccionTorneo {
  internalId: number;
  paisCampeonId: number;
  paisCampeonNombre: string;
  paisCampeonCodigo: string;
  jugadorGoleadorId: number;
  jugadorGoleadorNombre: string;
  jugadorGoleadorPaisCodigo: string;
  jugadorGoleadorUrlFoto: string | null;
  confirmada: boolean;
  transDate: string;
  fechaActualizacion: string | null;
}

export interface GuardarPrediccionRequest {
  paisCampeonId: number;
  jugadorGoleadorId: number;
}

@Injectable({ providedIn: 'root' })
export class PrediccionTorneoService {

  private readonly base = `${environment.apiUrl}/prediccion-torneo`;

  constructor(private http: HttpClient) {}

  private applyProxy(p: PrediccionTorneo): PrediccionTorneo {
    return { ...p, jugadorGoleadorUrlFoto: CountriesService.proxyUrl(p.jugadorGoleadorUrlFoto) };
  }

  /** Skip redirect: el componente maneja el 401 con catchError */
  getMiPrediccion(): Observable<PrediccionTorneo | null> {
    return this.http.get<PrediccionTorneo | null>(this.base, {
      headers: new HttpHeaders().set(SKIP_AUTH_REDIRECT, '1')
    }).pipe(map(p => p ? this.applyProxy(p) : null));
  }

  guardar(req: GuardarPrediccionRequest): Observable<PrediccionTorneo> {
    return this.http.post<PrediccionTorneo>(this.base, req)
      .pipe(map(p => this.applyProxy(p)));
  }
}
