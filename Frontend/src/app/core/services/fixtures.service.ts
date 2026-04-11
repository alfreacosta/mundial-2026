import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, timer, switchMap, catchError, tap, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Fixture {
  id: number;
  equipoLocalNombre: string;
  equipoLocalCodigo: string;
  equipoVisitanteNombre: string;
  equipoVisitanteCodigo: string;
  faseNombre: string;
  faseCodigo: string;
  grupo: string | null;
  golLocal: number | null;
  golVisitante: number | null;
  fechaHora: string;
  estadio: string;
  ciudad: string;
  estado: 'PENDIENTE' | 'EN_CURSO' | 'FINALIZADO';
  minuto: number | null;
  apiExternalId: number | null;
  tipoPartido: 'MUNDIAL' | 'AMISTOSO';
}

export interface FixtureSummary {
  total: number;
  finalizados: number;
  enCurso: number;
  pendientes: number;
}

@Injectable({ providedIn: 'root' })
export class FixturesService {

  private readonly base = `${environment.apiUrl}/fixtures`;

  // Cache reactivo para fixtures
  private fixturesCache$: Observable<Fixture[]> | null = null;

  // Subject para partidos en vivo (polling)
  private liveFixtures$ = new BehaviorSubject<Fixture[]>([]);

  constructor(private http: HttpClient) {}

  /** Todos los partidos del Mundial (con cache) */
  getAllFixtures(): Observable<Fixture[]> {
    if (!this.fixturesCache$) {
      this.fixturesCache$ = this.http.get<Fixture[]>(this.base).pipe(
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }
    return this.fixturesCache$;
  }

  /** Invalidar cache (para forzar refresh) */
  clearCache(): void {
    this.fixturesCache$ = null;
  }

  /** Partidos filtrados por fase */
  getByFase(faseCodigo: string): Observable<Fixture[]> {
    return this.http.get<Fixture[]>(`${this.base}/fase/${faseCodigo}`);
  }

  /** Partidos de un grupo */
  getByGrupo(grupo: string): Observable<Fixture[]> {
    return this.http.get<Fixture[]>(`${this.base}/grupo/${grupo}`);
  }

  /** Partidos de una fecha */
  getByDate(fecha: string): Observable<Fixture[]> {
    return this.http.get<Fixture[]>(`${this.base}/fecha/${fecha}`);
  }

  /** Partidos en vivo */
  getLiveFixtures(): Observable<Fixture[]> {
    return this.http.get<Fixture[]>(`${this.base}/live`);
  }

  /** Amistosos internacionales */
  getFriendlies(): Observable<Fixture[]> {
    return this.http.get<Fixture[]>(`${this.base}/friendlies`);
  }

  /** Fechas disponibles */
  getAvailableDates(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/dates`);
  }

  /** Resumen de partidos */
  getSummary(): Observable<FixtureSummary> {
    return this.http.get<FixtureSummary>(`${this.base}/summary`);
  }

  /**
   * Polling de partidos en vivo (cada 60 segundos)
   * Suscribirse para actualizaciones automáticas
   */
  startLivePolling(intervalMs: number = 60000): Observable<Fixture[]> {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.getLiveFixtures()),
      tap(live => this.liveFixtures$.next(live)),
      catchError(() => of([]))
    );
  }

  /** Observable de partidos en vivo (último valor) */
  get currentLiveFixtures$(): Observable<Fixture[]> {
    return this.liveFixtures$.asObservable();
  }

  // ---- Utilidades ----

  /** Mapa de banderas por código de país */
  static readonly FLAG_MAP: Record<string, string> = {
    MEX: '🇲🇽', RSA: '🇿🇦', KOR: '🇰🇷', CAN: '🇨🇦', QAT: '🇶🇦',
    SUI: '🇨🇭', BRA: '🇧🇷', MAR: '🇲🇦', HAI: '🇭🇹', SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    USA: '🇺🇸', PAR: '🇵🇾', AUS: '🇦🇺', GER: '🇩🇪', CUW: '🇨🇼',
    CIV: '🇨🇮', ECU: '🇪🇨', NED: '🇳🇱', JPN: '🇯🇵', TUN: '🇹🇳',
    BEL: '🇧🇪', EGY: '🇪🇬', IRN: '🇮🇷', NZL: '🇳🇿', ESP: '🇪🇸',
    CPV: '🇨🇻', SAU: '🇸🇦', URU: '🇺🇾', FRA: '🇫🇷', SEN: '🇸🇳',
    NOR: '🇳🇴', ARG: '🇦🇷', ALG: '🇩🇿', AUT: '🇦🇹', JOR: '🇯🇴',
    POR: '🇵🇹', UZB: '🇺🇿', COL: '🇨🇴', ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', CRO: '🇭🇷',
    GHA: '🇬🇭', PAN: '🇵🇦', ITA: '🇮🇹', DEN: '🇩🇰', POL: '🇵🇱',
    IRQ: '🇮🇶', JAM: '🇯🇲', CHI: '🇨🇱', SRB: '🇷🇸', CMR: '🇨🇲',
    NGA: '🇳🇬', PER: '🇵🇪', BHR: '🇧🇭', CRC: '🇨🇷', HUN: '🇭🇺',
    TBD: '🏳️'
  };

  getFlag(codigo: string): string {
    return FixturesService.FLAG_MAP[codigo] ?? '🏳️';
  }

  /** Nombre de fase legible */
  getFaseLabel(codigo: string): string {
    const map: Record<string, string> = {
      'GRUPOS': 'Fase de Grupos',
      'TREINTAIDOSAVOS': '32avos de Final',
      'OCTAVOS': 'Octavos de Final',
      'CUARTOS': 'Cuartos de Final',
      'SEMIFINAL': 'Semifinal',
      'TERCER_PUESTO': 'Tercer Puesto',
      'FINAL': 'Final'
    };
    return map[codigo] ?? codigo;
  }

  /** Color por estado */
  getEstadoColor(estado: string): string {
    switch (estado) {
      case 'EN_CURSO': return '#ff3b30';
      case 'FINALIZADO': return '#6b7280';
      case 'PENDIENTE': return '#00d4ff';
      default: return '#6b7280';
    }
  }
}
