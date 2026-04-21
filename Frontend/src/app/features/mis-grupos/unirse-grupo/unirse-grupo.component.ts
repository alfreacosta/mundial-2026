import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin } from 'rxjs';
import { GrupoService } from '../../../core/services/grupo.service';
import { CountriesService, Pais } from '../../../core/services/countries.service';
import { EquipoFavorito, Grupo, GrupoRow, TIPO_JUEGO_DESC, TipoJuego } from '../../../core/models/grupo.models';
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
  yaMiembro = false;

  /** Paso actual: 1 = código, 2 = seleccionar países (favoritos), 3 = elegir favoritos nuevos */
  paso = 1;

  grupoPreview: Grupo | null = null;
  misFavoritos: EquipoFavorito[] = [];
  paisesSeleccionados: Set<number> = new Set();

  // Para cuando el usuario no tiene suficientes favoritos
  todosPaises: Pais[] = [];
  filtroNuevosFavs = '';
  nuevosSeleccionados: Set<number> = new Set();
  guardandoFavs = false;

  constructor(private grupoService: GrupoService, private countriesService: CountriesService) {}

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
    forkJoin({
      favs: this.grupoService.getMisFavoritos(),
      paises: this.countriesService.getPaises()
    }).subscribe({
      next: ({ favs, paises }) => {
        this.misFavoritos = favs.sort((a, b) => a.orden - b.orden);
        this.todosPaises = paises.filter(p => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre));
        this.loadingDatos = false;

        if (this.misFavoritos.length >= this.cantidadRequerida) {
          this.paso = 2;
          // Pre-seleccionar si la cantidad es exacta
          if (this.misFavoritos.length === this.cantidadRequerida) {
            this.misFavoritos.forEach(f => this.paisesSeleccionados.add(f.paisId));
          }
        } else {
          // No tiene suficientes: ir a elegir favoritos
          this.paso = 3;
          // Pre-seleccionar los que ya tiene
          this.misFavoritos.forEach(f => this.nuevosSeleccionados.add(f.paisId));
        }
      },
      error: () => {
        this.error = 'No se pudieron cargar los datos.';
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

  getTipoJuegoDesc(): string {
    const tipo = this.grupoPreview?.tipoJuego as TipoJuego ?? 'A';
    return TIPO_JUEGO_DESC[tipo] ?? 'Convocatoria + Predicciones';
  }

  volverPaso1(): void {
    this.paso = 1;
    this.grupoPreview = null;
    this.paisesSeleccionados.clear();
    this.nuevosSeleccionados.clear();
    this.filtroNuevosFavs = '';
    this.error = '';
  }

  get paisesFiltrados(): Pais[] {
    const q = this.filtroNuevosFavs.toLowerCase().trim();
    return this.todosPaises.filter(p => !q || p.nombre.toLowerCase().includes(q));
  }

  get nuevosTitulo(): string {
    return `Elegí tus ${this.cantidadRequerida} selecciones favoritas`;
  }

  toggleNuevoFav(paisId: number): void {
    if (this.nuevosSeleccionados.has(paisId)) {
      this.nuevosSeleccionados.delete(paisId);
    } else if (this.nuevosSeleccionados.size < this.cantidadRequerida) {
      this.nuevosSeleccionados.add(paisId);
    }
  }

  guardarFavsYContinuar(): void {
    if (this.nuevosSeleccionados.size < this.cantidadRequerida) return;
    this.guardandoFavs = true;
    this.error = '';
    const ids = Array.from(this.nuevosSeleccionados);
    this.grupoService.setFavoritos(ids).subscribe({
      next: (favs) => {
        this.misFavoritos = favs.sort((a, b) => a.orden - b.orden);
        this.paisesSeleccionados = new Set(ids);
        this.guardandoFavs = false;
        this.paso = 2;
      },
      error: () => {
        this.error = 'No se pudieron guardar los favoritos.';
        this.guardandoFavs = false;
      }
    });
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
        this.loading = false;
        const msg = err?.error?.message || err?.error?.error || '';
        if (msg.toLowerCase().includes('miembro')) {
          this.yaMiembro = true;
          this.error = '';
        } else {
          this.error = msg || 'No se pudo unir al grupo. Verificá el código.';
        }
      }
    });
  }
}
