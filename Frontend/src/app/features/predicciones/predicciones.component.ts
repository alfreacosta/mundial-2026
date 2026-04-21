import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, ActivatedRoute } from '@angular/router';
import { forkJoin, of, Subject, Subscription } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';

import {
  PrediccionPartidoService,
  PrediccionPartido
} from '../../core/services/prediccion-partido.service';
import { FixturesService, Fixture } from '../../core/services/fixtures.service';
import { CountriesService, Pais } from '../../core/services/countries.service';
import { PlayersService, JugadorBusqueda } from '../../core/services/players.service';
import {
  PrediccionTorneoService,
  PrediccionTorneo
} from '../../core/services/prediccion-torneo.service';
import { FifaToFlagPipe } from '../../shared/pipes/fifa-to-flag.pipe';
import { getFlagUrl } from '../../core/utils/flag.utils';
import { toLocalIso } from '../../core/utils/date.utils';
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
export class PrediccionesComponent implements OnInit, OnDestroy {

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

  exportandoPredicciones = false;

  // ── Torneo ─────────────────────────────────────────────────────────────────
  paises: Pais[] = [];
  jugadoresFiltrados: JugadorBusqueda[] = [];
  prediccionTorneo: PrediccionTorneo | null = null;
  paisCampeonId: number | null = null;
  jugadorGoleadorId: number | null = null;
  busquedaJugador = '';
  buscandoJugadores = false;
  jugadorSeleccionadoCache: JugadorBusqueda | null = null;
  savingTorneo  = false;
  msgTorneo     = '';
  errorTorneo   = '';
  mostrarFormTorneo = false;

  private searchSubject = new Subject<string>();
  private searchSub!: Subscription;

