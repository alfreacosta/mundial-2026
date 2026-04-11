import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  PrediccionPartidoService,
  PrediccionPartido
} from '../../core/services/prediccion-partido.service';
import { FixturesService, Fixture } from '../../core/services/fixtures.service';
import { getFlagUrl } from '../../core/utils/flag.utils';

interface PartidoConPrediccion {
  partido:          Fixture;
  prediccion:       PrediccionPartido | null;
  golLocalEdit:     number | null;
  golVisitanteEdit: number | null;
  guardando:        boolean;
  guardado:         boolean;
  error:            string;
}

@Component({
  selector: 'app-prediccion-partidos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './prediccion-partidos.component.html',
  styleUrls: ['./prediccion-partidos.component.scss']
})
export class PrediccionPartidosComponent implements OnInit {

  getFlagUrl = getFlagUrl;

  loading   = true;
  error     = '';
  grupos: string[] = [];
  grupoActivo = '';

  /** Mapa grupoLetra → partidos con predicción */
  partidosPorGrupo = new Map<string, PartidoConPrediccion[]>();

  /** Partidos de otras fases */
  otrosPartidos: PartidoConPrediccion[] = [];

  constructor(
    private prediccionService: PrediccionPartidoService,
    private fixturesService:   FixturesService
  ) {}

  ngOnInit(): void {
    forkJoin({
      partidos:     this.fixturesService.getAllFixtures(),
      predicciones: this.prediccionService.getMisPredicciones().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ partidos, predicciones }) => {
        this.construirVista(partidos, predicciones);
        this.loading = false;
      },
      error: () => {
        this.error   = 'Error al cargar los partidos';
        this.loading = false;
      }
    });
  }

  private construirVista(partidos: Fixture[], predicciones: PrediccionPartido[]): void {
    const predMap = new Map(predicciones.map(p => [p.partidoId, p]));

    const gruposMap = new Map<string, PartidoConPrediccion[]>();

    for (const p of partidos) {
      const item: PartidoConPrediccion = {
        partido:          p,
        prediccion:       predMap.get(p.id) ?? null,
        golLocalEdit:     predMap.get(p.id)?.golLocalPred ?? null,
        golVisitanteEdit: predMap.get(p.id)?.golVisitantePred ?? null,
        guardando:        false,
        guardado:         false,
        error:            ''
      };

      if (p.faseCodigo === 'GRUPOS' && p.grupo) {
        const lista = gruposMap.get(p.grupo) ?? [];
        lista.push(item);
        gruposMap.set(p.grupo, lista);
      } else {
        this.otrosPartidos.push(item);
      }
    }

    // Ordenar grupos alfabéticamente
    this.grupos = [...gruposMap.keys()].sort();
    this.grupoActivo = this.grupos[0] ?? '';
    this.grupos.forEach(g => this.partidosPorGrupo.set(g, gruposMap.get(g)!));
  }

  getPartidosGrupoActivo(): PartidoConPrediccion[] {
    return this.partidosPorGrupo.get(this.grupoActivo) ?? [];
  }

  /**
   * Un partido está bloqueado si:
   *  - el backend lo marcó como bloqueado (prediccion.bloqueada), O
   *  - la fecha/hora del partido ya pasó (evaluado en tiempo real en el cliente)
   */
  isBloqueado(item: PartidoConPrediccion): boolean {
    if (item.prediccion?.bloqueada) return true;
    const fechaPartido = new Date(item.partido.fechaHora);
    return fechaPartido <= new Date();
  }

  cambiarGol(item: PartidoConPrediccion, equipo: 'local' | 'visitante', delta: number): void {
    if (equipo === 'local') {
      item.golLocalEdit = Math.max(0, Math.min(20, (item.golLocalEdit ?? 0) + delta));
    } else {
      item.golVisitanteEdit = Math.max(0, Math.min(20, (item.golVisitanteEdit ?? 0) + delta));
    }
  }

  guardar(item: PartidoConPrediccion): void {
    if (item.golLocalEdit === null || item.golVisitanteEdit === null) return;
    if (item.guardando || this.isBloqueado(item)) return;

    item.guardando = true;
    item.error     = '';

    this.prediccionService.guardar(item.partido.id, {
      golLocal:     item.golLocalEdit,
      golVisitante: item.golVisitanteEdit
    }).subscribe({
      next: pred => {
        item.prediccion       = pred;
        item.golLocalEdit     = pred.golLocalPred;
        item.golVisitanteEdit = pred.golVisitantePred;
        item.guardando        = false;
        item.guardado         = true;
        setTimeout(() => (item.guardado = false), 2500);
      },
      error: (err) => {
        item.guardando = false;
        const msg = err?.error?.error;
        item.error = msg || 'Error al guardar';
      }
    });
  }

  isModificado(item: PartidoConPrediccion): boolean {
    return item.golLocalEdit !== (item.prediccion?.golLocalPred ?? null)
        || item.golVisitanteEdit !== (item.prediccion?.golVisitantePred ?? null);
  }

  getPuntajeClass(pts: number | null): string {
    if (pts === null) return '';
    if (pts >= 50)   return 'pts-exacto';
    if (pts > 0)     return 'pts-correcto';
    return 'pts-incorrecto';
  }

  getPuntajeLabel(pts: number | null): string {
    if (pts === null) return '';
    if (pts >= 50)   return '🎯 +' + pts + ' Exacto';
    if (pts >= 30)   return '✓ +' + pts + ' Diferencia';
    if (pts >= 25)   return '✓ +' + pts + ' Resultado';
    if (pts > 0)     return '✓ +' + pts + ' pts';
    return '✗ 0 pts';
  }

  get totalPredichos(): number {
    let n = 0;
    this.partidosPorGrupo.forEach(lista =>
      lista.forEach(i => { if (i.prediccion) n++; }));
    return n + this.otrosPartidos.filter(i => i.prediccion).length;
  }

  get totalPartidos(): number {
    let n = 0;
    this.partidosPorGrupo.forEach(lista => (n += lista.length));
    return n + this.otrosPartidos.length;
  }
}
