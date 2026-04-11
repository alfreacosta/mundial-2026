import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CountriesService, Pais } from '../../core/services/countries.service';
import { AuthService } from '../../core/services/auth.service';

export interface Group {
  letra: string;
  color: string;
  paises: Pais[];
}

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  templateUrl: './groups.component.html',
  styleUrls: ['./groups.component.scss'],
})
export class GroupsComponent implements OnInit {
  groups: Group[] = [];
  isLoading = true;
  errorMsg = '';
  userName = 'Usuario';

  /** Color uniforme azul/cyan para todos los grupos */
  readonly groupColors: Record<string, string> = {
    A: '#00d4ff', B: '#00d4ff', C: '#00d4ff', D: '#00d4ff',
    E: '#00d4ff', F: '#00d4ff', G: '#00d4ff', H: '#00d4ff',
    I: '#00d4ff', J: '#00d4ff', K: '#00d4ff', L: '#00d4ff',
  };

  /** Emojis de banderas por código de país */
  readonly flagMap: Record<string, string> = {
    MEX: '🇲🇽', RSA: '🇿🇦', KOR: '🇰🇷', UEFAPD: '⏳',
    CAN: '🇨🇦', QAT: '🇶🇦', SUI: '🇨🇭', UEFAPA: '⏳',
    BRA: '🇧🇷', MAR: '🇲🇦', HAI: '🇭🇹', SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    USA: '🇺🇸', PAR: '🇵🇾', AUS: '🇦🇺', UEFAPC: '⏳',
    GER: '🇩🇪', CUW: '🇨🇼', CIV: '🇨🇮', ECU: '🇪🇨',
    NED: '🇳🇱', JPN: '🇯🇵', TUN: '🇹🇳', UEFAPB: '⏳',
    BEL: '🇧🇪', EGY: '🇪🇬', IRN: '🇮🇷', NZL: '🇳🇿',
    ESP: '🇪🇸', CPV: '🇨🇻', SAU: '🇸🇦', URU: '🇺🇾',
    FRA: '🇫🇷', SEN: '🇸🇳', NOR: '🇳🇴', ICP2: '⏳',
    ARG: '🇦🇷', ALG: '🇩🇿', AUT: '🇦🇹', JOR: '🇯🇴',
    POR: '🇵🇹', UZB: '🇺🇿', COL: '🇨🇴', ICP1: '⏳',
    ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', CRO: '🇭🇷', GHA: '🇬🇭', PAN: '🇵🇦',
  };

  /** Candidatos al repechaje (tooltip) */
  readonly playoffCandidates: Record<string, string> = {
    UEFAPA: 'Italia · Gales · Bosnia · Irlanda Norte',
    UEFAPB: 'Ucrania · Polonia · Albania · Suecia',
    UEFAPC: 'Turquía · Eslovaquia · Kosovo · Rumania',
    UEFAPD: 'Dinamarca · Rep. Checa · Irlanda · Macedonia N.',
    ICP1:   'DR Congo · Jamaica · Nueva Caledonia',
    ICP2:   'Irak · Bolivia · Surinam',
  };

  constructor(
    private countriesService: CountriesService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) this.userName = user.nombre || user.user || 'Usuario';

    this.countriesService.getPaises().subscribe({
      next: (paises) => {
        const activos = paises.filter(p => p.activo && p.grupo);
        const map = new Map<string, Pais[]>();
        activos.forEach(p => {
          if (!map.has(p.grupo!)) map.set(p.grupo!, []);
          map.get(p.grupo!)!.push(p);
        });
        this.groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map(
          letra => ({
            letra,
            color: this.groupColors[letra] || '#666',
            paises: (map.get(letra) ?? []).sort((a, b) => {
              if (b.pts !== a.pts) return b.pts - a.pts;
              const gdA = (a.pg * 3 + a.pe) - (a.pp * 3);
              const gdB = (b.pg * 3 + b.pe) - (b.pp * 3);
              return gdB - gdA;
            })
          })
        );
        this.isLoading = false;
      },
      error: () => {
        this.errorMsg = 'No se pudieron cargar los grupos. Verificá tu conexión.';
        this.isLoading = false;
      },
    });
  }

  getFlag(codigo: string): string {
    return this.flagMap[codigo] ?? '🏳️';
  }

  isPending(pais: Pais): boolean {
    return pais.codigo.startsWith('UEFA') || pais.codigo.startsWith('ICP');
  }

  getTooltip(pais: Pais): string {
    return this.playoffCandidates[pais.codigo] ?? '';
  }

  getConfirmedCount(group: Group): number {
    return group.paises.filter(p => !this.isPending(p)).length;
  }

  logout(): void {
    this.authService.logout();
  }
}
