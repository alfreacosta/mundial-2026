import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PlayersService, Jugador } from '../../core/services/players.service';
import { normalize } from '../../shared/utils/normalize';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [
    CommonModule, 
    MatCardModule, 
    MatIconModule, 
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    RouterLink,
    FormsModule
  ],
  templateUrl: './players.component.html',
  styleUrls: ['./players.component.scss']
})
export class PlayersComponent implements OnInit {
  jugadores: Jugador[] = [];
  filteredJugadores: Jugador[] = [];
  loading = true;
  error = '';
  
  searchTerm = '';
  selectedPosition = '';
  selectedCountry = '';
  
  positions = [
    { value: 'ARQ', label: 'Arquero' },
    { value: 'DEF', label: 'Defensor' },
    { value: 'MED', label: 'Mediocampista' },
    { value: 'DEL', label: 'Delantero' }
  ];
  countries: string[] = [];

  constructor(
    private playersService: PlayersService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadJugadores();
  }

  loadJugadores(): void {
    this.loading = true;
    this.error = '';
    
    this.playersService.getJugadores().subscribe({
      next: (data: Jugador[]) => {
        this.jugadores = data;
        this.filteredJugadores = data;
        this.extractCountries();
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Error cargando jugadores:', err);
        this.error = 'Error al cargar los jugadores. Por favor, intentá de nuevo.';
        this.loading = false;
      }
    });
  }

  extractCountries(): void {
    const countriesSet = new Set<string>();
    this.jugadores.forEach(j => {
      if (j.pais?.nombre) {
        countriesSet.add(j.pais.nombre);
      }
    });
    this.countries = Array.from(countriesSet).sort();
  }

  applyFilters(): void {
    this.filteredJugadores = this.jugadores.filter(j => {
      const matchesSearch = !this.searchTerm || 
        normalize(j.nombreCompleto).includes(normalize(this.searchTerm));
      
      const matchesPosition = !this.selectedPosition || 
        j.posicion?.codigo === this.selectedPosition;
      
      const matchesCountry = !this.selectedCountry || 
        j.pais?.nombre === this.selectedCountry;
      
      return matchesSearch && matchesPosition && matchesCountry;
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedPosition = '';
    this.selectedCountry = '';
    this.applyFilters();
  }

  getPositionLabel(position: string): string {
    const pos = this.positions.find(p => p.value === position);
    return pos ? pos.label : position;
  }

  getPositionIcon(position: string): string {
    const icons: Record<string, string> = {
      'ARQ': 'sports',
      'DEF': 'shield',
      'MED': 'track_changes',
      'DEL': 'sports_soccer'
    };
    return icons[position] || 'person';
  }

  getPositionColor(position: string): string {
    const colors: Record<string, string> = {
      'ARQ': 'arquero',
      'DEF': 'defensor',
      'MED': 'mediocampista',
      'DEL': 'delantero'
    };
    return colors[position] || '';
  }
}
