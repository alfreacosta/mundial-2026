import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { debounceTime, Subject, switchMap, distinctUntilChanged, catchError, of } from 'rxjs';
import { GrupoService } from '../../core/services/grupo.service';
import { PerfilPublico } from '../../core/models/grupo.models';
import { AvatarIconComponent } from '../../shared/components/avatar-icon/avatar-icon.component';

@Component({
  selector: 'app-buscar-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatProgressSpinnerModule, AvatarIconComponent],
  templateUrl: './buscar-usuarios.component.html',
  styleUrls: ['./buscar-usuarios.component.scss']
})
export class BuscarUsuariosComponent implements OnInit {

  query = '';
  resultados: PerfilPublico[] = [];
  loading = false;
  buscado = false;
  error = '';

  private busqueda$ = new Subject<string>();

  constructor(private grupoService: GrupoService) {}

  ngOnInit(): void {
    this.busqueda$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(q => {
        if (q.length < 2) {
          this.loading = false;
          this.resultados = [];
          this.buscado = false;
          return of([]);
        }
        this.loading = true;
        this.error = '';
        return this.grupoService.buscarUsuarios(q).pipe(
          catchError((err) => {
            this.loading = false;
            if (err.status === 401) {
              this.error = 'Tu sesión expiró. Por favor volvé a iniciar sesión.';
            } else if (err.status === 0) {
              this.error = 'Sin conexión al servidor. Verificá tu conexión.';
            } else {
              this.error = 'Error al buscar usuarios. Intentá de nuevo.';
            }
            return of([]);
          })
        );
      })
    ).subscribe({
      next: r => {
        this.resultados = r;
        this.loading = false;
        this.buscado = true;
      },
      error: () => {
        this.loading = false;
        this.error = 'Error inesperado. Intentá de nuevo.';
      }
    });
  }

  onQueryChange(): void {
    this.busqueda$.next(this.query.trim());
  }

  limpiar(): void {
    this.query = '';
    this.resultados = [];
    this.buscado = false;
    this.error = '';
    this.busqueda$.next('');
  }

  get resultadosOrdenados(): PerfilPublico[] {
    return [...this.resultados].sort((a, b) => (b.puntaje ?? 0) - (a.puntaje ?? 0));
  }

  getIniciales(nombre: string | null, apellido: string | null): string {
    return ((nombre?.[0] || '') + (apellido?.[0] || '')).toUpperCase() || '?';
  }
}
