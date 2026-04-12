import { Component, OnInit, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { CdkDrag, CdkDragEnd } from '@angular/cdk/drag-drop';
import { forkJoin } from 'rxjs';
import { CountriesService, Pais, JugadorPais } from '../../core/services/countries.service';
import { GrupoService } from '../../core/services/grupo.service';
import { AuthService } from '../../core/services/auth.service';
import { normalize } from '../../shared/utils/normalize';
import { environment } from '../../../environments/environment';
import html2canvas from 'html2canvas';

export interface PlayerStats {
  altura: string;
  peso: string;
  nacimiento: string;
  lugar_nacimiento: string;
  nacionalidad: string;
  club: string;
  club_logo: string;
  liga: string;
  temporada: string;
  partidos: number;
  minutos: number;
  rating: string;
  goles: number;
  asistencias: number;
  disparos: number;
  disparos_arco: number;
  pases_clave: number;
  regates_ok: number;
  regates_int: number;
  amarillas: number;
  rojas: number;
}

export interface JugadorSeleccionable extends JugadorPais {
  seleccionado: boolean;
  noVa: boolean;
  titular: boolean;
}

interface PosicionGroup {
  codigo: string;
  label: string;
  icon: string;
  color: string;
  recommended: number;
}

@Component({
  selector: 'app-convocados',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatBadgeModule,
    RouterLink,
    CdkDrag
  ],
  templateUrl: './convocados.component.html',
  styleUrls: ['./convocados.component.scss']
})
export class ConvocadosComponent implements OnInit {
  paisId!: number;
  pais: Pais | null = null;
  players = signal<JugadorSeleccionable[]>([]);
  loading = true;
  error = '';
  saving = false;
  savingPositions = false;
  convocatoriaEstado: string | null = null;
  noEsFavorito = false;
  searchQuery = '';
  activeTab = signal<'convocatoria' | 'titulares' | 'nova'>('convocatoria');

  /** Posiciones guardadas (porcentaje): jugadorId → {x%, y%} */
  savedPositions = new Map<number, { x: number; y: number }>();
  /** Posiciones modificadas por drag pendientes de guardar (porcentaje) */
  draggedPositions = new Map<number, { x: number; y: number }>();
  /** Cache de posiciones en píxeles para cdkDragFreeDragPosition (evita recrear objetos) */
  private _dragPxCache = new Map<number, { x: number; y: number }>();
  private static readonly ZERO_POS: { x: number; y: number } = { x: -999, y: -999 };

  /** Cache de ratings ya consultados: internalId → rating string */
  ratingCache = new Map<number, string>();

  // Computed signals — se actualizan AUTOMATICAMENTE cuando players cambia
  readonly totalSel = computed(() => this.players().filter(p => p.seleccionado).length);
  readonly totalNoVa = computed(() => this.players().filter(p => p.noVa).length);
  readonly totalTitulares = computed(() => this.players().filter(p => p.titular).length);
  readonly posCounts = computed(() => {
    const map: Record<string, number> = {};
    for (const p of this.players()) {
      if (p.seleccionado && p.posicion?.codigo) {
        const c = p.posicion.codigo;
        map[c] = (map[c] || 0) + 1;
      }
    }
    return map;
  });
  readonly titularPosCounts = computed(() => {
    const map: Record<string, number> = {};
    for (const p of this.players()) {
      if (p.titular && p.posicion?.codigo) {
        map[p.posicion.codigo] = (map[p.posicion.codigo] || 0) + 1;
      }
    }
    return map;
  });

  readonly MAX_CONVOCADOS = 26;

  readonly positionGroups: PosicionGroup[] = [
    { codigo: 'ARQ', label: 'Porteros',        icon: 'sports_handball', color: '#f59e0b', recommended: 3 },
    { codigo: 'DEF', label: 'Defensores',       icon: 'shield',          color: '#3b82f6', recommended: 8 },
    { codigo: 'MED', label: 'Mediocampistas',   icon: 'sync_alt',        color: '#10b981', recommended: 8 },
    { codigo: 'DEL', label: 'Delanteros',       icon: 'sports_soccer',   color: '#f97316', recommended: 7 },
  ];

