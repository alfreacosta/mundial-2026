import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GrupoService } from '../../../core/services/grupo.service';
import { EquipoFavorito, Grupo } from '../../../core/models/grupo.models';
import { FifaToFlagPipe } from '../../../shared/pipes/fifa-to-flag.pipe';

@Component({
  selector: 'app-crear-grupo',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule, FifaToFlagPipe],
  templateUrl: './crear-grupo.component.html',
  styleUrls: ['./crear-grupo.component.scss']
})
export class CrearGrupoComponent implements OnInit {

  @Output() grupoCreado = new EventEmitter<Grupo>();
  @Output() cancelar = new EventEmitter<void>();

  nombre = '';
  premio = '';
  cantidadPaises = 5;
  loading = false;
  loadingFavs = false;
  error = '';
  grupoNuevo: Grupo | null = null;

  /** Paso actual: 1 = datos del grupo, 2 = seleccionar países */
  paso = 1;

  misFavoritos: EquipoFavorito[] = [];
  paisesSeleccionados: Set<number> = new Set();

  constructor(private grupoService: GrupoService) {}

  ngOnInit(): void {
    this.cargarFavoritos();
  }

  private cargarFavoritos(): void {
    this.loadingFavs = true;
    this.grupoService.getMisFavoritos().subscribe({
      next: (favs) => {
        this.misFavoritos = favs.sort((a, b) => a.orden - b.orden);
        this.loadingFavs = false;
      },
      error: () => { this.loadingFavs = false; }
    });
  }

  irAPaso2(): void {
    if (!this.nombre.trim()) return;
    if (this.misFavoritos.length < this.cantidadPaises) {
      this.error = `Necesitás tener al menos ${this.cantidadPaises} equipos favoritos. Actualmente tenés ${this.misFavoritos.length}.`;
      return;
    }
    this.error = '';
    this.paisesSeleccionados.clear();
    // Si la cantidad coincide, pre-seleccionar todos
    if (this.misFavoritos.length === this.cantidadPaises) {
      this.misFavoritos.forEach(f => this.paisesSeleccionados.add(f.paisId));
    }
    this.paso = 2;
  }

  volverPaso1(): void {
    this.paso = 1;
    this.paisesSeleccionados.clear();
    this.error = '';
  }

  togglePais(paisId: number): void {
    if (this.paisesSeleccionados.has(paisId)) {
      this.paisesSeleccionados.delete(paisId);
    } else if (this.paisesSeleccionados.size < this.cantidadPaises) {
      this.paisesSeleccionados.add(paisId);
    }
  }

  estaSeleccionado(paisId: number): boolean {
    return this.paisesSeleccionados.has(paisId);
  }

  puedeSeleccionar(): boolean {
    return this.paisesSeleccionados.size < this.cantidadPaises;
  }

  crear(): void {
    if (this.paisesSeleccionados.size !== this.cantidadPaises) return;

    this.loading = true;
    this.error = '';

    const paisIds = this.misFavoritos
      .filter(f => this.paisesSeleccionados.has(f.paisId))
      .sort((a, b) => a.orden - b.orden)
      .map(f => f.paisId);

    this.grupoService.crearGrupo({
      nombre: this.nombre.trim(),
      premio: this.premio.trim() || undefined,
      cantidadPaises: this.cantidadPaises,
      paisIds
    }).subscribe({
      next: (grupo) => {
        this.grupoNuevo = grupo;
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo crear el grupo. Intentá de nuevo.';
        this.loading = false;
      }
    });
  }

  confirmar(): void {
    if (this.grupoNuevo) {
      this.grupoCreado.emit(this.grupoNuevo);
    }
  }

  copiarCodigo(): void {
    if (this.grupoNuevo) {
      navigator.clipboard.writeText(this.grupoNuevo.codigoInvitacion);
    }
  }

  getWhatsAppLink(): string {
    if (!this.grupoNuevo) return '#';
    const url = `${window.location.origin}/grupo/${this.grupoNuevo.codigoInvitacion}`;
    const texto = `⚽ *DT26 - Mundial 2026* ⚽\n\n¡Unite a "${this.grupoNuevo.nombre}" y demostrá que sabés más que el técnico! 💪\nArmá tu equipo, desafiá a tus amigos y competí por ser el mejor director técnico. 🏆\n\n👉 ${url}\n\nCódigo: *${this.grupoNuevo.codigoInvitacion}*`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
  }
}
