import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { GrupoService } from '../../core/services/grupo.service';
import { EquipoFavorito } from '../../core/models/grupo.models';
import { PrediccionTorneoService, PrediccionTorneo } from '../../core/services/prediccion-torneo.service';
import { CountriesService, ConvocatoriaResponse } from '../../core/services/countries.service';
import { MisFavoritosComponent } from './mis-favoritos/mis-favoritos.component';
import { Usuario } from '../../core/models/auth.models';
import { getFlagUrl } from '../../core/utils/flag.utils';
import { environment } from '../../../environments/environment';

export interface DtAvatar {
  codigo: string;
  pais: string;
  dtNombre: string;
  dtFotoUrl: string;
  logoUrl: string;
}



@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MisFavoritosComponent],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.scss']
})
export class PerfilComponent implements OnInit {
  getFlagUrl = getFlagUrl;
  user: Usuario | null = null;
  profileForm!: FormGroup;
  passwordForm!: FormGroup;

  selectedAvatar: string | null = null;

  saving = false;
  changingPassword = false;
  profileMsg = '';
  profileError = '';
  passwordMsg = '';
  passwordError = '';

  showPasswordSection = false;

  perfilPublico = true;
  perfilPublicoMsg = '';

  // Tabs: 'mi-juego' | 'mi-perfil' | 'editar'
  tab: 'mi-juego' | 'mi-perfil' | 'editar' = 'mi-juego';

  // Datos del juego
  misFavoritos: EquipoFavorito[] = [];
  miPrediccion: PrediccionTorneo | null = null;
  convocatorias: Map<number, ConvocatoriaResponse> = new Map();
  datosJuegoLoading = false;

  // Expandir convocados inline
  convocadosExpandidos = new Set<number>();
  jugadoresPorEquipo = new Map<number, any[]>();
  loadingConvocados = new Set<number>();

  // DT Avatars
  dtAvatars: DtAvatar[] = [];
  dtAvatarsLoading = false;

  constructor(
    private auth: AuthService,
    private fb: FormBuilder,
    private grupoService: GrupoService,
    private prediccionService: PrediccionTorneoService,
    private countriesService: CountriesService,
    private http: HttpClient
  ) {}

  logout(): void {
    this.auth.logout();
  }

  ngOnInit(): void {
    this.user = this.auth.getCurrentUser();
    this.perfilPublico = (this.user as any)?.perfilPublico ?? true;

    this.profileForm = this.fb.group({
      nombre:   [this.user?.nombre || ''],
      apellido: [this.user?.apellido || ''],
      telefono: [this.user?.telefono || '']
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword:     ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    });

    this.selectedAvatar = this.user?.urlAvatar || null;

    // Cargar DT avatars y datos del juego
    this.loadDtAvatars();
    this.cargarDatosJuego();
  }

  private cargarDatosJuego(): void {
    this.datosJuegoLoading = true;

    forkJoin({
      favoritos: this.grupoService.getMisFavoritos(),
      prediccion: this.prediccionService.getMiPrediccion()
    }).subscribe({
      next: ({ favoritos, prediccion }) => {
        this.misFavoritos = favoritos;
        this.miPrediccion = prediccion;

        // Cargar convocatorias de cada equipo favorito
        if (favoritos.length > 0) {
          const convocatoriasObs = favoritos.map(fav =>
            this.countriesService.getMiConvocatoria(fav.paisId)
          );

          forkJoin(convocatoriasObs).subscribe({
            next: (convResList) => {
              this.convocatorias.clear();
              favoritos.forEach((fav, idx) => {
                const conv = convResList[idx];
                if (conv) {
                  this.convocatorias.set(fav.paisId, conv);
                }
              });
              this.datosJuegoLoading = false;
            },
            error: () => {
              this.datosJuegoLoading = false;
            }
          });
        } else {
          this.datosJuegoLoading = false;
        }
      },
      error: () => {
        this.datosJuegoLoading = false;
      }
    });
  }

