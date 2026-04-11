import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { normalize } from '../../shared/utils/normalize';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  PrediccionPartidoService,
  PrediccionPartido
} from '../../core/services/prediccion-partido.service';
import { FixturesService, Fixture } from '../../core/services/fixtures.service';
import { CountriesService, Pais } from '../../core/services/countries.service';
import { PlayersService, Jugador } from '../../core/services/players.service';
import {
  PrediccionTorneoService,
  PrediccionTorneo
} from '../../core/services/prediccion-torneo.service';
import { FifaToFlagPipe } from '../../shared/pipes/fifa-to-flag.pipe';
import { getFlagUrl } from '../../core/utils/flag.utils';
import { AuthService } from '../../core/services/auth.service';

interface PartidoConPrediccion {
  partido:          Fixture;
  prediccion:       PrediccionPartido | null;
  golLocalEdit:     number | null;
  golVisitanteEdit: number | null;
  guardando:        boolean;
  guardado:         boolean;
  error:            string;
}

@Component({
  selector: 'app-predicciones',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule, FifaToFlagPipe],
  templateUrl: './predicciones.component.html',
  styleUrls: ['./predicciones.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrediccionesComponent implements OnInit {

  getFlagUrl = getFlagUrl;

  // ── Estado de carga ────────────────────────────────────────────────────────
  loadingPartidos = true;
  loadingTorneo   = true;
  errorPartidos   = '';

  // ── Partidos ───────────────────────────────────────────────────────────────
  grupos: string[] = [];
  grupoActivo = '';
  grupoFiltro: string | null = null;
  partidosPorGrupo = new Map<string, PartidoConPrediccion[]>();
  otrosPartidos: PartidoConPrediccion[] = [];
  fechaActiva: 'HOY' | 'MANANA' | 'TODOS' | null = 'TODOS';
  listaFiltrada: PartidoConPrediccion[] = [];
  private _todosCache: PartidoConPrediccion[] = [];

  // ── Torneo ─────────────────────────────────────────────────────────────────
  paises: Pais[] = [];
  jugadores: Jugador[] = [];
  jugadoresFiltrados: Jugador[] = [];
  prediccionTorneo: PrediccionTorneo | null = null;
  paisCampeonId: number | null = null;
  jugadorGoleadorId: number | null = null;
  busquedaJugador = '';
  savingTorneo  = false;
  msgTorneo     = '';
  errorTorneo   = '';
  mostrarFormTorneo = false;

  constructor(
    private prediccionPartidoService: PrediccionPartidoService,
    private fixturesService:          FixturesService,
    private countriesService:         CountriesService,
    private playersService:           PlayersService,
    private prediccionTorneoService:  PrediccionTorneoService,
    private authService:              AuthService,
    private router:                   Router,
    private cd:                       ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Partidos
    forkJoin({
      partidos:     this.fixturesService.getAllFixtures(),
      predicciones: this.prediccionPartidoService.getMisPredicciones().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ partidos, predicciones }) => {
        this.construirVista(partidos, predicciones);
        this.loadingPartidos = false;
        this.aplicarFiltro();
        this.cd.markForCheck();
      },
      error: () => {
        this.errorPartidos   = 'Error al cargar los partidos';
        this.loadingPartidos = false;
        this.cd.markForCheck();
      }
    });

    // Torneo
    forkJoin({
      paises:    this.countriesService.getPaises(),
      jugadores: this.playersService.getJugadores(),
      prediccion: this.prediccionTorneoService.getMiPrediccion().pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ paises, jugadores, prediccion }) => {
        this.paises = paises
          .filter(p => p.activo)
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        this.jugadores = jugadores.sort((a, b) => a.apellido.localeCompare(b.apellido));
        this.jugadoresFiltrados = this.jugadores;

        if (prediccion) {
          this.prediccionTorneo  = prediccion;
          this.paisCampeonId     = prediccion.paisCampeonId;
          this.jugadorGoleadorId = prediccion.jugadorGoleadorId;
          this.mostrarFormTorneo = false;
        } else {
          this.mostrarFormTorneo = true;
        }
        this.loadingTorneo = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.loadingTorneo = false;
        this.cd.markForCheck();
      }
    });
  }

  // ── Construir vista de partidos ────────────────────────────────────────────
  private construirVista(partidos: Fixture[], predicciones: PrediccionPartido[]): void {
    const predMap  = new Map(predicciones.map(p => [p.partidoId, p]));
    const gruposMap = new Map<string, PartidoConPrediccion[]>();

    for (const p of partidos) {
      const item: PartidoConPrediccion = {
        partido:          p,
        prediccion:       predMap.get(p.id) ?? null,
        golLocalEdit:     predMap.get(p.id)?.golLocalPred     ?? null,
        golVisitanteEdit: predMap.get(p.id)?.golVisitantePred ?? null,
        guardando:        false,
        guardado:         false,
        error:            ''
      };

      if (p.faseCodigo === 'GRUPOS' && p.grupo) {
        const lista = gruposMap.get(p.grupo) ?? [];
        lista.push(item);
        gruposMap.set(p.grupo, lista);
      } else {
        this.otrosPartidos.push(item);
      }
    }

    this.grupos = [...gruposMap.keys()].sort();
    this.grupoActivo = this.grupos[0] ?? '';
    this.grupos.forEach(g => this.partidosPorGrupo.set(g, gruposMap.get(g)!));
    this._todosCache = this.getTodosPartidos();
  }

  getPartidosGrupoActivo(): PartidoConPrediccion[] {
    return this.partidosPorGrupo.get(this.grupoActivo) ?? [];
  }

  private getTodosPartidos(): PartidoConPrediccion[] {
    const arr: PartidoConPrediccion[] = [];
    for (const lista of this.partidosPorGrupo.values()) arr.push(...lista);
    arr.push(...this.otrosPartidos);
    return arr;
  }

  setFechaActiva(f: 'HOY' | 'MANANA' | 'TODOS'): void {
    this.fechaActiva = f;
    this.grupoFiltro = null;
    this.aplicarFiltro();
  }

  toggleGrupoFiltro(g: string): void {
    if (this.grupoFiltro === g) {
      this.grupoFiltro = null;
      this.fechaActiva = 'TODOS';
    } else {
      this.grupoFiltro = g;
      this.fechaActiva = null;
    }
    this.aplicarFiltro();
  }

  private aplicarFiltro(): void {
    if (this.grupoFiltro) {
      this.listaFiltrada = this._todosCache.filter(item => item.partido.grupo === this.grupoFiltro);
    } else if (!this.fechaActiva || this.fechaActiva === 'TODOS') {
      this.listaFiltrada = this._todosCache;
    } else {
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const target = this.fechaActiva === 'HOY' ? hoy.getTime() : hoy.getTime() + 86_400_000;
      this.listaFiltrada = this._todosCache.filter(item => {
        const d = new Date(item.partido.fechaHora); d.setHours(0, 0, 0, 0);
        return d.getTime() === target;
      });
    }
    this.cd.markForCheck();
  }

  // ── Guardar predicción de partido ──────────────────────────────────────────
  isBloqueado(item: PartidoConPrediccion): boolean {
    if (item.prediccion?.bloqueada) return true;
    return new Date(item.partido.fechaHora) <= new Date();
  }

  cambiarGol(item: PartidoConPrediccion, equipo: 'local' | 'visitante', delta: number): void {
    if (equipo === 'local') {
      item.golLocalEdit = Math.max(0, Math.min(20, (item.golLocalEdit ?? 0) + delta));
    } else {
      item.golVisitanteEdit = Math.max(0, Math.min(20, (item.golVisitanteEdit ?? 0) + delta));
    }
    this.cd.markForCheck();
  }

  guardarPartido(item: PartidoConPrediccion): void {
    if (item.golLocalEdit === null || item.golVisitanteEdit === null) return;
    if (item.guardando || this.isBloqueado(item)) return;

    // Si el token fue borrado (ej: un 401 previo lo limpió), redirigir al login
    if (!this.authService.getToken()) {
      this.router.navigate(['/register']);
      return;
    }

    item.guardando = true;
    item.error     = '';

    this.prediccionPartidoService.guardar(item.partido.id, {
      golLocal:     item.golLocalEdit,
      golVisitante: item.golVisitanteEdit
    }).subscribe({
      next: pred => {
        item.prediccion       = pred;
        item.golLocalEdit     = pred.golLocalPred;
        item.golVisitanteEdit = pred.golVisitantePred;
        item.guardando        = false;
        item.guardado         = true;
        this.cd.markForCheck();
        setTimeout(() => { item.guardado = false; this.cd.markForCheck(); }, 2500);
      },
      error: (err) => {
        item.guardando = false;
        item.error     = err?.error?.error || 'Error al guardar';
        this.cd.markForCheck();
      }
    });
  }

  isModificado(item: PartidoConPrediccion): boolean {
    return item.golLocalEdit !== (item.prediccion?.golLocalPred     ?? null)
        || item.golVisitanteEdit !== (item.prediccion?.golVisitantePred ?? null);
  }

  getPuntajeClass(pts: number | null): string {
    if (pts === null) return '';
    if (pts >= 50)   return 'pts-exacto';
    if (pts > 0)     return 'pts-correcto';
    return 'pts-incorrecto';
  }

  getPuntajeLabel(pts: number | null): string {
    if (pts === null) return '';
    if (pts >= 50)   return '🎯 +' + pts + ' Exacto';
    if (pts >= 30)   return '✓ +' + pts + ' Diferencia';
    if (pts >= 25)   return '✓ +' + pts + ' Resultado';
    if (pts > 0)     return '✓ +' + pts + ' pts';
    return '✗ 0 pts';
  }

  get totalPredichos(): number {
    let n = 0;
    this.partidosPorGrupo.forEach(lista => lista.forEach(i => { if (i.prediccion) n++; }));
    return n + this.otrosPartidos.filter(i => i.prediccion).length;
  }

  get totalPartidos(): number {
    let n = 0;
    this.partidosPorGrupo.forEach(lista => (n += lista.length));
    return n + this.otrosPartidos.length;
  }

  // ── Torneo ─────────────────────────────────────────────────────────────────
  filtrarJugadores(): void {
    const term = normalize(this.busquedaJugador.trim());
    if (!term) {
      this.jugadoresFiltrados = this.jugadores;
      return;
    }
    this.jugadoresFiltrados = this.jugadores.filter(j =>
      normalize(j.nombreCompleto).includes(term) ||
      normalize(j.pais.nombre).includes(term)    ||
      normalize(j.pais.codigo).includes(term)
    );
  }

  get paisSeleccionado(): Pais | null {
    return this.paises.find(p => p.internalId === this.paisCampeonId) || null;
  }

  get jugadorSeleccionado(): Jugador | null {
    return this.jugadores.find(j => j.internalId === this.jugadorGoleadorId) || null;
  }

  get formularioTorneoValido(): boolean {
    return this.paisCampeonId !== null && this.jugadorGoleadorId !== null;
  }

  get torneoConfirmado(): boolean {
    return this.prediccionTorneo?.confirmada === true;
  }

  guardarTorneo(): void {
    if (!this.formularioTorneoValido || this.torneoConfirmado) return;

    if (!this.authService.getToken()) {
      this.router.navigate(['/register']);
      return;
    }

    this.savingTorneo = true;
    this.msgTorneo    = '';
    this.errorTorneo  = '';

    this.prediccionTorneoService.guardar({
      paisCampeonId:     this.paisCampeonId!,
      jugadorGoleadorId: this.jugadorGoleadorId!
    }).subscribe({
      next: (result) => {
        this.prediccionTorneo  = result;
        this.savingTorneo      = false;
        this.mostrarFormTorneo = false;
        this.msgTorneo         = '¡Predicción del torneo guardada!';
        this.cd.markForCheck();
        setTimeout(() => { this.msgTorneo = ''; this.cd.markForCheck(); }, 4000);
      },
      error: (err) => {
        this.savingTorneo = false;
        this.errorTorneo  = err.error?.message || err.error?.error || 'Error al guardar';
        this.cd.markForCheck();
        setTimeout(() => { this.errorTorneo = ''; this.cd.markForCheck(); }, 5000);
      }
    });
  }
}
