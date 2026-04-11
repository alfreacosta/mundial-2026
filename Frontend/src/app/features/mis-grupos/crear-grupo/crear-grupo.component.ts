import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GrupoService } from '../../../core/services/grupo.service';
import { Grupo } from '../../../core/models/grupo.models';

@Component({
  selector: 'app-crear-grupo',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './crear-grupo.component.html',
  styleUrls: ['./crear-grupo.component.scss']
})
export class CrearGrupoComponent {

  @Output() grupoCreado = new EventEmitter<Grupo>();
  @Output() cancelar = new EventEmitter<void>();

  nombre = '';
  premio = '';
  loading = false;
  error = '';
  grupoNuevo: Grupo | null = null;

  constructor(private grupoService: GrupoService) {}

  crear(): void {
    if (!this.nombre.trim()) return;

    this.loading = true;
    this.error = '';

    this.grupoService.crearGrupo({
      nombre: this.nombre.trim(),
      premio: this.premio.trim() || undefined
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
