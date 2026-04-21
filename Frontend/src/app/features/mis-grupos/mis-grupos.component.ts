import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { GrupoService } from '../../core/services/grupo.service';
import { AuthService } from '../../core/services/auth.service';
import { Grupo, GrupoRow, TipoJuego, TIPO_JUEGO_DESC } from '../../core/models/grupo.models';
import { CrearGrupoComponent } from './crear-grupo/crear-grupo.component';
import { UnirseGrupoComponent } from './unirse-grupo/unirse-grupo.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-mis-grupos',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ClipboardModule,
    CrearGrupoComponent,
    UnirseGrupoComponent
  ],
  templateUrl: './mis-grupos.component.html',
  styleUrls: ['./mis-grupos.component.scss']
})
export class MisGruposComponent implements OnInit {
  grupos: Grupo[] = [];
  loading = true;
  error = '';
  currentUserId: number | null = null;

  showCrearModal = false;
  showUnirseModal = false;
  codigoInvitacionInicial = '';

  constructor(
    private grupoService: GrupoService,
    private authService: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUser()?.userId ?? null;
    this.cargarGrupos();
    // Si viene desde un link de invitación con ?codigo=XXXX
    const codigo = this.route.snapshot.queryParamMap.get('codigo');
    if (codigo) {
      this.codigoInvitacionInicial = codigo.toUpperCase();
      this.showUnirseModal = true;
    }
  }

  salirDeGrupo(id: number): void {
    if (!confirm('¿Querés salir de este grupo?')) return;
    this.grupoService.salirDeGrupo(id).subscribe({
      next: () => { this.grupos = this.grupos.filter(g => g.internalId !== id); },
      error: () => alert('No se pudo salir del grupo')
    });
  }

  getTipoJuegoDesc(tipo: TipoJuego | undefined): string {
    return TIPO_JUEGO_DESC[tipo ?? 'A'];
  }

  getTipoJuegoLabel(tipo: TipoJuego | undefined): string {
    return TIPO_JUEGO_DESC[tipo ?? 'A'];
  }

  cargarGrupos(): void {
    this.loading = true;
    this.error = '';
    this.grupoService.getMisGrupos().subscribe({
      next: (grupos) => {
        this.grupos = grupos;
        this.loading = false;
      },
      error: () => {
        this.error = 'Error al cargar tus grupos';
        this.loading = false;
      }
    });
  }

  onGrupoCreado(grupo: Grupo): void {
    this.showCrearModal = false;
    this.grupos = [grupo, ...this.grupos];
  }

  onGrupoUnido(_row: GrupoRow): void {
    this.showUnirseModal = false;
    this.cargarGrupos();
  }

  getWhatsAppLink(grupo: Grupo): string {
    const url = `${environment.appUrl}/grupo/${grupo.codigoInvitacion}`;
    const quien = this.authService.getCurrentUser()?.user ?? 'Un usuario';
    const text = `⚽ DT26 - Mundial 2026 ⚽\n\n"${quien}" te invita a unirte a una competencia privada de DT26.\nElegí tus selecciones favoritas, armá tu equipo ideal, predecí resultados del mundial y competí con tus amigos para demostrar que sos el que más sabe de fútbol.\n\n${url}\n\nCódigo de competencia: ${grupo.codigoInvitacion}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }
}
