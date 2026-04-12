import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StatsService, UsuarioRanking } from '../../core/services/stats.service';
import { GrupoService, GrupoRanking } from '../../core/services/grupo.service';
import { AvatarIconComponent } from '../../shared/components/avatar-icon/avatar-icon.component';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    AvatarIconComponent,
  ],
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.scss']
})
export class StatsComponent implements OnInit {

  ranking: UsuarioRanking[] = [];
  grupoRanking: GrupoRanking[] = [];
  loading = true;
  loadingGrupos = true;
  error = '';
  activeTab: 'usuarios' | 'grupos' = 'usuarios';

  constructor(
    private statsService: StatsService,
    private grupoService: GrupoService
  ) {}

  ngOnInit(): void {
    this.statsService.getRanking().subscribe({
      next: (data) => { this.ranking = data; this.loading = false; },
      error: () => { this.error = 'No se pudo cargar el ranking.'; this.loading = false; }
    });
    this.grupoService.getRankingGrupos().subscribe({
      next: (data) => { this.grupoRanking = data; this.loadingGrupos = false; },
      error: () => { this.loadingGrupos = false; }
    });
  }

  getDisplayName(u: UsuarioRanking): string {
    if (u.nombre || u.apellido) {
      return `${u.nombre ?? ''} ${u.apellido ?? ''}`.trim();
    }
    return u.user;
  }

  getRankMedal(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  }
}
