import { Component, OnInit, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { CdkDrag } from '@angular/cdk/drag-drop';
import { forkJoin } from 'rxjs';
import { CountriesService, Pais, JugadorPais } from '../../core/services/countries.service';
import { GrupoService } from '../../core/services/grupo.service';
import { normalize } from '../../shared/utils/normalize';
import html2canvas from 'html2canvas';

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
  convocatoriaEstado: string | null = null;
  noEsFavorito = false;
  searchQuery = '';
  activeTab = signal<'convocatoria' | 'titulares' | 'nova'>('convocatoria');

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private countriesService: CountriesService,
    private grupoService: GrupoService,
    private snackBar: MatSnackBar
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
          seleccionado: savedIds.has(String(j.internalId)),
          noVa: noVaIdsSet.has(String(j.internalId)),
          titular: titularIdsSet.has(String(j.internalId))
        })));

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
    });
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
        this.saving = false;
        this.convocatoriaEstado = resp.estado;
        this.snackBar.open(
          `✅ Convocatoria guardada: ${resp.totalJugadores} jugadores`,
          'Cerrar',
          { duration: 5000, panelClass: 'snack-success' }
        );
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

  // ═══ DRAG & DROP CANCHA ═══
  @ViewChild('pitchFieldRef') pitchFieldRef!: ElementRef<HTMLDivElement>;

  /** Calcula posición inicial (%) para cada titular en la cancha */
  getInitialPosition(player: JugadorSeleccionable): { x: string; y: string } {
    const pos = player.posicion?.codigo || 'MED';
    const titulares = this.players().filter(p => p.titular && p.posicion?.codigo === pos);
    const idx = titulares.findIndex(p => p.internalId === player.internalId);
    const count = titulares.length;

    // Distribución horizontal: centrado, espaciado uniforme
    const hSpacing = count > 1 ? 70 / (count - 1) : 0;
    const hStart = count > 1 ? 15 : 50;
    const x = count > 1 ? hStart + idx * hSpacing : hStart;

    // Distribución vertical por posición
    const yMap: Record<string, number> = { 'DEL': 12, 'MED': 38, 'DEF': 64, 'ARQ': 88 };
    const y = yMap[pos] ?? 50;

    return { x: `calc(${x}% - 28px)`, y: `calc(${y}% - 30px)` };
  }

  /** Exportar cancha como imagen PNG */
  exportingPitch = false;

  exportPitchAsPng(): void {
    const el = this.pitchFieldRef?.nativeElement;
    if (!el) return;
    this.exportingPitch = true;

    html2canvas(el, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      allowTaint: true
    }).then(canvas => {
      // Intentar compartir si el navegador lo soporta
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
