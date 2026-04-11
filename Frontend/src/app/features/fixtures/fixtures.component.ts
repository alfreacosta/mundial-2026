import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { FixturesService, Fixture } from '../../core/services/fixtures.service';
import { normalize } from '../../shared/utils/normalize';

@Component({
  selector: 'app-fixtures',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './fixtures.component.html',
  styleUrl: './fixtures.component.scss'
})
export class FixturesComponent implements OnInit, OnDestroy {

  // Estado
  protected allFixtures = signal<Fixture[]>([]);
  protected liveFixtures = signal<Fixture[]>([]);
  protected isLoading = signal(true);
  protected errorMsg = signal('');
  protected selectedDate = signal('');
  protected selectedFase = signal('all');
  protected selectedGrupo = signal('all');
  protected searchTerm = signal('');
  protected viewMode = signal<'list' | 'cards'>('cards');
  protected showMatchDetail = signal<Fixture | null>(null);

  // Fechas disponibles
  protected availableDates = signal<string[]>([]);

  // Filtros
  protected readonly fases = [
    { codigo: 'all', nombre: 'Todas las Fases' },
    { codigo: 'GRUPOS', nombre: 'Fase de Grupos' },
    { codigo: 'OCTAVOS', nombre: 'Octavos de Final' },
    { codigo: 'CUARTOS', nombre: 'Cuartos de Final' },
    { codigo: 'SEMIFINAL', nombre: 'Semifinal' },
    { codigo: 'TERCER_PUESTO', nombre: 'Tercer Puesto' },
    { codigo: 'FINAL', nombre: 'Final' }
  ];

  protected readonly grupos = ['all', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  // Computed: partidos filtrados
  protected filteredFixtures = computed(() => {
    let fixtures = this.allFixtures();
    const fase = this.selectedFase();
    const grupo = this.selectedGrupo();
    const date = this.selectedDate();
    const search = normalize(this.searchTerm());

    if (fase !== 'all') {
      fixtures = fixtures.filter(f => f.faseCodigo === fase);
    }
    if (grupo !== 'all') {
      fixtures = fixtures.filter(f => f.grupo === grupo);
    }
    if (date) {
      fixtures = fixtures.filter(f => f.fechaHora && f.fechaHora.startsWith(date));
    }
    if (search) {
      fixtures = fixtures.filter(f =>
        normalize(f.equipoLocalNombre).includes(search) ||
        normalize(f.equipoVisitanteNombre).includes(search) ||
        (f.estadio && normalize(f.estadio).includes(search))
      );
    }

    return fixtures;
  });

  // Computed: partidos agrupados por fecha
  protected fixturesByDate = computed(() => {
    const fixtures = this.filteredFixtures();
    const grouped = new Map<string, Fixture[]>();

    for (const f of fixtures) {
      const date = f.fechaHora ? f.fechaHora.substring(0, 10) : 'Sin fecha';
      if (!grouped.has(date)) grouped.set(date, []);
      grouped.get(date)!.push(f);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, matches]) => ({ date, matches }));
  });

  // Stats computed
  protected totalMatches = computed(() => this.allFixtures().length);
  protected finishedMatches = computed(() => this.allFixtures().filter(f => f.estado === 'FINALIZADO').length);
  protected liveCount = computed(() => this.liveFixtures().length);
  protected pendingMatches = computed(() => this.allFixtures().filter(f => f.estado === 'PENDIENTE').length);

  private subs = new Subscription();

  constructor(protected fixturesService: FixturesService) {}

  ngOnInit(): void {
    this.loadFixtures();
    // Polling de partidos en vivo cada 60 segundos
    this.subs.add(
      this.fixturesService.startLivePolling(60000).subscribe(live => {
        this.liveFixtures.set(live);
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  loadFixtures(): void {
    this.isLoading.set(true);
    this.errorMsg.set('');
    this.fixturesService.clearCache();

    this.subs.add(
      this.fixturesService.getAllFixtures().subscribe({
        next: (fixtures) => {
          this.allFixtures.set(fixtures);
          // Extraer fechas únicas
          const dates = [...new Set(fixtures
            .filter(f => f.fechaHora)
            .map(f => f.fechaHora.substring(0, 10))
          )].sort();
          this.availableDates.set(dates);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMsg.set('No se pudieron cargar los partidos. Verificá tu conexión.');
          this.isLoading.set(false);
        }
      })
    );
  }

  // Helpers
  getFlag(codigo: string): string {
    return this.fixturesService.getFlag(codigo);
  }

  getFaseLabel(codigo: string): string {
    return this.fixturesService.getFaseLabel(codigo);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  formatShortDate(dateStr: string): string {
    if (!dateStr || dateStr === 'Sin fecha') return dateStr;
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-ES', {
      weekday: 'short', day: 'numeric', month: 'short'
    });
  }

  openDetail(fixture: Fixture): void {
    this.showMatchDetail.set(fixture);
  }

  closeDetail(): void {
    this.showMatchDetail.set(null);
  }

  resetFilters(): void {
    this.selectedFase.set('all');
    this.selectedGrupo.set('all');
    this.selectedDate.set('');
    this.searchTerm.set('');
  }

  navigateDate(direction: number): void {
    const dates = this.availableDates();
    const current = this.selectedDate();
    if (!dates.length) return;

    if (!current) {
      // Ir a la primera fecha
      this.selectedDate.set(dates[0]);
      return;
    }

    const idx = dates.indexOf(current);
    const newIdx = idx + direction;
    if (newIdx >= 0 && newIdx < dates.length) {
      this.selectedDate.set(dates[newIdx]);
    } else if (direction > 0) {
      this.selectedDate.set(''); // Quitar filtro
    }
  }

  /** Color del grupo */
  getGroupColor(grupo: string | null): string {
    return '#00d4ff';
  }
}