  getConvocatoriaProgress(paisId: number): { total: number; max: number } {
    const conv = this.convocatorias.get(paisId);
    return { total: conv?.totalJugadores ?? 0, max: 26 };
  }

  selectAvatar(avatar: string): void {
    this.selectedAvatar = avatar;
  }

  private loadDtAvatars(): void {
    this.dtAvatarsLoading = true;
    this.http.get<DtAvatar[]>(`${environment.apiUrl}/selecciones/dt-avatars`).subscribe({
      next: (data) => {
        this.dtAvatars = data;
        this.dtAvatarsLoading = false;
      },
      error: () => {
        this.dtAvatarsLoading = false;
      }
    });
  }

  get avatarInitials(): string {
    const n = this.user?.nombre?.[0] || '';
    const a = this.user?.apellido?.[0] || '';
    return (n + a).toUpperCase() || this.user?.user?.[0]?.toUpperCase() || '?';
  }

  saveProfile(): void {
    this.saving = true;
    this.profileMsg = '';
    this.profileError = '';

    const data = {
      nombre:    this.profileForm.value.nombre,
      apellido:  this.profileForm.value.apellido,
      telefono:  this.profileForm.value.telefono,
      urlAvatar: this.selectedAvatar || undefined
    };

    this.auth.updateProfile(data).subscribe({
      next: () => {
        this.saving = false;
        this.profileMsg = 'Perfil actualizado correctamente';
        this.user = this.auth.getCurrentUser();
      },
      error: (err) => {
        this.saving = false;
        this.profileError = err.error?.error || 'Error al actualizar el perfil';
      }
    });
  }

  changePassword(): void {
    if (this.passwordForm.value.newPassword !== this.passwordForm.value.confirmPassword) {
      this.passwordError = 'Las contraseñas no coinciden';
      return;
    }

    this.changingPassword = true;
    this.passwordMsg = '';
    this.passwordError = '';

    this.auth.changePassword({
      currentPassword: this.passwordForm.value.currentPassword,
      newPassword: this.passwordForm.value.newPassword
    }).subscribe({
      next: () => {
        this.changingPassword = false;
        this.passwordMsg = 'Contraseña actualizada correctamente';
        this.passwordForm.reset();
      },
      error: (err) => {
        this.changingPassword = false;
        this.passwordError = err.error?.error || 'Error al cambiar la contraseña';
      }
    });
  }

  onTogglePerfilPublico(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.grupoService.togglePerfilPublico(checked).subscribe({
      next: () => {
        this.perfilPublico = checked;
        this.perfilPublicoMsg = checked ? 'Perfil ahora es público' : 'Perfil ahora es privado';
        setTimeout(() => this.perfilPublicoMsg = '', 3000);
      },
      error: () => {
        (event.target as HTMLInputElement).checked = !checked;
      }
    });
  }

  toggleConvocados(paisId: number): void {
    if (this.convocadosExpandidos.has(paisId)) {
      this.convocadosExpandidos.delete(paisId);
      return;
    }
    if (this.jugadoresPorEquipo.has(paisId)) {
      this.convocadosExpandidos.add(paisId);
      return;
    }
    this.loadingConvocados.add(paisId);
    const conv = this.convocatorias.get(paisId);
    const convIds = new Set<number>(conv?.jugadoresIds ?? []);
    this.countriesService.getJugadoresPorPais(paisId).subscribe({
      next: jugadores => {
        const convocados = jugadores
          .filter(j => convIds.has(j.internalId))
          .sort((a, b) => {
            const order: Record<string, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3 };
            return (order[a.posicion?.abreviatura ?? ''] ?? 9) - (order[b.posicion?.abreviatura ?? ''] ?? 9);
          });
        this.jugadoresPorEquipo.set(paisId, convocados);
        this.convocadosExpandidos.add(paisId);
        this.loadingConvocados.delete(paisId);
      },
      error: () => this.loadingConvocados.delete(paisId)
    });
  }
}
