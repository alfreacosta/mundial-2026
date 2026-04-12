import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CountriesService, Pais } from '../../core/services/countries.service';
import { PlayersService, JugadorBusqueda } from '../../core/services/players.service';
import { PrediccionTorneoService, PrediccionTorneo } from '../../core/services/prediccion-torneo.service';
import { FifaToFlagPipe } from '../../shared/pipes/fifa-to-flag.pipe';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';

@Component({
  selector: 'app-prediccion-torneo',
  standalone: true,
  imports: [CommonModule, FormsModule, FifaToFlagPipe],
  templateUrl: './prediccion-torneo.component.html',
  styleUrls: ['./prediccion-torneo.component.scss']
})
export class PrediccionTorneoComponent implements OnInit, OnDestroy {

  paises: Pais[] = [];
  jugadoresFiltrados: JugadorBusqueda[] = [];

  prediccion: PrediccionTorneo | null = null;

  paisCampeonId: number | null = null;
  jugadorGoleadorId: number | null = null;
  busquedaJugador = '';
  buscandoJugadores = false;

  loading = true;
  saving = false;
  msg = '';
  error = '';
  mostrarFormulario = false;

  // Jugador seleccionado actualmente (para mostrar preview sin buscar)
  jugadorSeleccionadoCache: JugadorBusqueda | null = null;

  private searchSubject = new Subject<string>();
  private searchSub!: Subscription;

  constructor(
    private countriesService: CountriesService,
    private playersService: PlayersService,
    private prediccionService: PrediccionTorneoService
  ) {}

  ngOnInit(): void {
    // Configurar debounce para búsqueda de jugadores
    this.searchSub = this.searchSubject.pipe(
      debounceTime(800),
      distinctUntilChanged(),
      tap(() => this.buscandoJugadores = true),
      switchMap(term => this.playersService.buscarJugadores(term))
    ).subscribe({
      next: (jugadores) => {
        this.jugadoresFiltrados = jugadores;
        this.buscandoJugadores = false;
      },
      error: () => {
        this.jugadoresFiltrados = [];
        this.buscandoJugadores = false;
      }
    });

    // Cargar datos iniciales
    this.countriesService.getPaises().subscribe({
      next: (paises) => {
        this.paises = paises
          .filter(p => p.activo)
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
      }
    });

    this.prediccionService.getMiPrediccion().subscribe({
      next: (prediccion) => {
        if (prediccion) {
          this.prediccion = prediccion;
          this.paisCampeonId = prediccion.paisCampeonId;
          this.jugadorGoleadorId = prediccion.jugadorGoleadorId;
          if (prediccion.jugadorGoleadorId) {
            this.jugadorSeleccionadoCache = {
              internalId: prediccion.jugadorGoleadorId,
              nombre: '', apellido: '',
              nombreCompleto: prediccion.jugadorGoleadorNombre || '',
              posicionCodigo: '',
              paisNombre: '',
              paisCodigo: prediccion.jugadorGoleadorPaisCodigo || '',
              clubNombre: null,
              urlFoto: prediccion.jugadorGoleadorUrlFoto
            };
          }
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

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  onBusquedaChange(): void {
    const term = this.busquedaJugador.trim();
    if (term.length < 3) {
      this.jugadoresFiltrados = [];
      return;
    }
    this.searchSubject.next(term);
  }

  seleccionarJugador(j: JugadorBusqueda): void {
    this.jugadorGoleadorId = j.internalId;
    this.jugadorSeleccionadoCache = j;
  }

  limpiarJugador(): void {
    this.jugadorGoleadorId = null;
    this.jugadorSeleccionadoCache = null;
    this.busquedaJugador = '';
    this.jugadoresFiltrados = [];
  }

  limpiarCampeon(): void {
    this.paisCampeonId = null;
  }

  get paisSeleccionado(): Pais | null {
    return this.paises.find(p => p.internalId === this.paisCampeonId) || null;
  }

  get esConfirmada(): boolean {
    return this.prediccion?.confirmada === true;
  }

  guardar(): void {
    if (this.esConfirmada) return;

    this.saving = true;
    this.msg = '';
    this.error = '';

    this.prediccionService.guardar({
      paisCampeonId: this.paisCampeonId,
      jugadorGoleadorId: this.jugadorGoleadorId
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
