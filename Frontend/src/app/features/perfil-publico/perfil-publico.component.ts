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
import { MiniPitchComponent } from '../../shared/mini-pitch/mini-pitch.component';

@Component({
  selector: 'app-perfil-publico',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatProgressSpinnerModule, AvatarIconComponent, MiniPitchComponent],
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
  titularesExpandidos = new Set<number>();

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

  toggleTitulares(paisId: number): void {
    if (this.titularesExpandidos.has(paisId)) {
      this.titularesExpandidos.delete(paisId);
    } else {
      this.titularesExpandidos.add(paisId);
    }
  }

  getTitularesParaCancha(paisId: number): { id: number; apellido: string; camiseta: number | null; posAbr: string; x: number; y: number; urlFoto: string | null }[] {
    const conv = this.juego?.convocatorias?.[paisId] ?? this.juego?.convocatorias?.[paisId.toString() as any];
    if (!conv) return [];
    const titIds = new Set(conv.titularesIds ?? []);
    if (titIds.size === 0) return [];
    const posMap = new Map((conv.posicionesTitulares ?? []).map(p => [p.jugadorId, { x: p.x, y: p.y }]));

    // Filtrar titulares de la lista de jugadores
    const titulares = conv.jugadores.filter(j => titIds.has(j.id));
    const porPos = new Map<string, typeof titulares>();
    for (const j of titulares) {
      const abr = j.posicionAbr === 'ARQ' ? 'POR' : j.posicionAbr;
      if (!porPos.has(abr)) porPos.set(abr, []);
      porPos.get(abr)!.push(j);
    }

    const yByPos: Record<string, number> = { POR: 90, DEF: 70, MED: 44, DEL: 18 };
    const results: { id: number; apellido: string; camiseta: number | null; posAbr: string; x: number; y: number; urlFoto: string | null }[] = [];

    for (const [abr, jugadores] of porPos) {
      const baseY = yByPos[abr] ?? 50;
      const n = jugadores.length;
      jugadores.forEach((j, i) => {
        const saved = posMap.get(j.id);
        const apellido = j.nombre.split(' ').pop() ?? j.nombre;
        if (saved) {
          results.push({ id: j.id, apellido, camiseta: j.numeroCamiseta, posAbr: j.posicionAbr, x: saved.x, y: saved.y, urlFoto: j.urlFoto });
        } else {
          const x = n === 1 ? 50 : 15 + (70 * i) / (n - 1);
          results.push({ id: j.id, apellido, camiseta: j.numeroCamiseta, posAbr: j.posicionAbr, x, y: baseY, urlFoto: j.urlFoto });
        }
      });
    }
    return results;
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
