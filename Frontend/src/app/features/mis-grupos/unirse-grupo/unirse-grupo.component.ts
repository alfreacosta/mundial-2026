import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GrupoService } from '../../../core/services/grupo.service';
import { GrupoRow } from '../../../core/models/grupo.models';

@Component({
  selector: 'app-unirse-grupo',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './unirse-grupo.component.html',
  styleUrls: ['./unirse-grupo.component.scss']
})
export class UnirseGrupoComponent implements OnInit {

  @Output() grupoUnido = new EventEmitter<GrupoRow>();
  @Output() cancelar = new EventEmitter<void>();
  @Input() codigoInicial = '';

  codigoInvitacion = '';
  loading = false;
  error = '';

  constructor(private grupoService: GrupoService) {}

  ngOnInit(): void {
    if (this.codigoInicial) {
      this.codigoInvitacion = this.codigoInicial;
    }
  }

  unirse(): void {
    if (!this.codigoInvitacion.trim()) return;

    this.loading = true;
    this.error = '';

    this.grupoService.unirseAlGrupo({
      codigoInvitacion: this.codigoInvitacion.trim().toUpperCase()
    }).subscribe({
      next: (row) => {
        this.loading = false;
        this.grupoUnido.emit(row);
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudo unir al grupo. Verificá el código.';
        this.loading = false;
      }
    });
  }
}
