import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CountriesService, Pais } from '../../core/services/countries.service';
import { PlayersService, Jugador } from '../../core/services/players.service';
import { normalize } from '../../shared/utils/normalize';
import { PrediccionTorneoService, PrediccionTorneo } from '../../core/services/prediccion-torneo.service';
import { FifaToFlagPipe } from '../../shared/pipes/fifa-to-flag.pipe';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-prediccion-torneo',
  standalone: true,
  imports: [CommonModule, FormsModule, FifaToFlagPipe],
  templateUrl: './prediccion-torneo.component.html',
  styleUrls: ['./prediccion-torneo.component.scss']
})
export class PrediccionTorneoComponent implements OnInit {

  paises: Pais[] = [];
  jugadores: Jugador[] = [];
  jugadoresFiltrados: Jugador[] = [];

  prediccion: PrediccionTorneo | null = null;

  paisCampeonId: number | null = null;
  jugadorGoleadorId: number | null = null;
  busquedaJugador = '';

  loading = true;
  saving = false;
  msg = '';
  error = '';
  mostrarFormulario = false;

  constructor(
    private countriesService: CountriesService,
    private playersService: PlayersService,
    private prediccionService: PrediccionTorneoService
  ) {}

  ngOnInit(): void {
    forkJoin({
      paises: this.countriesService.getPaises(),
      jugadores: this.playersService.getJugadores(),
      prediccion: this.prediccionService.getMiPrediccion()
    }).subscribe({
      next: ({ paises, jugadores, prediccion }) => {
        this.paises = paises
          .filter(p => p.activo)
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        this.jugadores = jugadores.sort((a, b) =>
          a.apellido.localeCompare(b.apellido)
        );
        this.jugadoresFiltrados = this.jugadores;

        if (prediccion) {
          this.prediccion = prediccion;
          this.paisCampeonId = prediccion.paisCampeonId;
          this.jugadorGoleadorId = prediccion.jugadorGoleadorId;
          this.mostrarFormulario = false;
        } else {
          this.mostrarFormulario = true;
        }
        this.loading = false;
      },
      error: () => {
        this.error = 'Error al cargar datos';
        this.loading = false;
      }
    });
  }

  filtrarJugadores(): void {
    const term = normalize(this.busquedaJugador.trim());
    if (!term) {
      this.jugadoresFiltrados = this.jugadores;
      return;
    }
    this.jugadoresFiltrados = this.jugadores.filter(j =>
      normalize(j.nombreCompleto).includes(term) ||
      normalize(j.pais.nombre).includes(term) ||
      normalize(j.pais.codigo).includes(term)
    );
  }

  get paisSeleccionado(): Pais | null {
    return this.paises.find(p => p.internalId === this.paisCampeonId) || null;
  }

  get jugadorSeleccionado(): Jugador | null {
    return this.jugadores.find(j => j.internalId === this.jugadorGoleadorId) || null;
  }

  get formularioValido(): boolean {
    return this.paisCampeonId !== null && this.jugadorGoleadorId !== null;
  }

  get esConfirmada(): boolean {
    return this.prediccion?.confirmada === true;
  }

  guardar(): void {
    if (!this.formularioValido || this.esConfirmada) return;

    this.saving = true;
    this.msg = '';
    this.error = '';

    this.prediccionService.guardar({
      paisCampeonId: this.paisCampeonId!,
      jugadorGoleadorId: this.jugadorGoleadorId!
    }).subscribe({
      next: (result) => {
        this.prediccion = result;
        this.saving = false;
        this.mostrarFormulario = false;
        this.msg = 'Predicción guardada correctamente';
        setTimeout(() => this.msg = '', 4000);
      },
      error: (err) => {
        this.saving = false;
        this.error = err.error?.message || err.error?.error || 'Error al guardar la predicción';
        setTimeout(() => this.error = '', 5000);
      }
    });
  }
}
