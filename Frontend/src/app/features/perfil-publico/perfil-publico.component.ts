import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { GrupoService } from '../../core/services/grupo.service';
import { PerfilPublico, PerfilJuego, JugadorResumen, ConvocatoriaResumen } from '../../core/models/grupo.models';
import { getFlagUrl } from '../../core/utils/flag.utils';
import { CountriesService } from '../../core/services/countries.service';
import { AvatarIconComponent } from '../../shared/components/avatar-icon/avatar-icon.component';

@Component({
  selector: 'app-perfil-publico',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatProgressSpinnerModule, AvatarIconComponent],
  templateUrl: './perfil-publico.component.html',
  styleUrls: ['./perfil-publico.component.scss']
})
export class PerfilPublicoComponent implements OnInit {

  getFlagUrl = getFlagUrl;

  perfil: PerfilPublico | null = null;
  juego: PerfilJuego | null = null;
  loading = true;
  error = '';

  convocadosExpandidos = new Set<number>();

  constructor(
    private route: ActivatedRoute,
    private grupoService: GrupoService
  ) {}

  ngOnInit(): void {
    const user = this.route.snapshot.paramMap.get('user') ?? '';
    forkJoin({
      perfil: this.grupoService.getPerfilPublico(user).pipe(catchError(() => of(null))),
      juego:  this.grupoService.getJuegoPerfil(user).pipe(catchError(() => of(null)))
    }).subscribe(({ perfil, juego }) => {
      if (!perfil) {
        this.error = 'Perfil no encontrado o privado';
      } else {
        this.perfil = perfil;
        this.juego = juego;
      }
      this.loading = false;
    });
  }

  getIniciales(nombre: string | null, apellido: string | null): string {
    return ((nombre?.[0] || '') + (apellido?.[0] || '')).toUpperCase() || '?';
  }

  toggleConvocados(paisId: number): void {
    if (this.convocadosExpandidos.has(paisId)) {
      this.convocadosExpandidos.delete(paisId);
    } else {
      this.convocadosExpandidos.add(paisId);
    }
  }

  getConvocados(paisId: number): JugadorResumen[] {
    return this.juego?.convocatorias?.[paisId]?.jugadores ?? [];
  }

  getConvocatoria(paisId: number): ConvocatoriaResumen | null {
    return this.juego?.convocatorias?.[paisId] ?? null;
  }

  /** Country IDs that have convocatorias but are NOT in favorites */
  get extraConvocatoriaPaisIds(): number[] {
    if (!this.juego) return [];
    const favIds = new Set(this.juego.favoritos.map(f => f.paisId));
    return Object.keys(this.juego.convocatorias)
      .map(Number)
      .filter(id => !favIds.has(id) && (this.juego!.convocatorias[id]?.jugadores?.length ?? 0) > 0);
  }

  proxyFoto(url: string | null): string | null {
    return CountriesService.proxyUrl(url);
  }
}
