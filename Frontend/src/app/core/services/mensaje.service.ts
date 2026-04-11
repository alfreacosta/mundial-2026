import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Mensaje {
  internalId: number;
  mensaje: string;
  transDate: string;
}

@Injectable({ providedIn: 'root' })
export class MensajeService {

  private readonly base = `${environment.apiUrl}/mensajes`;

  constructor(private http: HttpClient) {}

  enviar(mensaje: string, usuarioId?: number): Observable<Mensaje> {
    const body: Record<string, string> = { mensaje };
    if (usuarioId) {
      body['usuarioId'] = String(usuarioId);
    }
    return this.http.post<Mensaje>(this.base, body);
  }

  listar(): Observable<Mensaje[]> {
    return this.http.get<Mensaje[]>(this.base);
  }
}