  private readonly CONF_COLORS: Record<string, string> = {
    UEFA: '#1a56db', CONMEBOL: '#b45309', CONCACAF: '#b91c1c',
    CAF: '#065f46', AFC: '#6d28d9', OFC: '#0e7490'
  };

  // Stats panel
  selectedPlayer = signal<JugadorSeleccionable | null>(null);
  playerStats = signal<PlayerStats | null>(null);
  statsLoading = signal(false);
  statsError = signal('');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private countriesService: CountriesService,
    private grupoService: GrupoService,
    private snackBar: MatSnackBar,
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.paisId = Number(this.route.snapshot.paramMap.get('paisId'));
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'titulares' || tab === 'nova') {
      this.activeTab.set(tab);
    }
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = '';
    this.noEsFavorito = false;

    // Cargamos en paralelo: catálogo de países, jugadores del país, convocatoria existente y favoritos
    forkJoin({
      paises: this.countriesService.getPaises(),
      jugadores: this.countriesService.getJugadoresPorPais(this.paisId),
      convocatoria: this.countriesService.getMiConvocatoria(this.paisId),
      favoritos: this.grupoService.getMisFavoritos()
    }).subscribe({
      next: ({ paises, jugadores, convocatoria, favoritos }) => {
        // Verificar que el país sea favorito del usuario
        const esFav = favoritos.some(f => f.paisId === this.paisId);
        if (!esFav) {
          this.noEsFavorito = true;
          this.loading = false;
          return;
        }

        this.pais = paises.find(p => Number(p.internalId) === this.paisId) ?? null;

        // Construir set de IDs ya guardados para marcar como seleccionados
        // NOTA: GraphQL serializa el tipo ID como string, por eso se compara con String()
        const savedIds = new Set<string>(
          (convocatoria?.jugadoresIds ?? []).map(id => String(id))
        );
        const noVaIdsSet = new Set<string>(
          (convocatoria?.noVaIds ?? []).map(id => String(id))
        );
        const titularIdsSet = new Set<string>(
          (convocatoria?.titularesIds ?? []).map(id => String(id))
        );
        this.convocatoriaEstado = convocatoria?.estado ?? null;

        console.log('📊 Datos cargados:', { paisId: this.paisId, paisName: this.pais?.nombre, totalJugadores: jugadores.length, savedIds: Array.from(savedIds), noVaIds: Array.from(noVaIdsSet), titularIds: Array.from(titularIdsSet), convocatoria });

        this.players.set(jugadores.map(j => ({
          ...j,
          seleccionado: savedIds.has(String(j.internalId)) || titularIdsSet.has(String(j.internalId)),
          noVa: noVaIdsSet.has(String(j.internalId)),
          titular: titularIdsSet.has(String(j.internalId))
        })));

        // Cargar posiciones guardadas de titulares
        this.savedPositions.clear();
        this.draggedPositions.clear();
        this._dragPxCache.clear();
        for (const pos of (convocatoria?.posicionesTitulares ?? [])) {
          this.savedPositions.set(Number(pos.jugadorId), { x: pos.x, y: pos.y });
        }

        this.loading = false;
      },
      error: () => {
        this.error = 'Error cargando los datos. Por favor, intentá de nuevo.';
        this.loading = false;
      }
    });
  }

  get jugadoresSeleccionados(): JugadorSeleccionable[] {
    return this.players().filter(p => p.seleccionado);
  }

  get jugadoresNoVa(): JugadorSeleccionable[] {
    return this.players().filter(p => p.noVa);
  }

  get jugadoresTitulares(): JugadorSeleccionable[] {
    return this.players().filter(p => p.titular);
  }

  readonly MAX_TITULARES = 11;
  readonly MAX_TITULARES_ARQ = 1;

  get canAddMore(): boolean {
    return this.totalSel() < this.MAX_CONVOCADOS;
  }

  /** true si hay al menos 1 convocado a eliminatorias en el plantel */
  get hasConvocados(): boolean {
    return this.players().some(j => j.convocadoEliminatoria);
  }

  getByPosition(codigo: string): JugadorSeleccionable[] {
    const q = normalize(this.searchQuery.trim());
    const onlyConv = !q && this.hasConvocados;
    return this.players().filter(j => {
      if (j.posicion?.codigo !== codigo || j.noVa) return false;
      // Siempre mostrar seleccionados por el usuario
      if (j.seleccionado) return true;
      // Sin búsqueda y hay convocados: solo mostrar convocados
      if (onlyConv && !j.convocadoEliminatoria) return false;
      if (!q) return true;
      const nombre = normalize(j.nombreCompleto || `${j.nombre} ${j.apellido}`);
      const club = normalize(j.club?.nombre || '');
      return nombre.includes(q) || club.includes(q);
    }).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }

  get filteredCount(): number {
    const q = normalize(this.searchQuery.trim());
    const onlyConv = !q && this.hasConvocados;
    return this.players().filter(j => {
      if (j.noVa) return false;
      if (j.seleccionado) return true;
      if (onlyConv && !j.convocadoEliminatoria) return false;
      if (!q) return true;
      const nombre = normalize(j.nombreCompleto || `${j.nombre} ${j.apellido}`);
      const club = normalize(j.club?.nombre || '');
      return nombre.includes(q) || club.includes(q);
    }).length;
  }

  getPosColor(codigo?: string): string {
    const pg = this.positionGroups.find(g => g.codigo === codigo);
    return pg?.color ?? '#94a3b8';
  }

  /** Convocados de una posición (candidatos para titular) */
  getTitularCandidates(codigo: string): JugadorSeleccionable[] {
    return this.players().filter(p => p.seleccionado && p.posicion?.codigo === codigo);
  }

  /** Titulares de una posición (para la cancha) */
  getTitularesByPos(codigo: string): JugadorSeleccionable[] {
    return this.players().filter(p => p.titular && p.posicion?.codigo === codigo);
  }

  togglePlayer(player: JugadorSeleccionable): void {
    if (!player.seleccionado && !this.canAddMore) {
      this.snackBar.open(`Límite alcanzado: máximo ${this.MAX_CONVOCADOS} convocados`, '', {
        duration: 2500,
        panelClass: 'snack-warn'
      });
      return;
    }
    const wasSelected = player.seleccionado;
    this.players.update(curr =>
      curr.map(p => p.internalId === player.internalId
        ? { ...p, seleccionado: !wasSelected, titular: wasSelected ? false : p.titular }
        : p)
    );
  }

  markNoVa(player: JugadorSeleccionable, event: Event): void {
    event.stopPropagation();
    this.players.update(curr =>
      curr.map(p => p.internalId === player.internalId ? { ...p, seleccionado: false, noVa: true, titular: false } : p)
    );
  }

  undoNoVa(player: JugadorSeleccionable): void {
    this.players.update(curr =>
      curr.map(p => p.internalId === player.internalId ? { ...p, noVa: false } : p)
    );
  }

  getNoVaByPosition(codigo: string): JugadorSeleccionable[] {
    return this.players().filter(j => j.noVa && j.posicion?.codigo === codigo)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }

  toggleTitular(player: JugadorSeleccionable): void {
    if (player.titular) {
      // Quitar de titulares
      this.players.update(curr =>
        curr.map(p => p.internalId === player.internalId ? { ...p, titular: false } : p)
      );
      return;
    }
    // Validar máximo 11
    if (this.totalTitulares() >= this.MAX_TITULARES) {
      this.snackBar.open(`Máximo ${this.MAX_TITULARES} titulares (1 arquero + 10 jugadores)`, '', {
        duration: 2500, panelClass: 'snack-warn'
      });
      return;
    }
    // Validar máximo 1 ARQ
    if (player.posicion?.codigo === 'ARQ' && (this.titularPosCounts()['ARQ'] || 0) >= this.MAX_TITULARES_ARQ) {
      this.snackBar.open('Solo podés tener 1 arquero titular', '', {
        duration: 2500, panelClass: 'snack-warn'
      });
      return;
    }
    this.players.update(curr =>
      curr.map(p => p.internalId === player.internalId ? { ...p, titular: true } : p)
    );
  }

  convocarPlayer(player: JugadorSeleccionable, event: Event): void {
    event.stopPropagation();
    if (!player.seleccionado && !this.canAddMore) {
      this.snackBar.open(`Límite alcanzado: máximo ${this.MAX_CONVOCADOS} convocados`, '', {
        duration: 2500,
        panelClass: 'snack-warn'
      });
      return;
    }
    const wasSelected = player.seleccionado;
    this.players.update(curr =>
      curr.map(p => p.internalId === player.internalId
        ? { ...p, seleccionado: !wasSelected, titular: wasSelected ? false : p.titular }
        : p)
    );
  }

  selectAll(codigo: string): void {
    const current = this.players();
    const group = current.filter(p => p.posicion?.codigo === codigo);
    const allSelected = group.every(p => p.seleccionado);
    let count = current.filter(p => p.seleccionado).length;
    this.players.set(current.map(p => {
      if (p.posicion?.codigo !== codigo) return p;
      if (allSelected) {
        if (p.seleccionado) { count--; return { ...p, seleccionado: false }; }
      } else if (!p.seleccionado && count < this.MAX_CONVOCADOS) {
        count++; return { ...p, seleccionado: true };
      }
      return p;
    }));
  }

  clearAll(): void {
    this.players.update(curr => curr.map(p => ({ ...p, seleccionado: false, noVa: false, titular: false })));
  }

  clearPositions(): void {
    this.draggedPositions.clear();
    this.savedPositions.clear();
    this._dragPxCache.clear();
    // Forzar re-render de las posiciones
    this.players.update(curr => [...curr]);
  }

  get confColor(): string {
    return this.CONF_COLORS[this.pais?.confederacion?.codigo ?? ''] ?? '#7c3aed';
  }

  private readonly FIFA_TO_ISO: Record<string, string> = {
    'ARG': 'AR', 'BRA': 'BR', 'URU': 'UY', 'COL': 'CO',
    'CHI': 'CL', 'PAR': 'PY', 'ECU': 'EC', 'BOL': 'BO',
    'PER': 'PE', 'VEN': 'VE',
    'GER': 'DE', 'ENG': 'GB', 'FRA': 'FR', 'ESP': 'ES',
    'ITA': 'IT', 'POR': 'PT', 'NED': 'NL', 'BEL': 'BE',
    'SUI': 'CH', 'AUT': 'AT', 'CRO': 'HR', 'SVN': 'SI',
    'DEN': 'DK', 'SWE': 'SE', 'NOR': 'NO', 'FIN': 'FI',
    'ISL': 'IS', 'IRL': 'IE', 'SCO': 'GB', 'WAL': 'GB',
    'TUR': 'TR', 'POL': 'PL', 'ROU': 'RO', 'HUN': 'HU',
    'GRE': 'GR', 'SRB': 'RS', 'CZE': 'CZ', 'SVK': 'SK',
    'UKR': 'UA', 'ALB': 'AL', 'MKD': 'MK', 'MNE': 'ME',
    'BIH': 'BA', 'RUS': 'RU', 'GEO': 'GE',
    'USA': 'US', 'MEX': 'MX', 'CAN': 'CA', 'CRC': 'CR',
    'HON': 'HN', 'PAN': 'PA', 'SLV': 'SV', 'TRI': 'TT',
    'JAM': 'JM', 'HAI': 'HT', 'GUA': 'GT', 'CUB': 'CU',
    'MAR': 'MA', 'SEN': 'SN', 'NGA': 'NG', 'GHA': 'GH',
    'CMR': 'CM', 'CIV': 'CI', 'EGY': 'EG', 'TUN': 'TN',
    'ALG': 'DZ', 'RSA': 'ZA', 'ZAF': 'ZA', 'KEN': 'KE',
    'JPN': 'JP', 'KOR': 'KR', 'IRN': 'IR', 'SAU': 'SA',
    'AUS': 'AU', 'QAT': 'QA', 'UAE': 'AE', 'IRQ': 'IQ',
    'JOR': 'JO', 'UZB': 'UZ', 'CHN': 'CN', 'IND': 'IN',
    'NZL': 'NZ', 'FIJ': 'FJ',
  };

  getFlagEmoji(codigo: string): string {
    if (!codigo) return '🏳️';
    const upper = codigo.toUpperCase();
    const iso = upper.length === 3
      ? (this.FIFA_TO_ISO[upper] ?? upper.substring(0, 2))
      : upper;
    if (iso.length !== 2) return '🏳️';
    try {
      const pts = iso.split('').map(c => 0x1F1E6 - 65 + c.charCodeAt(0));
      return String.fromCodePoint(...pts);
    } catch { return '🏳️'; }
  }

  getLogoUrl(): string | null {
    if (!this.pais?.apiTeamId) return null;
    return CountriesService.proxyUrl(`https://media.api-sports.io/football/teams/${this.pais.apiTeamId}.png`);
  }

  guardarConvocatoria(): void {
    const seleccionados = this.players().filter(p => p.seleccionado);
    const noVa = this.players().filter(p => p.noVa);
    const titulares = this.players().filter(p => p.titular);
    if (seleccionados.length === 0 && noVa.length === 0 && titulares.length === 0) {
      this.snackBar.open('Seleccioná al menos un jugador o marcá alguno como "No Va" antes de guardar.', '', { duration: 3000 });
      return;
    }

    this.saving = true;
    const jugadorIds = seleccionados.map(p => Number(p.internalId));
    const noVaIds = noVa.map(p => Number(p.internalId));
    const titularesIds = titulares.map(p => Number(p.internalId));

    this.countriesService.guardarConvocatoria(this.paisId, jugadorIds, noVaIds, titularesIds).subscribe({
      next: (resp) => {
        this.convocatoriaEstado = resp.estado;
        const tab = this.activeTab();

        // Si estamos en titulares y hay posiciones arrastradas, guardarlas también
        if (tab === 'titulares' && this.savedPositions.size > 0) {
          const posiciones = Array.from(this.savedPositions.entries()).map(([jugadorId, pos]) => ({
            jugadorId, x: Math.round(pos.x * 100) / 100, y: Math.round(pos.y * 100) / 100
          }));
          this.countriesService.guardarPosicionesTitulares(this.paisId, posiciones).subscribe({
            next: () => {
              this.saving = false;
              this.draggedPositions.clear();
              this.snackBar.open(`✅ Titulares y posiciones guardados: ${titulares.length} jugadores`, 'Cerrar',
                { duration: 5000, panelClass: 'snack-success' });
            },
            error: () => {
              this.saving = false;
              this.snackBar.open('Convocatoria guardada, pero hubo un error al guardar posiciones.', 'Cerrar',
                { duration: 5000, panelClass: 'snack-error' });
            }
          });
        } else {
          this.saving = false;
          const msg = tab === 'titulares'
            ? `✅ Titulares guardados: ${titulares.length} jugadores`
            : tab === 'nova'
              ? `✅ Convocatoria guardada (${noVa.length} descartados)`
              : `✅ Convocatoria guardada: ${resp.totalJugadores} jugadores`;
          this.snackBar.open(msg, 'Cerrar',
            { duration: 5000, panelClass: 'snack-success' }
          );
        }
      },
      error: () => {
        this.saving = false;
        this.snackBar.open('Error al guardar la convocatoria. Intentá de nuevo.', 'Cerrar', {
          duration: 5000,
          panelClass: 'snack-error'
        });
      }
    });
  }

  volverAPaises(): void {
    this.router.navigate(['/countries']);
  }

  irAPlantel(): void {
    if (this.pais?.codigo) {
      this.router.navigate(['/seleccion', this.pais.codigo]);
    } else {
      this.router.navigate(['/countries']);
    }
  }

  setTab(tab: 'convocatoria' | 'titulares' | 'nova'): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'convocatoria' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  // ═══ STATS PANEL ═══

  selectPlayer(player: JugadorSeleccionable): void {
    if (this.selectedPlayer()?.internalId === player.internalId) {
      this.selectedPlayer.set(null);
      this.playerStats.set(null);
      this.statsError.set('');
      return;
    }
    this.selectedPlayer.set(player);
    this.playerStats.set(null);
    this.statsError.set('');
    this.loadPlayerStats(player.internalId);
  }

  closeStatsPanel(): void {
    this.selectedPlayer.set(null);
    this.playerStats.set(null);
    this.statsError.set('');
  }

  private loadPlayerStats(playerId: number): void {
    this.statsLoading.set(true);
    this.http.get<{ stats: PlayerStats; cached: boolean; syncDate?: string; message?: string }>(
      `${environment.apiUrl}/jugadores/${playerId}/stats`
    ).subscribe({
      next: (res) => {
        const s = res.stats as any;
        if (!s || Object.keys(s).length === 0 || (!s.club && !s.goles && !s.nacimiento)) {
          this.statsError.set('Sin estadísticas disponibles para esta temporada.');
        } else {
          this.playerStats.set(s as PlayerStats);
          if (s.rating) {
            this.ratingCache.set(playerId, s.rating);
          }
        }
        this.statsLoading.set(false);
      },
      error: () => {
        this.statsError.set('No se pudieron cargar las estadísticas.');
        this.statsLoading.set(false);
      }
    });
  }

  // ═══ DRAG & DROP CANCHA ═══
  @ViewChild('pitchFieldRef') pitchFieldRef!: ElementRef<HTMLDivElement>;

  trackById(_: number, player: JugadorSeleccionable): number {
    return player.internalId;
  }

  /** Retorna posición en píxeles para cdkDragFreeDragPosition (con cache) */
  getPlayerDragPos(player: JugadorSeleccionable): { x: number; y: number } {
    const id = Number(player.internalId);
    const cached = this._dragPxCache.get(id);
    if (cached) return cached;

    const field = this.pitchFieldRef?.nativeElement;
    if (!field || !field.clientWidth) return ConvocadosComponent.ZERO_POS;

    const pct = this.savedPositions.get(id) ?? this.getDefaultPositionPct(player);
    // Asegurar que todos los titulares tengan su posición en savedPositions
    if (!this.savedPositions.has(id)) {
      this.savedPositions.set(id, pct);
    }
    const pos = {
      x: (pct.x / 100) * field.clientWidth - 28,
      y: (pct.y / 100) * field.clientHeight - 30
    };
    this._dragPxCache.set(id, pos);
    return pos;
  }

  /** Calcula posición por defecto (%) según posición de juego */
  private getDefaultPositionPct(player: JugadorSeleccionable): { x: number; y: number } {
    const pos = player.posicion?.codigo || 'MED';
    const titulares = this.players().filter(p => p.titular && p.posicion?.codigo === pos);
    const idx = titulares.findIndex(p => p.internalId === player.internalId);
    const count = titulares.length;

    const hSpacing = count > 1 ? 70 / (count - 1) : 0;
    const hStart = count > 1 ? 15 : 50;
    const x = count > 1 ? hStart + idx * hSpacing : hStart;

    const yMap: Record<string, number> = { 'DEL': 12, 'MED': 38, 'DEF': 64, 'ARQ': 88 };
    const y = yMap[pos] ?? 50;
    return { x, y };
  }

  /** Cuando se suelta un jugador después de arrastrarlo */
  onDragEnded(event: CdkDragEnd, player: JugadorSeleccionable): void {
    const field = this.pitchFieldRef?.nativeElement;
    if (!field) return;

    const pos = event.source.getFreeDragPosition();
    const id = Number(player.internalId);

    // Actualizar cache de píxeles (misma referencia que CdkDrag usa)
    this._dragPxCache.set(id, { x: pos.x, y: pos.y });

    // Convertir a porcentaje para guardar en servidor
    const xPct = ((pos.x + 28) / field.clientWidth) * 100;
    const yPct = ((pos.y + 30) / field.clientHeight) * 100;
    this.draggedPositions.set(id, { x: xPct, y: yPct });
    this.savedPositions.set(id, { x: xPct, y: yPct });
  }

  /** Guarda SOLO las posiciones de los titulares en la cancha */
  guardarPosiciones(): void {
    if (this.savedPositions.size === 0) {
      this.snackBar.open('No hay posiciones para guardar.', '', { duration: 2500 });
      return;
    }
    this.savingPositions = true;
    const posiciones = Array.from(this.savedPositions.entries()).map(([jugadorId, pos]) => ({
      jugadorId, x: Math.round(pos.x * 100) / 100, y: Math.round(pos.y * 100) / 100
    }));
    this.countriesService.guardarPosicionesTitulares(this.paisId, posiciones).subscribe({
      next: () => {
        this.savingPositions = false;
        this.draggedPositions.clear();
        this.snackBar.open('✅ Posiciones guardadas', '', { duration: 3000, panelClass: 'snack-success' });
      },
      error: () => {
        this.savingPositions = false;
        this.snackBar.open('Error al guardar posiciones. Intentá de nuevo.', '', { duration: 3000, panelClass: 'snack-error' });
      }
    });
  }

  /** Exportar cancha como imagen PNG con marca DT26 y país + fecha */
  exportingPitch = false;

  exportPitchAsPng(): void {
    const el = this.pitchFieldRef?.nativeElement;
    if (!el) return;
    this.exportingPitch = true;

    // Agregar marcas de agua temporales para la captura
    const username = this.authService.getCurrentUser()?.user;
    const tmpEls: HTMLElement[] = [];

    // 1) Arriba izquierda: dt26.win + usuario
    const topLeft = document.createElement('div');
    topLeft.style.cssText = 'position:absolute;top:8px;left:12px;display:flex;flex-direction:column;gap:1px;z-index:10;pointer-events:none;';
    const siteName = document.createElement('span');
    siteName.textContent = 'dt26.win';
    siteName.style.cssText = 'font-size:10px;font-weight:600;color:rgba(255,255,255,0.35);letter-spacing:0.5px;';
    topLeft.appendChild(siteName);
    if (username) {
      const userTag = document.createElement('span');
      userTag.textContent = `usuario: @${username}`;
      userTag.style.cssText = 'font-size:9px;font-weight:500;color:rgba(255,255,255,0.30);';
      topLeft.appendChild(userTag);
    }
    el.appendChild(topLeft);
    tmpEls.push(topLeft);

    // 2) Centro de la cancha: dt26.win horizontal sobre la línea central
    const center = document.createElement('div');
    center.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10;pointer-events:none;';
    const centerText = document.createElement('span');
    centerText.textContent = 'dt26.win';
    centerText.style.cssText = 'font-size:22px;font-weight:800;color:rgba(255,255,255,0.08);letter-spacing:2px;white-space:nowrap;';
    center.appendChild(centerText);
    el.appendChild(center);
    tmpEls.push(center);

    // Info país + fecha arriba derecha
    const infoEl = document.createElement('div');
    infoEl.style.cssText = 'position:absolute;top:8px;right:12px;z-index:10;pointer-events:none;';
    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    infoEl.innerHTML = `<span style="font-size:9px;font-weight:500;color:rgba(255,255,255,0.30);">${this.pais?.nombre ?? ''} · ${fecha}</span>`;
    el.appendChild(infoEl);
    tmpEls.push(infoEl);

    html2canvas(el, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      allowTaint: true
    }).then(canvas => {
      // Quitar overlays temporales
      tmpEls.forEach(e => e.remove());
      canvas.toBlob(blob => {
        if (blob && navigator.share && navigator.canShare?.({ files: [new File([blob], 'xi-titular.png', { type: 'image/png' })] })) {
          const file = new File([blob], `XI-${this.pais?.nombre ?? 'titular'}.png`, { type: 'image/png' });
          navigator.share({ files: [file], title: `Mi XI Titular - ${this.pais?.nombre}` }).catch(() => this.downloadCanvas(canvas));
        } else {
          this.downloadCanvas(canvas);
        }
        this.exportingPitch = false;
      }, 'image/png');
    }).catch(() => {
      tmpEls.forEach(e => e.remove());
      this.exportingPitch = false;
      this.snackBar.open('Error al exportar la imagen', '', { duration: 3000 });
    });
  }

  private downloadCanvas(canvas: HTMLCanvasElement): void {
    const link = document.createElement('a');
    link.download = `XI-${this.pais?.nombre ?? 'titular'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
}
