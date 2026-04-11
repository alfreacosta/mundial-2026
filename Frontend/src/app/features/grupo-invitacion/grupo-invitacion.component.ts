import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GrupoService } from '../../core/services/grupo.service';
import { AuthService } from '../../core/services/auth.service';
import { Grupo, GrupoRow } from '../../core/models/grupo.models';
import { Router } from '@angular/router';
import { AvatarIconComponent } from '../../shared/components/avatar-icon/avatar-icon.component';

@Component({
  selector: 'app-grupo-invitacion',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatProgressSpinnerModule, AvatarIconComponent],
  templateUrl: './grupo-invitacion.component.html',
  styleUrls: ['./grupo-invitacion.component.scss']
})
export class GrupoInvitacionComponent implements OnInit {

  grupo: Grupo | null = null;
  loading = true;
  error = '';
  codigoParam = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private grupoService: GrupoService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.codigoParam = this.route.snapshot.paramMap.get('codigo') || '';
    if (!this.codigoParam) {
      this.error = 'Código de invitación no válido';
      this.loading = false;
      return;
    }
    this.cargarPreview();
  }

  cargarPreview(): void {
    this.loading = true;
    this.grupoService.getPreviewPublico(this.codigoParam).subscribe({
      next: (g) => {
        this.grupo = g;
        this.loading = false;
      },
      error: () => {
        this.error = 'Grupo no encontrado o el código de invitación expiró';
        this.loading = false;
      }
    });
  }

  /** Muestra hasta 4 avatares para el stack visual */
  get miembrosPreview(): GrupoRow[] {
    if (!this.grupo?.miembros) return [];
    return this.grupo.miembros.slice(0, 4);
  }

  unirseAlGrupo(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/mis-grupos'], { queryParams: { codigo: this.codigoParam } });
    } else {
      this.router.navigate(['/register'], { queryParams: { returnUrl: '/grupo/' + this.codigoParam } });
    }
  }

  getIniciales(nombre: string | null, apellido: string | null): string {
    const n = (nombre?.[0] || '').toUpperCase();
    const a = (apellido?.[0] || '').toUpperCase();
    return n + a || '?';
  }
}
