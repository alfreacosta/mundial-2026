import { Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SeleccionService, Seleccion, JugadorSeleccion } from '../../core/services/seleccion.service';
import { environment } from '../../../environments/environment';
import { normalize } from '../../shared/utils/normalize';

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

@Component({
  selector: 'app-seleccion-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    RouterLink
  ],
  templateUrl: './seleccion-detail.component.html',
  styleUrls: ['./seleccion-detail.component.scss']
})
export class SeleccionDetailComponent implements OnInit {

  protected seleccion = signal<Seleccion | null>(null);
  protected isLoading = signal(true);
  protected errorMsg = signal('');
  protected activeTab = signal<'plantel' | 'stats'>('plantel');
  protected selectedPlayer = signal<JugadorSeleccion | null>(null);
  protected playerStats = signal<PlayerStats | null>(null);
  protected statsLoading = signal(false);
  protected statsError = signal('');
  protected searchQuery = signal('');



  // Position groups for display
  protected readonly positionGroups = [
    { codigo: 'ARQ', label: 'Porteros', icon: 'sports_handball', color: '#f59e0b' },
    { codigo: 'DEF', label: 'Defensores', icon: 'shield', color: '#3b82f6' },
    { codigo: 'MED', label: 'Mediocampistas', icon: 'sync_alt', color: '#10b981' },
    { codigo: 'DEL', label: 'Delanteros', icon: 'sports_soccer', color: '#f97316' }
  ];

  private readonly CONF_COLORS: Record<string, string> = {
    UEFA: '#1a56db', CONMEBOL: '#b45309', CONCACAF: '#b91c1c',
    CAF: '#065f46', AFC: '#6d28d9', OFC: '#0e7490'
  };

  // Computed
  protected confColor = computed(() => {
    const s = this.seleccion();
    return this.CONF_COLORS[s?.confederacionCodigo ?? ''] ?? '#7c3aed';
  });

  protected plantelFiltrado = computed(() => {
    const plantel = this.seleccion()?.plantel ?? [];
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) {
      // Sin búsqueda: solo convocados a eliminatorias
      const convocados = plantel.filter(j => j.convocadoEliminatoria);
      return convocados.length > 0 ? convocados : plantel;
    }
    // Con búsqueda: buscar en TODA la lista
    const nq = normalize(q);
    return plantel.filter(j => {
      const nombre = normalize(j.nombreCompleto || `${j.nombre} ${j.apellido}`);
      const club   = normalize(j.clubNombre || '');
      return nombre.includes(nq) || club.includes(nq);
    });
  });

  protected totalConvocados = computed(() =>
    (this.seleccion()?.plantel ?? []).filter(j => j.convocadoEliminatoria).length
  );

  protected isShowingConvocados = computed(() =>
    !this.searchQuery().trim() && this.totalConvocados() > 0
  );

  protected plantelByPosition = computed(() => {
    const plantel = this.plantelFiltrado();
    const grouped: Record<string, JugadorSeleccion[]> = {};
    for (const pg of this.positionGroups) {
      grouped[pg.codigo] = plantel.filter(j => j.posicionCodigo === pg.codigo);
    }
    const knownCodes = new Set(this.positionGroups.map(pg => pg.codigo));
    const unknown = plantel.filter(j => !knownCodes.has(j.posicionCodigo));
    if (unknown.length) {
      grouped['OTRO'] = unknown;
    }
    return grouped;
  });

  protected totalJugadores = computed(() => this.seleccion()?.plantel?.length ?? 0);
  protected totalFiltrados = computed(() => this.plantelFiltrado().length);

  protected posCounts = computed(() => {
    const plantel = this.seleccion()?.plantel ?? [];
    const counts: Record<string, number> = {};
    for (const j of plantel) {
      const pos = j.posicionCodigo || 'OTRO';
      counts[pos] = (counts[pos] || 0) + 1;
    }
    return counts;
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private seleccionService: SeleccionService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    const codigo = this.route.snapshot.paramMap.get('codigo');
    if (codigo) {
      this.loadSeleccion(codigo);
    } else {
      this.errorMsg.set('Código de selección no proporcionado.');
      this.isLoading.set(false);
    }
  }

  loadSeleccion(codigo: string): void {
    this.isLoading.set(true);
    this.errorMsg.set('');
    this.seleccionService.clearTeamCache(codigo);

    this.seleccionService.getDetalle(codigo).subscribe({
      next: (data) => {
        this.seleccion.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMsg.set('No se pudo cargar la información de la selección.');
        this.isLoading.set(false);
      }
    });
  }

  getPlayersByPosition(codigo: string): JugadorSeleccion[] {
    return this.plantelByPosition()[codigo] ?? [];
  }

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  getPosColor(codigo: string): string {
    return this.positionGroups.find(pg => pg.codigo === codigo)?.color ?? '#94a3b8';
  }

  onImgError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  selectPlayer(player: JugadorSeleccion): void {
    if (this.selectedPlayer()?.id === player.id) {
      this.selectedPlayer.set(null);
      this.playerStats.set(null);
      this.statsError.set('');
      return;
    }
    this.selectedPlayer.set(player);
    this.playerStats.set(null);
    this.statsError.set('');
    this.loadPlayerStats(player.id);
  }

  private loadPlayerStats(playerId: number): void {
    this.statsLoading.set(true);
    this.http.get<{ stats: PlayerStats; cached: boolean; syncDate?: string; message?: string }>(
      `${environment.apiUrl}/jugadores/${playerId}/stats`
    ).subscribe({
      next: (res) => {
        const s = res.stats as any;
        // Verificar que haya datos mínimos
        if (!s || Object.keys(s).length === 0 || (!s.club && !s.goles && !s.nacimiento)) {
          this.statsError.set('Sin estadísticas disponibles para esta temporada.');
        } else {
          this.playerStats.set(s as PlayerStats);
        }
        this.statsLoading.set(false);
      },
      error: () => {
        this.statsError.set('No se pudieron cargar las estadísticas.');
        this.statsLoading.set(false);
      }
    });
  }

  volver(): void {
    this.router.navigate(['/countries']);
  }

  irAConvocatoria(tab?: string): void {
    const s = this.seleccion();
    if (s) {
      const extras = tab ? { queryParams: { tab } } : {};
      this.router.navigate(['/convocados', s.id], extras);
    }
  }

  retry(): void {
    const codigo = this.route.snapshot.paramMap.get('codigo');
    if (codigo) this.loadSeleccion(codigo);
  }
}
