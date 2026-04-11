import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GrupoService } from '../../../core/services/grupo.service';
import { CountriesService, Pais } from '../../../core/services/countries.service';
import { normalize } from '../../../shared/utils/normalize';
import { EquipoFavorito } from '../../../core/models/grupo.models';
import { forkJoin } from 'rxjs';
import { FifaToFlagPipe } from '../../../shared/pipes/fifa-to-flag.pipe';

@Component({
  selector: 'app-mis-favoritos',
  standalone: true,
  imports: [CommonModule, FormsModule, FifaToFlagPipe],
  templateUrl: './mis-favoritos.component.html',
  styleUrl: './mis-favoritos.component.scss'
})
export class MisFavoritosComponent implements OnInit {

  favoritos: EquipoFavorito[] = [];
  todosPaises: Pais[] = [];
  filtro = '';
  loading = true;
  guardando = false;
  msg = '';
  error = '';

  // Bandera para mostrar el selector
  mostrandoSelector = false;

  constructor(
    private grupoService: GrupoService,
    private countriesService: CountriesService
  ) {}

  ngOnInit(): void {
    forkJoin({
      favoritos: this.grupoService.getMisFavoritos(),
      paises:    this.countriesService.getPaises()
    }).subscribe({
      next: ({ favoritos, paises }) => {
        this.favoritos    = favoritos;
        this.todosPaises  = paises.filter(p => p.activo);
        this.loading      = false;
      },
      error: () => {
        this.error   = 'Error al cargar datos';
        this.loading = false;
      }
    });
  }

  get paisesFiltrados(): Pais[] {
    const q = this.filtro.toLowerCase();
    const yaElegidos = new Set(this.favoritos.map(f => f.paisId));
    return this.todosPaises
      .filter(p => !yaElegidos.has(p.internalId))
      .filter(p => !q || normalize(p.nombre).includes(normalize(q)));
  }

  get puedeAgregarMas(): boolean {
    return this.favoritos.length < 5;
  }

  agregarFavorito(pais: Pais): void {
    if (!this.puedeAgregarMas) return;

    this.guardando = true;
    this.msg = '';
    this.error = '';

    const orden = this.favoritos.length + 1;
    this.grupoService.agregarFavorito({ paisId: pais.internalId, orden }).subscribe({
      next: (ef) => {
        this.favoritos.push(ef);
        this.filtro   = '';
        this.guardando = false;
        this.msg = `${pais.nombre} agregado`;
        setTimeout(() => this.msg = '', 2500);
        if (this.favoritos.length === 5) this.mostrandoSelector = false;
      },
      error: (err) => {
        this.error    = err.error?.error || 'Error al agregar favorito';
        this.guardando = false;
      }
    });
  }

  quitarFavorito(fav: EquipoFavorito): void {
    this.guardando = true;
    this.error = '';
    this.msg   = '';

    this.grupoService.quitarFavorito(fav.paisId).subscribe({
      next: () => {
        this.favoritos = this.favoritos.filter(f => f.paisId !== fav.paisId);
        // Reordenar el resto en el backend con setFavoritos
        if (this.favoritos.length > 0) {
          const paisIds = this.favoritos.map(f => f.paisId);
          this.grupoService.setFavoritos(paisIds).subscribe({
            next: (updated) => {
              this.favoritos = updated;
              this.guardando = false;
            },
            error: () => { 
              this.guardando = false; 
            }
          });
        } else {
          this.guardando = false;
        }
      },
      error: (err) => {
        this.error    = err.error?.error || 'Error al quitar favorito';
        this.guardando = false;
      }
    });
  }

  getFlagClass(codigo: string): string {
    return `fi fi-${codigo.toLowerCase()}`;
  }
}
