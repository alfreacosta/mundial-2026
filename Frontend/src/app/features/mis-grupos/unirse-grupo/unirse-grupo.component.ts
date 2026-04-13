import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GrupoService } from '../../../core/services/grupo.service';
import { EquipoFavorito, Grupo, GrupoRow } from '../../../core/models/grupo.models';
import { FifaToFlagPipe } from '../../../shared/pipes/fifa-to-flag.pipe';

@Component({
  selector: 'app-unirse-grupo',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule, FifaToFlagPipe],
  templateUrl: './unirse-grupo.component.html',
  styleUrls: ['./unirse-grupo.component.scss']
})
export class UnirseGrupoComponent implements OnInit {

  @Output() grupoUnido = new EventEmitter<GrupoRow>();
  @Output() cancelar = new EventEmitter<void>();
  @Input() codigoInicial = '';

  codigoInvitacion = '';
  loading = false;
  loadingDatos = false;
  error = '';

  /** Paso actual: 1 = código, 2 = seleccionar países */
  paso = 1;

  grupoPreview: Grupo | null = null;
  misFavoritos: EquipoFavorito[] = [];
  paisesSeleccionados: Set<number> = new Set();

  constructor(private grupoService: GrupoService) {}

  ngOnInit(): void {
    if (this.codigoInicial) {
      this.codigoInvitacion = this.codigoInicial;
    }
  }

  get cantidadRequerida(): number {
    return this.grupoPreview?.cantidadPaises ?? 5;
  }

  validarCodigo(): void {
    if (!this.codigoInvitacion.trim()) return;
    this.loading = true;
    this.error = '';
    const codigo = this.codigoInvitacion.trim().toUpperCase();

    this.grupoService.getPreviewPublico(codigo).subscribe({
      next: (grupo) => {
        this.grupoPreview = grupo;
        this.loading = false;
        this.cargarFavoritos();
      },
      error: () => {
        this.error = 'Código de invitación inválido. Verificá y volvé a intentar.';
        this.loading = false;
      }
    });
  }

  private cargarFavoritos(): void {
    this.loadingDatos = true;
    this.grupoService.getMisFavoritos().subscribe({
      next: (favs) => {
        this.misFavoritos = favs.sort((a, b) => a.orden - b.orden);
        this.loadingDatos = false;
        this.paso = 2;

        // Si la cantidad de favoritos es exacta, pre-seleccionar todos
        if (this.misFavoritos.length === this.cantidadRequerida) {
          this.misFavoritos.forEach(f => this.paisesSeleccionados.add(f.paisId));
        }
      },
      error: () => {
        this.error = 'No se pudieron cargar tus favoritos.';
        this.loadingDatos = false;
      }
    });
  }

  togglePais(paisId: number): void {
    if (this.paisesSeleccionados.has(paisId)) {
      this.paisesSeleccionados.delete(paisId);
    } else if (this.paisesSeleccionados.size < this.cantidadRequerida) {
      this.paisesSeleccionados.add(paisId);
    }
  }

  estaSeleccionado(paisId: number): boolean {
    return this.paisesSeleccionados.has(paisId);
  }

  puedeSeleccionar(): boolean {
    return this.paisesSeleccionados.size < this.cantidadRequerida;
  }

  volverPaso1(): void {
    this.paso = 1;
    this.grupoPreview = null;
    this.paisesSeleccionados.clear();
    this.error = '';
  }

  unirse(): void {
    if (this.paisesSeleccionados.size !== this.cantidadRequerida) return;
    this.loading = true;
    this.error = '';

    const paisIds = this.misFavoritos
      .filter(f => this.paisesSeleccionados.has(f.paisId))
      .sort((a, b) => a.orden - b.orden)
      .map(f => f.paisId);

    this.grupoService.unirseAlGrupo({
      codigoInvitacion: this.codigoInvitacion.trim().toUpperCase(),
      paisIds
    }).subscribe({
      next: (row) => {
        this.loading = false;
        this.grupoUnido.emit(row);
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudo unir al grupo. Verificá el código.';
        this.loading = false;
      }
    });
  }
}