  constructor(
    private prediccionPartidoService: PrediccionPartidoService,
    private fixturesService:          FixturesService,
    private countriesService:         CountriesService,
    private playersService:           PlayersService,
    private prediccionTorneoService:  PrediccionTorneoService,
    private authService:              AuthService,
    private router:                   Router,
    private route:                    ActivatedRoute,
    private cd:                       ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Debounce para búsqueda de jugadores
    this.searchSub = this.searchSubject.pipe(
      debounceTime(800),
      distinctUntilChanged(),
      tap(() => { this.buscandoJugadores = true; this.cd.markForCheck(); }),
      switchMap(term => this.playersService.buscarJugadores(term))
    ).subscribe({
      next: (jugadores) => {
        this.jugadoresFiltrados = jugadores;
        this.buscandoJugadores = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.jugadoresFiltrados = [];
        this.buscandoJugadores = false;
        this.cd.markForCheck();
      }
    });

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
      prediccion: this.prediccionTorneoService.getMiPrediccion().pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ paises, prediccion }) => {
        this.paises = paises
          .filter(p => p.activo)
          .sort((a, b) => a.nombre.localeCompare(b.nombre));

        if (prediccion) {
          this.prediccionTorneo  = prediccion;
          this.paisCampeonId     = prediccion.paisCampeonId;
          this.jugadorGoleadorId = prediccion.jugadorGoleadorId;
          if (prediccion.jugadorGoleadorId) {
            this.jugadorSeleccionadoCache = {
              internalId: prediccion.jugadorGoleadorId,
              nombre: '', apellido: '',
              nombreCompleto: prediccion.jugadorGoleadorNombre || '',
              posicionCodigo: '',
              paisNombre: '',
              paisCodigo: prediccion.jugadorGoleadorPaisCodigo || '',
              clubNombre: null,
              urlFoto: prediccion.jugadorGoleadorUrlFoto
            };
          }
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

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  // ── Construir vista de partidos ────────────────────────────────────────────
  private construirVista(partidos: Fixture[], predicciones: PrediccionPartido[]): void {
    const predMap  = new Map(predicciones.map(p => [p.partidoId, p]));
    const gruposMap = new Map<string, PartidoConPrediccion[]>();

    for (const p of partidos) {
      const pred = predMap.get(p.id) ?? null;
      const item: PartidoConPrediccion = {
        partido:          { ...p, fechaHora: toLocalIso(p.fechaHora) },
        prediccion:       pred,
        golLocalEdit:     pred?.golLocalPred     ?? 0,
        golVisitanteEdit: pred?.golVisitantePred ?? 0,
        guardando:        false,
        guardado:         !!pred,
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
    // Si viene queryParam ?grupo=X, activar ese grupo; si no, el primero
    const grupoQuery = this.route.snapshot.queryParamMap.get('grupo')?.toUpperCase();
    this.grupoActivo = (grupoQuery && this.grupos.includes(grupoQuery)) ? grupoQuery : (this.grupos[0] ?? '');
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
    item.guardado = false;
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
  onBusquedaJugadorChange(): void {
    const term = this.busquedaJugador.trim();
    if (term.length < 3) {
      this.jugadoresFiltrados = [];
      this.cd.markForCheck();
      return;
    }
    this.searchSubject.next(term);
  }

  seleccionarJugador(j: JugadorBusqueda): void {
    this.jugadorGoleadorId = j.internalId;
    this.jugadorSeleccionadoCache = j;
    this.cd.markForCheck();
  }

  limpiarJugador(): void {
    this.jugadorGoleadorId = null;
    this.jugadorSeleccionadoCache = null;
    this.busquedaJugador = '';
    this.jugadoresFiltrados = [];
    this.cd.markForCheck();
  }

  limpiarCampeon(): void {
    this.paisCampeonId = null;
    this.cd.markForCheck();
  }

  get paisSeleccionado(): Pais | null {
    return this.paises.find(p => p.internalId === this.paisCampeonId) || null;
  }

  get torneoConfirmado(): boolean {
    return this.prediccionTorneo?.confirmada === true;
  }

  guardarTorneo(): void {
    if (this.torneoConfirmado) return;

    if (!this.authService.getToken()) {
      this.router.navigate(['/register']);
      return;
    }

    this.savingTorneo = true;
    this.msgTorneo    = '';
    this.errorTorneo  = '';

    this.prediccionTorneoService.guardar({
      paisCampeonId:     this.paisCampeonId,
      jugadorGoleadorId: this.jugadorGoleadorId
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

  // ── Compartir predicciones como imagen ─────────────────────────────────────
  async compartirPredicciones(): Promise<void> {
    const partidos = this.listaFiltrada.filter(i => i.prediccion !== null);
    if (partidos.length === 0) return;

    this.exportandoPredicciones = true;
    this.cd.markForCheck();

    try {
      const usuario = this.authService.getCurrentUser()?.user ?? 'dt26';
      const DPR = 2;
      const W   = 480 * DPR;
      const PAD = 16  * DPR;

      // Alturas
      const HEADER_H  = 72 * DPR;
      const TORNEO_H  = this.prediccionTorneo ? 52 * DPR : 0;
      const ROW_H     = 44 * DPR;
      const GAP       = 4  * DPR;
      const FOOTER_H  = 48 * DPR;
      const TOTAL_H   = HEADER_H + TORNEO_H + (partidos.length * (ROW_H + GAP)) + FOOTER_H + PAD * 2;

      const cvs = document.createElement('canvas');
      cvs.width  = W;
      cvs.height = TOTAL_H;
      const ctx  = cvs.getContext('2d')!;

      // ── Fondo degradado ───────────────────────────────────────────
      const bg = ctx.createLinearGradient(0, 0, 0, TOTAL_H);
      bg.addColorStop(0,    '#0a1628');
      bg.addColorStop(0.5,  '#0d1f3c');
      bg.addColorStop(1,    '#060e1a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, TOTAL_H);

      // ── Watermark logo centrado ───────────────────────────────────
      await this.loadLogoWatermark(ctx, W, TOTAL_H);

      // ── Cargar banderas de los partidos ───────────────────────────
      const flagCache = new Map<string, HTMLImageElement | null>();
      const flagCodes = new Set<string>();
      for (const item of partidos) {
        flagCodes.add(item.partido.equipoLocalCodigo);
        flagCodes.add(item.partido.equipoVisitanteCodigo);
      }
      await Promise.all([...flagCodes].map(code => new Promise<void>(res => {
        const url = getFlagUrl(code, 'w40');
        if (!url) { flagCache.set(code, null); res(); return; }
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.onload  = () => { flagCache.set(code, img); res(); };
        img.onerror = () => { flagCache.set(code, null); res(); };
        img.src = url;
      })));

      // ── HEADER ────────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(0,212,255,0.06)';
      this.roundRect(ctx, 0, 0, W, HEADER_H, 0);
      ctx.fill();

      // Línea inferior del header
      ctx.fillStyle = 'rgba(0,212,255,0.25)';
      ctx.fillRect(0, HEADER_H - 1.5 * DPR, W, 1.5 * DPR);

      // Logo pequeño (arriba izquierda)
      await new Promise<void>(res => {
        const logoImg = new Image(); logoImg.crossOrigin = 'anonymous';
        logoImg.onload = () => {
          const logoH = 40 * DPR;
          const logoW = logoH;
          ctx.drawImage(logoImg, PAD, (HEADER_H - logoH) / 2, logoW, logoH);
          res();
        };
        logoImg.onerror = () => res();
        logoImg.src = '/images/logodt26.png';
      });

      // Título
      const logoOffset = 52 * DPR;
      ctx.font = `800 ${15 * DPR}px Arial`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('Mis Predicciones — Mundial 2026', PAD + logoOffset, HEADER_H * 0.38);

      // Filtro activo
      let filtroLabel = 'Todos los partidos';
      if (this.grupoFiltro) filtroLabel = `Grupo ${this.grupoFiltro}`;
      else if (this.fechaActiva === 'HOY')    filtroLabel = 'Partidos de hoy';
      else if (this.fechaActiva === 'MANANA') filtroLabel = 'Partidos de mañana';
      ctx.font = `${12 * DPR}px Arial`;
      ctx.fillStyle = 'rgba(0,212,255,0.85)';
      ctx.fillText(filtroLabel, PAD + logoOffset, HEADER_H * 0.65);

      // Usuario (derecha)
      ctx.font = `700 ${12 * DPR}px Arial`;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textAlign = 'right';
      ctx.fillText(`@${usuario}`, W - PAD, HEADER_H * 0.38);

      // Predicciones: X predichas
      ctx.font = `${11 * DPR}px Arial`;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText(`${partidos.length} predicción${partidos.length !== 1 ? 'es' : ''}`, W - PAD, HEADER_H * 0.65);

      // ── TORNEO BANNER (si existe) ─────────────────────────────────
      let y = HEADER_H;
      if (this.prediccionTorneo) {
        ctx.fillStyle = 'rgba(251,191,36,0.07)';
        ctx.fillRect(0, y, W, TORNEO_H);
        ctx.fillStyle = 'rgba(251,191,36,0.2)';
        ctx.fillRect(0, y + TORNEO_H - 1 * DPR, W, 1 * DPR);

        const midT = y + TORNEO_H / 2;
        ctx.font = `${11 * DPR}px Arial`;
        ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // Campeón
        const campNombre = this.prediccionTorneo.paisCampeonNombre || '—';
        const flagC = flagCache.get(this.prediccionTorneo.paisCampeonCodigo ?? '') ?? null;
        if (flagC) {
          const fh = 18 * DPR;
          ctx.drawImage(flagC, PAD, midT - fh / 2, fh * 1.4, fh);
          ctx.fillText(`🏆 Campeón: ${campNombre}`, PAD + 24 * DPR, midT);
        } else {
          ctx.fillText(`🏆 Campeón: ${campNombre}`, PAD, midT);
        }

        // Goleador
        const goleador = this.prediccionTorneo.jugadorGoleadorNombre || '—';
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(251,191,36,0.75)';
        ctx.fillText(`⚽ ${goleador}`, W - PAD, midT);

        y += TORNEO_H;
      }

      // ── PARTIDOS ──────────────────────────────────────────────────
      y += PAD;

      const drawRoundRect = (x: number, ry: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, ry);
        ctx.lineTo(x + w - r, ry); ctx.arcTo(x + w, ry, x + w, ry + r, r);
        ctx.lineTo(x + w, ry + h - r); ctx.arcTo(x + w, ry + h, x + w - r, ry + h, r);
        ctx.lineTo(x + r, ry + h); ctx.arcTo(x, ry + h, x, ry + h - r, r);
        ctx.lineTo(x, ry + r); ctx.arcTo(x, ry, x + r, ry, r);
        ctx.closePath();
      };

      for (const item of partidos) {
        const pred = item.prediccion!;
        const pts  = pred.puntajeObtenido;

        // Color de fila según resultado
        let rowBg: string;
        if (pts === null || pts === undefined) rowBg = 'rgba(255,255,255,0.04)';
        else if (pts >= 50)  rowBg = 'rgba(34,197,94,0.12)';
        else if (pts > 0)    rowBg = 'rgba(251,191,36,0.10)';
        else                 rowBg = 'rgba(239,68,68,0.08)';

        drawRoundRect(PAD, y, W - PAD * 2, ROW_H, 6 * DPR);
        ctx.fillStyle = rowBg;
        ctx.fill();

        const midY = y + ROW_H / 2;

        // Grupo tag (izquierda pequeño)
        if (item.partido.grupo) {
          ctx.font = `600 ${9 * DPR}px Arial`;
          ctx.fillStyle = 'rgba(0,212,255,0.6)';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`G ${item.partido.grupo}`, PAD + 6 * DPR, midY - 8 * DPR);
        }

        // Flags y nombres
        const FLAG_W  = 22 * DPR;
        const FLAG_H  = 15 * DPR;
        const FLAG_PAD = 4 * DPR;
        const NAME_FONT = `${11 * DPR}px Arial`;
        const SCORE_FONT = `700 ${14 * DPR}px Arial`;

        const centerX = W / 2;
        const scoreW  = 52 * DPR; // espacio para "2 – 1"

        // Local (izquierda → centro)
        const localFlag = flagCache.get(item.partido.equipoLocalCodigo) ?? null;
        const localX = PAD + 6 * DPR;
        if (localFlag) {
          ctx.drawImage(localFlag, localX, midY - FLAG_H / 2, FLAG_W, FLAG_H);
        }
        ctx.font = NAME_FONT;
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const localNombre = this.truncate(item.partido.equipoLocalNombre, 12);
        ctx.fillText(localNombre, localX + FLAG_W + FLAG_PAD, midY);

        // Visitante (derecha ← centro)
        const visFlag  = flagCache.get(item.partido.equipoVisitanteCodigo) ?? null;
        const visNombre = this.truncate(item.partido.equipoVisitanteNombre, 12);
        ctx.font = NAME_FONT;
        ctx.textAlign = 'right';
        const visNombreX = W - PAD - 6 * DPR - FLAG_W - FLAG_PAD;
        ctx.fillText(visNombre, visNombreX, midY);
        if (visFlag) {
          ctx.drawImage(visFlag, W - PAD - 6 * DPR - FLAG_W, midY - FLAG_H / 2, FLAG_W, FLAG_H);
        }

        // Marcador predicho (centro)
        const scoreStr = `${pred.golLocalPred} – ${pred.golVisitantePred}`;
        ctx.font = SCORE_FONT;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(scoreStr, centerX, midY - 2 * DPR);

        // Resultado real si existe
        if (item.partido.golLocal !== null && item.partido.golLocal !== undefined) {
          ctx.font = `${9 * DPR}px Arial`;
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillText(`Real: ${item.partido.golLocal}–${item.partido.golVisitante}`, centerX, midY + 10 * DPR);
        }

        // Badge puntos (derecha, si tiene)
        if (pts !== null && pts !== undefined) {
          let ptColor = pts >= 50 ? '#22c55e' : pts > 0 ? '#fbbf24' : '#ef4444';
          let ptLabel = pts >= 50 ? `🎯 ${pts}` : pts > 0 ? `✓ ${pts}` : '✗ 0';
          ctx.font = `700 ${10 * DPR}px Arial`;
          ctx.fillStyle = ptColor;
          ctx.textAlign = 'right';
          ctx.fillText(ptLabel, W - PAD - 6 * DPR, midY - 8 * DPR);
        }

        y += ROW_H + GAP;
      }

      // ── FOOTER ────────────────────────────────────────────────────
      y = TOTAL_H - FOOTER_H;
      ctx.fillStyle = 'rgba(0,212,255,0.06)';
      ctx.fillRect(0, y, W, FOOTER_H);
      ctx.fillStyle = 'rgba(0,212,255,0.25)';
      ctx.fillRect(0, y, W, 1.5 * DPR);

      ctx.font = `700 ${13 * DPR}px Arial`;
      ctx.fillStyle = '#00d4ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Hacé las tuyas en 👉 dt26.win/predicciones', W / 2, y + FOOTER_H / 2);

      // ── Compartir ─────────────────────────────────────────────────
      cvs.toBlob(async blob => {
        if (!blob) return;
        const filtro   = this.grupoFiltro ? `Grupo-${this.grupoFiltro}` : 'Todos';
        const filename = `Predicciones-${filtro}-${usuario}.png`;
        const file     = new File([blob], filename, { type: 'image/png' });
        const shareText = `Estas son mis predicciones del Mundial 2026! "${usuario}"\nHacé las tuyas en https://dt26.win/predicciones\nEs gratis y seguro.`;

        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: 'Mis Predicciones — DT26', text: shareText });
          } catch { /* usuario canceló */ }
        } else {
          const a = document.createElement('a');
          a.download = filename;
          a.href = URL.createObjectURL(blob);
          a.click();
          URL.revokeObjectURL(a.href);
        }
        this.exportandoPredicciones = false;
        this.cd.markForCheck();
      }, 'image/png');

    } catch {
      this.exportandoPredicciones = false;
      this.cd.markForCheck();
    }
  }

  private loadLogoWatermark(ctx: CanvasRenderingContext2D, W: number, H: number): Promise<void> {
    return new Promise(resolve => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => {
        const size = Math.min(W, H) * 0.5;
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.drawImage(img, (W - size) / 2, (H - size) / 2, size, size);
        ctx.restore();
        resolve();
      };
      img.onerror = () => resolve();
      img.src = '/images/logodt26.png';
    });
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  private truncate(text: string, maxLen: number): string {
    return text.length > maxLen ? text.substring(0, maxLen - 1) + '…' : text;
  }
}
