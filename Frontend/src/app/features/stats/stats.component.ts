import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StatsService, UsuarioRanking } from '../../core/services/stats.service';
import { AvatarIconComponent } from '../../shared/components/avatar-icon/avatar-icon.component';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    AvatarIconComponent,
  ],
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.scss']
})
export class StatsComponent implements OnInit {

  ranking: UsuarioRanking[] = [];
  loading = true;
  error = '';

  constructor(private statsService: StatsService) {}

  ngOnInit(): void {
    this.statsService.getRanking().subscribe({
      next: (data) => {
        this.ranking = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el ranking.';
        this.loading = false;
      }
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
