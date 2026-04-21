import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GrupoService } from '../../core/services/grupo.service';
import { Grupo, GrupoRow, TIPO_JUEGO_DESC, TipoJuego } from '../../core/models/grupo.models';
import { FifaToFlagPipe } from '../../shared/pipes/fifa-to-flag.pipe';
import { AvatarIconComponent } from '../../shared/components/avatar-icon/avatar-icon.component';

@Component({
  selector: 'app-detalle-grupo',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule, FifaToFlagPipe, AvatarIconComponent],
  templateUrl: './detalle-grupo.component.html',
  styleUrls: ['./detalle-grupo.component.scss']
})
export class DetalleGrupoComponent implements OnInit {

  grupo: Grupo | null = null;
  loading = true;
  error = '';
  copiado = false;
  vistaTabla = true;
  brokenAvatars = new Set<number>();

  constructor(
    private route: ActivatedRoute,
    private grupoService: GrupoService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.cargarDetalle(id);
  }

  cargarDetalle(id: number): void {
    this.loading = true;
    this.grupoService.getDetalleGrupo(id).subscribe({
      next: (g) => {
        this.grupo = g;
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el grupo';
        this.loading = false;
      }
    });
  }

  copiarCodigo(): void {
    if (!this.grupo) return;
    navigator.clipboard.writeText(this.grupo.codigoInvitacion).then(() => {
      this.copiado = true;
      setTimeout(() => (this.copiado = false), 2000);
    });
  }

  compartirWhatsApp(): void {
    if (!this.grupo) return;
    const url    = `${window.location.origin}/grupo/${this.grupo.codigoInvitacion}`;
    const quien  = this.grupo.creadorNombre || 'Un usuario';
    const texto  = `⚽ *DT26 - Mundial 2026* ⚽\n\n"${quien}" te invita a unirte a una competencia privada de DT26.\nElegí tus selecciones favoritas, armá tu equipo ideal, predecí resultados del mundial y competí con tus amigos para demostrar que sos el que más sabe de fútbol.\n\n${url}\n\nCódigo de competencia: *${this.grupo.codigoInvitacion}*`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
  }

  getTipoJuegoDesc(tipo: string | undefined): string {
    return TIPO_JUEGO_DESC[(tipo ?? 'A') as TipoJuego] ?? 'Convocatoria + Predicciones';
  }

  onAvatarError(id: number): void { this.brokenAvatars.add(id); }

  getIniciales(nombre: string | null, apellido: string | null): string {
    const n = (nombre?.[0] || '').toUpperCase();
    const a = (apellido?.[0] || '').toUpperCase();
    return n + a || '?';
  }

  get miembrosOrdenados(): GrupoRow[] {
    if (!this.grupo?.miembros) return [];
    return [...this.grupo.miembros].sort((a, b) => (b.puntaje ?? 0) - (a.puntaje ?? 0));
  }

  trackByRow(index: number, row: GrupoRow): number {
    return row.internalId;
  }
}
