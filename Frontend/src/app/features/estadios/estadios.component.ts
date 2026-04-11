import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FixturesService, Fixture } from '../../core/services/fixtures.service';
import { SeleccionService, Venue } from '../../core/services/seleccion.service';
import { forkJoin } from 'rxjs';

interface Estadio {
  nombre: string;
  ciudad: string;
  pais: string;
  capacidad: number;
  foto: string;
  partidos: Fixture[];
  expanded: boolean;
}

@Component({
  selector: 'app-estadios',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './estadios.component.html',
  styleUrls: ['./estadios.component.scss']
})
export class EstadiosComponent implements OnInit {
  estadios: Estadio[] = [];
  loading = true;
  error = '';

  constructor(
    private fixturesService: FixturesService,
    private seleccionService: SeleccionService
  ) {}

  ngOnInit(): void {
    forkJoin({
      fixtures: this.fixturesService.getAllFixtures(),
      venues: this.seleccionService.getVenues()
    }).subscribe({
      next: ({ fixtures, venues }) => {
        this.buildEstadios(fixtures, venues);
        this.loading = false;
      },
      error: () => {
        this.error = 'Error al cargar los datos de estadios';
        this.loading = false;
      }
    });
  }

  private buildEstadios(fixtures: Fixture[], venues: Venue[]): void {
    // Indexar venues por nombre para lookup rápido
    const venueMap = new Map<string, Venue>();
    venues.forEach(v => venueMap.set(v.nombre, v));

    const grouped = new Map<string, Fixture[]>();
    fixtures.forEach(f => {
      if (!f.estadio) return;
      const list = grouped.get(f.estadio) || [];
      list.push(f);
      grouped.set(f.estadio, list);
    });

    this.estadios = Array.from(grouped.entries())
      .map(([nombre, partidos]) => {
        const venue = venueMap.get(nombre);
        return {
          nombre,
          ciudad: venue?.ciudad || partidos[0]?.ciudad || '',
          pais: venue?.pais || '',
          capacidad: venue?.capacidad || 0,
          foto: venue?.fotoUrl || '',
          partidos: partidos.sort((a, b) => (a.fechaHora || '').localeCompare(b.fechaHora || '')),
          expanded: false
        };
      })
      .sort((a, b) => b.partidos.length - a.partidos.length);
  }

  toggleEstadio(estadio: Estadio): void {
    estadio.expanded = !estadio.expanded;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'Por definir';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  formatCapacity(n: number): string {
    return n > 0 ? n.toLocaleString('es') : 'N/D';
  }
}
