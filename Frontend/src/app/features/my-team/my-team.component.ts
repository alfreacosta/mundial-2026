import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatBadgeModule } from '@angular/material/badge';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-my-team',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatBadgeModule,
    RouterLink
  ],
  templateUrl: './my-team.component.html',
  styleUrls: ['./my-team.component.scss']
})
export class MyTeamComponent implements OnInit {
  userName = '';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.userName = user?.nombre || 'Usuario';
  }

  getPositionLabel(position: string): string {
    const labels: Record<string, string> = {
      'ARQ': 'Arquero',
      'DEF': 'Defensor',
      'MED': 'Mediocampista',
      'DEL': 'Delantero'
    };
    return labels[position] || position;
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
}
