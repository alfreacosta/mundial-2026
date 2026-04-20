import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { CdkDrag, CdkDragEnd } from '@angular/cdk/drag-drop';
import { forkJoin, Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { PitchThreeDComponent } from './pitch-3d/pitch-3d.component';
import { Pitch3dViewComponent } from './pitch3d-view/pitch3d-view.component';
import { CountriesService, Pais, JugadorPais } from '../../core/services/countries.service';
import { GrupoService } from '../../core/services/grupo.service';
import { AuthService } from '../../core/services/auth.service';
import { normalize } from '../../shared/utils/normalize';
import { environment } from '../../../environments/environment';
import html2canvas from 'html2canvas';

export interface PlayerStats {
  altura: string;
  peso: string;
  nacimiento: string;
  lugar_nacimiento: string;
  nacionalidad: string;
  club: string;
  club_logo: string;
  liga: string;
  temporada: string;
  partidos: number;
  minutos: number;
  rating: string;
  goles: number;
  asistencias: number;
  disparos: number;
  disparos_arco: number;
  pases_clave: number;
  regates_ok: number;
  regates_int: number;
  amarillas: number;
  rojas: number;
}

export interface JugadorSeleccionable extends JugadorPais {
  seleccionado: boolean;
  noVa: boolean;
  titular: boolean;
}

interface PosicionGroup {
  codigo: string;
  label: string;
  icon: string;
  color: string;
  recommended: number;
}

@Component({
  selector: 'app-convocados',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatBadgeModule,
    RouterLink,
    CdkDrag,
    PitchThreeDComponent,
    Pitch3dViewComponent,
    UpperCasePipe
  ],
  templateUrl: './convocados.component.html',
  styleUrls: ['./convocados.component.scss']
})
export class ConvocadosComponent implements OnInit, OnDestroy {
  paisId!: number;
  pais: Pais | null = null;
  players = signal<JugadorSeleccionable[]>([]);
  loading = true;
  error = '';
  saving = false;
  savingPositions = false;
  convocatoriaEstado: string | null = null;
  noEsFavorito = false;
  searchQuery = '';
  activeTab = signal<'convocatoria' | 'titulares' | 'nova' | 'vista3d'>('convocatoria');

  private readonly autoSave$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  /** Posiciones guardadas (porcentaje): jugadorId → {x%, y%} */
  savedPositions = new Map<number, { x: number; y: number }>();
  /** Posiciones modificadas por drag pendientes de guardar (porcentaje) */
  draggedPositions = new Map<number, { x: number; y: number }>();
  /** Cache de posiciones en píxeles para cdkDragFreeDragPosition (evita recrear objetos) */
  private _dragPxCache = new Map<number, { x: number; y: number }>();
  private static readonly ZERO_POS: { x: number; y: number } = { x: -999, y: -999 };

  /** Cache de ratings ya consultados: internalId → rating string */
  ratingCache = new Map<number, string>();

  // Computed signals — se actualizan AUTOMATICAMENTE cuando players cambia
  readonly totalSel = computed(() => this.players().filter(p => p.seleccionado).length);
  readonly totalNoVa = computed(() => this.players().filter(p => p.noVa).length);
  readonly totalTitulares = computed(() => this.players().filter(p => p.titular).length);
  readonly posCounts = computed(() => {
    const map: Record<string, number> = {};
    for (const p of this.players()) {
      if (p.seleccionado && p.posicion?.codigo) {
        const c = p.posicion.codigo;
        map[c] = (map[c] || 0) + 1;
      }
    }
    return map;
  });
  readonly titularPosCounts = computed(() => {
    const map: Record<string, number> = {};
    for (const p of this.players()) {
      if (p.titular && p.posicion?.codigo) {
        map[p.posicion.codigo] = (map[p.posicion.codigo] || 0) + 1;
      }
    }
    return map;
  });

  readonly MAX_CONVOCADOS = 26;

  readonly positionGroups: PosicionGroup[] = [
    { codigo: 'ARQ', label: 'Porteros',        icon: 'sports_handball', color: '#f59e0b', recommended: 3 },
    { codigo: 'DEF', label: 'Defensores',       icon: 'shield',          color: '#3b82f6', recommended: 8 },
    { codigo: 'MED', label: 'Mediocampistas',   icon: 'sync_alt',        color: '#10b981', recommended: 8 },
    { codigo: 'DEL', label: 'Delanteros',       icon: 'sports_soccer',   color: '#f97316', recommended: 7 },
  ];

  private readonly CONF_COLORS: Record<string, string> = {
    UEFA: '#1a56db', CONMEBOL: '#b45309', CONCACAF: '#b91c1c',
    CAF: '#065f46', AFC: '#6d28d9', OFC: '#0e7490'
  };

  /** Colores primario/secundario de cada bandera (para las figuritas del plantel) */
  readonly FLAG_COLORS: Record<string, { primary: string; secondary: string }> = {
    'ARG': { primary: '#74ACDF', secondary: '#FFFFFF' },
    'BRA': { primary: '#009C3B', secondary: '#FFDF00' },
    'URU': { primary: '#5EB6E4', secondary: '#FFFFFF' },
    'COL': { primary: '#FCD116', secondary: '#003893' },
    'CHI': { primary: '#D52B1E', secondary: '#FFFFFF' },
    'PAR': { primary: '#D52B1E', secondary: '#0038A8' },
    'ECU': { primary: '#FFD100', secondary: '#003893' },
    'BOL': { primary: '#D52B1E', secondary: '#F4E400' },
    'PER': { primary: '#D91023', secondary: '#FFFFFF' },
    'VEN': { primary: '#CF142B', secondary: '#003893' },
    'GER': { primary: '#DD0000', secondary: '#FFCE00' },
    'ENG': { primary: '#CF142B', secondary: '#FFFFFF' },
    'FRA': { primary: '#002395', secondary: '#ED2939' },
    'ESP': { primary: '#AA151B', secondary: '#F1BF00' },
    'ITA': { primary: '#009246', secondary: '#CE2B37' },
    'POR': { primary: '#006600', secondary: '#FF0000' },
    'NED': { primary: '#AE1C28', secondary: '#21468B' },
    'BEL': { primary: '#000000', secondary: '#EF3340' },
    'SUI': { primary: '#FF0000', secondary: '#FFFFFF' },
    'AUT': { primary: '#ED2939', secondary: '#FFFFFF' },
    'CRO': { primary: '#FF0000', secondary: '#003087' },
    'SVN': { primary: '#003DA5', secondary: '#E40422' },
    'DEN': { primary: '#C60C30', secondary: '#FFFFFF' },
    'SWE': { primary: '#006AA7', secondary: '#FECC02' },
    'NOR': { primary: '#EF2B2D', secondary: '#002868' },
    'ISL': { primary: '#003897', secondary: '#DC1E35' },
    'TUR': { primary: '#E30A17', secondary: '#FFFFFF' },
    'POL': { primary: '#DC143C', secondary: '#FFFFFF' },
    'ROU': { primary: '#002B7F', secondary: '#FCD116' },
    'HUN': { primary: '#CE2939', secondary: '#477050' },
    'GRE': { primary: '#0D5EAF', secondary: '#FFFFFF' },
    'SRB': { primary: '#C6363C', secondary: '#0C4076' },
    'CZE': { primary: '#D7141A', secondary: '#11457E' },
    'SVK': { primary: '#EE1C25', secondary: '#0B4EA2' },
    'UKR': { primary: '#005BBB', secondary: '#FFD500' },
    'ALB': { primary: '#E41E20', secondary: '#000000' },
    'MKD': { primary: '#CE2028', secondary: '#F7A600' },
    'MNE': { primary: '#D4AF37', secondary: '#C8463A' },
    'BIH': { primary: '#002395', secondary: '#FFFF00' },
    'GEO': { primary: '#DA121A', secondary: '#FFFFFF' },
    'USA': { primary: '#B22234', secondary: '#3C3B6E' },
    'MEX': { primary: '#006847', secondary: '#CE1126' },
    'CAN': { primary: '#FF0000', secondary: '#FFFFFF' },
    'CRC': { primary: '#002B7F', secondary: '#CE1126' },
    'HON': { primary: '#0073CF', secondary: '#FFFFFF' },
    'PAN': { primary: '#005293', secondary: '#D21034' },
    'SLV': { primary: '#0F47AF', secondary: '#FFFFFF' },
    'TRI': { primary: '#CE1126', secondary: '#000000' },
    'JAM': { primary: '#000000', secondary: '#FED100' },
    'HAI': { primary: '#00209F', secondary: '#D21034' },
    'GUA': { primary: '#4997D0', secondary: '#FFFFFF' },
    'CUW': { primary: '#003DA5', secondary: '#F9E814' },
    'MAR': { primary: '#C1272D', secondary: '#006233' },
    'SEN': { primary: '#00853F', secondary: '#EAE011' },
    'NGA': { primary: '#008751', secondary: '#FFFFFF' },
    'GHA': { primary: '#006B3F', secondary: '#FCD116' },
    'CMR': { primary: '#007A5E', secondary: '#CE1126' },
    'CIV': { primary: '#F77F00', secondary: '#009A44' },
    'EGY': { primary: '#CE1126', secondary: '#FFFFFF' },
    'TUN': { primary: '#E70013', secondary: '#FFFFFF' },
    'ALG': { primary: '#006233', secondary: '#D21034' },
    'RSA': { primary: '#007A4D', secondary: '#FFB81C' },
    'COD': { primary: '#007FFF', secondary: '#F7D618' },
    'CPV': { primary: '#003893', secondary: '#CF2027' },
    'JPN': { primary: '#BC002D', secondary: '#FFFFFF' },
    'KOR': { primary: '#CD2E3A', secondary: '#003478' },
    'IRN': { primary: '#239F40', secondary: '#DA0000' },
    'SAU': { primary: '#006C35', secondary: '#FFFFFF' },
    'AUS': { primary: '#003087', secondary: '#FF0000' },
    'QAT': { primary: '#8D1B3D', secondary: '#FFFFFF' },
    'IRQ': { primary: '#CE1126', secondary: '#007A3D' },
    'JOR': { primary: '#007A3D', secondary: '#CE1126' },
    'UZB': { primary: '#1EB53A', secondary: '#CE1126' },
    'CHN': { primary: '#DE2910', secondary: '#FFDE00' },
    'NZL': { primary: '#003087', secondary: '#CC142B' },
    'FIJ': { primary: '#68BFE5', secondary: '#003087' },
  };

  getFlagColors(): { primary: string; secondary: string } {
    const code = this.pais?.codigo?.toUpperCase() ?? '';
    return this.FLAG_COLORS[code] ?? { primary: this.confColor, secondary: '#FFFFFF' };
  }

  downloadingPlantel = false;

  // ── Figurita seleccionada (para mostrar botones Titular/Stats) ──
  figuritaSeleccionada: number | null = null;

  selectFigurita(player: JugadorSeleccionable): void {
    if (this.figuritaSeleccionada === player.internalId) {
      this.figuritaSeleccionada = null;
    } else {
      this.figuritaSeleccionada = player.internalId;
      // Scroll suave hacia la figurita seleccionada
      setTimeout(() => {
        const el = document.querySelector('.figurita.selected');
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }, 50);
    }
  }

  compartirPlantel(): void {
    const el = document.getElementById('plantel-album');
    if (!el) {
      this.snackBar.open('No se encontró el elemento del plantel.', '', { duration: 3000, panelClass: 'snack-error' });
      return;
    }
    this.downloadingPlantel = true;

    import('html2canvas').then(({ default: h2c }) => {
      h2c(el, {
        backgroundColor: '#0a0e17',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 10000,
        onclone: (_doc: Document, cloned: HTMLElement) => {
          // Asegurar fondo visible en el clon
          cloned.style.background = '#0a0e17';
        }
      } as any).then((canvas: HTMLCanvasElement) => {
        const paisNombre = this.pais?.nombre ?? 'mi selección';
        const shareText = `🏆 Este es mi plantel de ${paisNombre} para el Mundial 2026!\n\n` +
          `Armá tu convocatoria ideal en 👉 https://dt26.win\n` +
          `Elegí tus selecciones, armá los 26 y competí con tus amigos.`;

        canvas.toBlob(blob => {
          if (!blob) {
            this.snackBar.open('Error generando imagen. Intentá de nuevo.', '', { duration: 3000, panelClass: 'snack-error' });
            this.downloadingPlantel = false;
            return;
          }
          const fileName = `Plantel-${paisNombre}.png`;
          const file = new File([blob], fileName, { type: 'image/png' });

          if (navigator.share && navigator.canShare?.({ files: [file] })) {
            navigator.share({ files: [file], title: `Mi Plantel - ${paisNombre}`, text: shareText })
              .catch(() => this.downloadPlantelCanvas(canvas, paisNombre))
              .finally(() => { this.downloadingPlantel = false; });
          } else {
            this.downloadPlantelCanvas(canvas, paisNombre);
            this.downloadingPlantel = false;
          }
        }, 'image/png');
      }).catch((err: unknown) => {
        console.error('html2canvas error:', err);
        this.snackBar.open('Error al generar la imagen. Intentá de nuevo.', '', { duration: 3000, panelClass: 'snack-error' });
        this.downloadingPlantel = false;
      });
    }).catch((err: unknown) => {
      console.error('Error cargando html2canvas:', err);
      this.snackBar.open('Error cargando dependencia.', '', { duration: 3000, panelClass: 'snack-error' });
      this.downloadingPlantel = false;
    });
  }

  private downloadPlantelCanvas(canvas: HTMLCanvasElement, paisNombre: string): void {
    const link = document.createElement('a');
    link.download = `Plantel-${paisNombre}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  /** Genera imagen con grid plano 7×4: 26 jugadores + 1 vacío + DT */
  compartirPlantelGrid(): void {
    const todos = this.jugadoresSeleccionados;
    if (todos.length === 0) return;
    this.downloadingPlantel = true;

    const paisNombre = this.pais?.nombre ?? 'Mi Selección';
    const usuario    = this.currentUsername ?? 'dt26';
    const DPR  = 2;
    const COLS = 7;
    const ROWS = 4;

    // Dimensiones por figurita
    const CARD_W = 120 * DPR;
    const CARD_H = 112 * DPR;   // reducido: corta justo después del club
    const GAP    = 8   * DPR;
    const PAD    = 16  * DPR;
    const HEADER = 64  * DPR;

    const FOOTER   = 64  * DPR;
    const CANVAS_W = PAD * 2 + COLS * CARD_W + (COLS - 1) * GAP;
    const CANVAS_H = PAD * 2 + HEADER + ROWS * CARD_H + (ROWS - 1) * GAP + FOOTER;

    // Ordenar: ARQ, DEF, MED, DEL
    const POS_ORDER: Record<string, number> = { ARQ: 0, DEF: 1, MED: 2, DEL: 3 };
    const sorted = [...todos].sort((a, b) => {
      const ao = POS_ORDER[a.posicion?.codigo ?? ''] ?? 4;
      const bo = POS_ORDER[b.posicion?.codigo ?? ''] ?? 4;
      return ao !== bo ? ao - bo : a.apellido.localeCompare(b.apellido);
    });

    // Grid plano 28 slots: 26 jugadores + DT + BRAND
    const grid: Array<typeof sorted[0] | 'DT' | 'BRAND' | null> = [];
    for (let i = 0; i < 26; i++) grid.push(sorted[i] ?? null);
    grid.push('DT');    // slot 27
    grid.push('BRAND'); // slot 28 — celda dt26.win

    const cvs = document.createElement('canvas');
    cvs.width  = CANVAS_W;
    cvs.height = CANVAS_H;
    const ctx  = cvs.getContext('2d')!;

    // Colores de pos
    const POS_COLOR: Record<string, string> = { ARQ: '#f59e0b', DEF: '#3b82f6', MED: '#10b981', DEL: '#ef4444' };
    const getPosColor = (code: string) => POS_COLOR[code] ?? '#94a3b8';

    // Fondo
    const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bg.addColorStop(0, '#0a0e17');
    bg.addColorStop(1, '#111827');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y,     x + w, y + r,     r);
      ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h); ctx.arcTo(x,     y + h, x,     y + h - r, r);
      ctx.lineTo(x, y + r);     ctx.arcTo(x,     y,     x + r, y,         r);
      ctx.closePath();
    };

    // ── Header de 3 columnas ─────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, 0, CANVAS_W, HEADER + PAD);

    const headerMidY = (HEADER + PAD) / 2;
    const sideW = CANVAS_W * 0.28;

    // Izquierda: usuario
    ctx.font = `bold ${13 * DPR}px Arial`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`usuario: ${usuario}`, PAD + 4 * DPR, headerMidY);

    // Derecha: www.dt26.win
    ctx.font = `bold ${13 * DPR}px Arial`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('www.dt26.win', CANVAS_W - PAD - 4 * DPR, headerMidY);

    // Centro: texto principal (dos líneas si hace falta)
    const centroText = `Esta es mi lista de convocados de ${paisNombre.toUpperCase()}`;
    const subText    = 'para el Mundial 2026';
    ctx.font = `bold ${14 * DPR}px Arial`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(centroText, CANVAS_W / 2, headerMidY - 9 * DPR, CANVAS_W - sideW * 2 - PAD * 4);
    ctx.font = `${12 * DPR}px Arial`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(subText, CANVAS_W / 2, headerMidY + 9 * DPR);

    // Función para dibujar slot vacío
    const drawEmpty = (cardX: number, cardY: number) => {
      ctx.save();
      drawRoundRect(cardX, cardY, CARD_W, CARD_H, 6 * DPR);
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1.5 * DPR;
      ctx.setLineDash([6 * DPR, 4 * DPR]);
      ctx.stroke();
      ctx.restore();
      ctx.font = `${28 * DPR}px Arial`;
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', cardX + CARD_W / 2, cardY + CARD_H / 2);
    };

    // Función para dibujar jugador (sin borde de color titular — solo estrella)
    const drawCard = (player: (typeof sorted)[0], cardX: number, cardY: number, img: HTMLImageElement | null) => {
      const color = getPosColor(player.posicion?.codigo ?? '');
      drawRoundRect(cardX, cardY, CARD_W, CARD_H, 6 * DPR);
      ctx.fillStyle = '#1a2035'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1 * DPR;
      ctx.stroke();

      const photoH = Math.round(CARD_H * 0.72);
      ctx.save();
      drawRoundRect(cardX, cardY, CARD_W, photoH, 6 * DPR); ctx.clip();
      if (img) {
        const scale = CARD_W / img.naturalWidth;
        const drawH = img.naturalHeight * scale;
        const dy    = drawH > photoH ? -(drawH - photoH) * 0.15 : 0;
        ctx.drawImage(img, cardX, cardY + dy, CARD_W, drawH);
      } else {
        ctx.fillStyle = color + '33'; ctx.fillRect(cardX, cardY, CARD_W, photoH);
        ctx.font = `bold ${36 * DPR}px Arial`; ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((player.apellido || '?').charAt(0).toUpperCase(), cardX + CARD_W / 2, cardY + photoH / 2);
      }
      ctx.restore();

      // Badge posición
      const badgeY = cardY + photoH - 18 * DPR;
      ctx.fillStyle = color;
      drawRoundRect(cardX + 4 * DPR, badgeY, 28 * DPR, 16 * DPR, 4 * DPR);
      ctx.fill();
      ctx.font = `bold ${9 * DPR}px Arial`; ctx.fillStyle = '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(player.posicion?.codigo ?? '', cardX + 18 * DPR, badgeY + 8 * DPR);

      // Estrella titular arriba-derecha (único indicador)
      if (player.titular) {
        ctx.font = `${14 * DPR}px Arial`; ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText('★', cardX + CARD_W - 4 * DPR, cardY + 4 * DPR);
      }

      // Nombre (primer apellido)
      const infoY = cardY + photoH + 4 * DPR;
      const apellido = (player.apellido?.split(' ')[0] ?? player.nombre ?? '').toUpperCase();
      ctx.font = `bold ${10 * DPR}px Arial`; ctx.fillStyle = '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(apellido, cardX + CARD_W / 2, infoY, CARD_W - 6 * DPR);

      // Club
      if (player.club?.nombre) {
        ctx.font = `${8 * DPR}px Arial`; ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText(player.club.nombre, cardX + CARD_W / 2, infoY + 13 * DPR, CARD_W - 6 * DPR);
      }
    };

    // Función para dibujar DT
    const drawDT = (cardX: number, cardY: number, dtImg: HTMLImageElement | null) => {
      const color = '#6366f1';
      drawRoundRect(cardX, cardY, CARD_W, CARD_H, 6 * DPR);
      ctx.fillStyle = '#1a2035'; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 2 * DPR; ctx.stroke();
      const photoH = Math.round(CARD_H * 0.72);
      ctx.save();
      drawRoundRect(cardX, cardY, CARD_W, photoH, 6 * DPR); ctx.clip();
      if (dtImg) {
        const scale = CARD_W / dtImg.naturalWidth;
        const drawH = dtImg.naturalHeight * scale;
        const dy    = drawH > photoH ? -(drawH - photoH) * 0.15 : 0;
        ctx.drawImage(dtImg, cardX, cardY + dy, CARD_W, drawH);
      } else {
        ctx.fillStyle = color + '33'; ctx.fillRect(cardX, cardY, CARD_W, photoH);
        ctx.font = `bold ${28 * DPR}px Arial`; ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('DT', cardX + CARD_W / 2, cardY + photoH / 2);
      }
      ctx.restore();
      const badgeY = cardY + photoH - 18 * DPR;
      ctx.fillStyle = color;
      drawRoundRect(cardX + 4 * DPR, badgeY, 22 * DPR, 16 * DPR, 4 * DPR);
      ctx.fill();
      ctx.font = `bold ${9 * DPR}px Arial`; ctx.fillStyle = '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('DT', cardX + 15 * DPR, badgeY + 8 * DPR);
      const dtApellido = (this.pais?.dtNombre?.split(' ').pop() ?? 'DT').toUpperCase();
      ctx.font = `bold ${10 * DPR}px Arial`; ctx.fillStyle = '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(dtApellido, cardX + CARD_W / 2, cardY + photoH + 4 * DPR, CARD_W - 6 * DPR);
    };

    // Función para dibujar celda de marca dt26.win
    const drawBrand = (cardX: number, cardY: number) => {
      drawRoundRect(cardX, cardY, CARD_W, CARD_H, 6 * DPR);
      const grad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + CARD_H);
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(1, '#312e81');
      ctx.fillStyle = grad; ctx.fill();
      ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 1.5 * DPR; ctx.stroke();
      // Trofeo
      ctx.font = `${40 * DPR}px Arial`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('\uD83C\uDFC6', cardX + CARD_W / 2, cardY + CARD_H * 0.38);
      // Texto www.dt26.win
      ctx.font = `bold ${11 * DPR}px Arial`;
      ctx.fillStyle = '#a5b4fc';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('www.dt26.win', cardX + CARD_W / 2, cardY + CARD_H * 0.68);
      // Subtexto
      ctx.font = `${9 * DPR}px Arial`;
      ctx.fillStyle = 'rgba(165,180,252,0.55)';
      ctx.fillText('Mundial 2026', cardX + CARD_W / 2, cardY + CARD_H * 0.80);
    };

    // Función brand con logo real
    const drawBrandWithLogo = (cardX: number, cardY: number, logoImg: HTMLImageElement | null) => {
      drawRoundRect(cardX, cardY, CARD_W, CARD_H, 6 * DPR);
      const grad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + CARD_H);
      grad.addColorStop(0, '#0d1117');
      grad.addColorStop(1, '#1a2035');
      ctx.fillStyle = grad; ctx.fill();
      ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 1.5 * DPR; ctx.stroke();
      if (logoImg) {
        // Logo ocupa todo el card con clip redondeado
        ctx.save();
        drawRoundRect(cardX, cardY, CARD_W, CARD_H, 6 * DPR);
        ctx.clip();
        ctx.drawImage(logoImg, cardX, cardY, CARD_W, CARD_H);
        ctx.restore();
      } else {
        // Fallback si no carga
        ctx.font = `bold ${11 * DPR}px Arial`;
        ctx.fillStyle = '#a5b4fc';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('www.dt26.win', cardX + CARD_W / 2, cardY + CARD_H / 2);
      }
    };

    // Cargar imágenes de jugadores
    const playerImgPromises = sorted.map(p => {
      if (!p.urlFoto) return Promise.resolve<HTMLImageElement | null>(null);
      return new Promise<HTMLImageElement | null>(resolve => {
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img); img.onerror = () => resolve(null);
        img.src = p.urlFoto!;
      });
    });
    const dtImgPromise: Promise<HTMLImageElement | null> = this.pais?.dtFotoUrl
      ? new Promise(resolve => {
          const img = new Image(); img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img); img.onerror = () => resolve(null);
          img.src = this.pais!.dtFotoUrl!;
        })
      : Promise.resolve(null);
    const brandLogoPromise: Promise<HTMLImageElement | null> = new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img); img.onerror = () => resolve(null);
      img.src = '/images/logodt26.png';
    });

    Promise.all([Promise.all(playerImgPromises), dtImgPromise, brandLogoPromise]).then(([playerImgs, dtImg, brandLogo]) => {
      // Dibujar los 28 slots en grid 7×4
      grid.forEach((slot, idx) => {
        const row  = Math.floor(idx / COLS);
        const col  = idx % COLS;
        const cardX = PAD + col * (CARD_W + GAP);
        const cardY = PAD + HEADER + row * (CARD_H + GAP);

        if (slot === null) {
          drawEmpty(cardX, cardY);
        } else if (slot === 'DT') {
          drawDT(cardX, cardY, dtImg);
        } else if (slot === 'BRAND') {
          drawBrandWithLogo(cardX, cardY, brandLogo);
        } else {
          const imgIdx = sorted.indexOf(slot);
          drawCard(slot, cardX, cardY, playerImgs[imgIdx] ?? null);
        }
      });

      // ── Footer con mensaje ────────────────────────────────────────
      const footerY = CANVAS_H - FOOTER;
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(0, footerY, CANVAS_W, FOOTER);
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1 * DPR;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(PAD, footerY); ctx.lineTo(CANVAS_W - PAD, footerY);
      ctx.stroke();

      const selCount = todos.length;
      const footerLine1 = `${selCount}/26 jugadores seleccionados  ·  Tenés tiempo de completar o modificar tu plantel hasta el 25 de Mayo`;
      const footerLine2 = `Después podrás hacer el 11 ideal de tus equipos favoritos y predecir todos los resultados del Mundial  ·  Participá en competencias privadas con tus amigos`;
      const lineH = 17 * DPR;
      const midY  = footerY + FOOTER / 2;
      const maxW  = CANVAS_W - PAD * 6;

      ctx.font = `bold ${13 * DPR}px Arial`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(footerLine1, CANVAS_W / 2, midY - lineH / 2, maxW);
      ctx.font = `${12 * DPR}px Arial`;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(footerLine2, CANVAS_W / 2, midY + lineH / 2 + 2 * DPR, maxW);

      // Compartir
      const shareText = `🏆 Esta es mi lista de convocados de ${paisNombre} para el Mundial 2026!\nArmá la tuya en 👉 https://dt26.win`;
      cvs.toBlob(blob => {
        if (!blob) { this.downloadingPlantel = false; return; }
        const file = new File([blob], `Plantel-${paisNombre}.png`, { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          navigator.share({ files: [file], title: `Mi Plantel - ${paisNombre}`, text: shareText })
            .catch(() => this.downloadPlantelCanvas(cvs, paisNombre))
            .finally(() => { this.downloadingPlantel = false; });
        } else {
          this.downloadPlantelCanvas(cvs, paisNombre);
          this.downloadingPlantel = false;
        }
      }, 'image/png');
    }).catch(() => {
      this.snackBar.open('Error generando imagen.', '', { duration: 3000, panelClass: 'snack-error' });
      this.downloadingPlantel = false;
    });
  }


  // Stats panel
  selectedPlayer = signal<JugadorSeleccionable | null>(null);
  playerStats = signal<PlayerStats | null>(null);
  statsLoading = signal(false);
  statsError = signal('');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private countriesService: CountriesService,
    private grupoService: GrupoService,
    private snackBar: MatSnackBar,
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.paisId = Number(this.route.snapshot.paramMap.get('paisId'));
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'titulares' || tab === 'nova' || tab === 'vista3d') {
      this.activeTab.set(tab);
    }

    this.autoSave$
      .pipe(debounceTime(400), takeUntil(this.destroy$))
      .subscribe(() => this.guardarConvocatoria());

    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.loading = true;
    this.error = '';
    this.noEsFavorito = false;

    // Cargamos en paralelo: catálogo de países, jugadores del país, convocatoria existente y favoritos
    forkJoin({
      paises: this.countriesService.getPaises(),
      jugadores: this.countriesService.getJugadoresPorPais(this.paisId),
      convocatoria: this.countriesService.getMiConvocatoria(this.paisId),
      favoritos: this.grupoService.getMisFavoritos()
    }).subscribe({
      next: ({ paises, jugadores, convocatoria, favoritos }) => {
        // Verificar que el país sea favorito del usuario
        const esFav = favoritos.some(f => f.paisId === this.paisId);
        if (!esFav) {
          this.noEsFavorito = true;
          this.loading = false;
          return;
        }

        this.pais = paises.find(p => Number(p.internalId) === this.paisId) ?? null;

        // Construir set de IDs ya guardados para marcar como seleccionados
        // NOTA: GraphQL serializa el tipo ID como string, por eso se compara con String()
        const savedIds = new Set<string>(
          (convocatoria?.jugadoresIds ?? []).map(id => String(id))
        );
        const noVaIdsSet = new Set<string>(
          (convocatoria?.noVaIds ?? []).map(id => String(id))
        );
        const titularIdsSet = new Set<string>(
          (convocatoria?.titularesIds ?? []).map(id => String(id))
        );
        this.convocatoriaEstado = convocatoria?.estado ?? null;

        console.log('📊 Datos cargados:', { paisId: this.paisId, paisName: this.pais?.nombre, totalJugadores: jugadores.length, savedIds: Array.from(savedIds), noVaIds: Array.from(noVaIdsSet), titularIds: Array.from(titularIdsSet), convocatoria });

        this.players.set(jugadores.map(j => ({
          ...j,
          seleccionado: savedIds.has(String(j.internalId)) || titularIdsSet.has(String(j.internalId)),
          noVa: noVaIdsSet.has(String(j.internalId)),
          titular: titularIdsSet.has(String(j.internalId))
        })));

        // Cargar posiciones guardadas de titulares
        this.savedPositions.clear();
        this.draggedPositions.clear();
        this._dragPxCache.clear();
        for (const pos of (convocatoria?.posicionesTitulares ?? [])) {
          this.savedPositions.set(Number(pos.jugadorId), { x: pos.x, y: pos.y });
        }

        this.loading = false;
      },
      error: () => {
        this.error = 'Error cargando los datos. Por favor, intentá de nuevo.';
        this.loading = false;
      }
    });
  }

  get jugadoresSeleccionados(): JugadorSeleccionable[] {
    return this.players().filter(p => p.seleccionado);
  }

  get jugadoresNoVa(): JugadorSeleccionable[] {
    return this.players().filter(p => p.noVa);
  }

  get jugadoresTitulares(): JugadorSeleccionable[] {
    return this.players().filter(p => p.titular);
  }

  readonly MAX_TITULARES = 11;
  readonly MAX_TITULARES_ARQ = 1;

  get canAddMore(): boolean {
    return this.totalSel() < this.MAX_CONVOCADOS;
  }

  /** true si hay al menos 1 convocado a eliminatorias en el plantel */
  get hasConvocados(): boolean {
    return this.players().some(j => j.convocadoEliminatoria);
  }

  getByPosition(codigo: string): JugadorSeleccionable[] {
    const q = normalize(this.searchQuery.trim());
    const onlyConv = !q && this.hasConvocados;
    return this.players().filter(j => {
      if (j.posicion?.codigo !== codigo || j.noVa) return false;
      // Sin búsqueda activa: siempre mostrar seleccionados
      if (!q && j.seleccionado) return true;
      // Sin búsqueda y hay convocados: solo mostrar convocados
      if (onlyConv && !j.convocadoEliminatoria) return false;
      if (!q) return true;
      // Con búsqueda: filtrar por nombre o club (incluso seleccionados)
      const nombre = normalize(j.nombreCompleto || `${j.nombre} ${j.apellido}`);
      const club = normalize(j.club?.nombre || '');
      return nombre.includes(q) || club.includes(q);
    }).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }

  get filteredCount(): number {
    const q = normalize(this.searchQuery.trim());
    const onlyConv = !q && this.hasConvocados;
    return this.players().filter(j => {
      if (j.noVa) return false;
      if (!q && j.seleccionado) return true;
      if (onlyConv && !j.convocadoEliminatoria) return false;
      if (!q) return true;
      const nombre = normalize(j.nombreCompleto || `${j.nombre} ${j.apellido}`);
      const club = normalize(j.club?.nombre || '');
      return nombre.includes(q) || club.includes(q);
    }).length;
  }

  getPosColor(codigo?: string): string {
    const pg = this.positionGroups.find(g => g.codigo === codigo);
    return pg?.color ?? '#94a3b8';
  }

  get currentUsername(): string {
    return this.authService.getCurrentUser()?.user ?? '';
  }

  /** Grid plano 7×4 = 28 slots: 27 jugadores (ordenados por pos) + 1 DT al final */
  getPlantelGrid(): Array<JugadorSeleccionable | 'DT' | null> {
    const POS_ORDER: Record<string, number> = { ARQ: 0, DEF: 1, MED: 2, DEL: 3 };
    const sorted = this.jugadoresSeleccionados.slice().sort((a, b) => {
      const ao = POS_ORDER[a.posicion?.codigo ?? ''] ?? 4;
      const bo = POS_ORDER[b.posicion?.codigo ?? ''] ?? 4;
      return ao !== bo ? ao - bo : (b.titular ? 1 : 0) - (a.titular ? 1 : 0) || (b.rating ?? 0) - (a.rating ?? 0);
    });
    const slots: Array<JugadorSeleccionable | 'DT' | null> = [];
    // 26 jugadores en los primeros slots
    for (let i = 0; i < 26; i++) {
      slots.push(sorted[i] ?? null);
    }
    // slot 27 vacío, slot 28 DT → completa fila 4: [J][J][J][J][J][vacío][DT]
    slots.push(null);
    slots.push('DT');
    return slots;
  }

  /** Columnas del grid de figuritas según posición: ARQ=6, resto=7 */
  getFigCols(codigo: string): number {
    return 5;
  }

  /** Convocados + titulares de una posición (para el álbum del plantel) */
  getConvocadosByPos(codigo: string): JugadorSeleccionable[] {
    return this.players()
      .filter(p => (p.seleccionado || p.titular) && p.posicion?.codigo === codigo)
      .sort((a, b) => (b.titular ? 1 : 0) - (a.titular ? 1 : 0) || (b.rating ?? 0) - (a.rating ?? 0));
  }

  /** Convocados de una posición (candidatos para titular) */
  getTitularCandidates(codigo: string): JugadorSeleccionable[] {
    return this.players().filter(p => p.seleccionado && p.posicion?.codigo === codigo);
  }

  /** Titulares de una posición (para la cancha) */
  getTitularesByPos(codigo: string): JugadorSeleccionable[] {
    return this.players().filter(p => p.titular && p.posicion?.codigo === codigo);
  }

  togglePlayer(player: JugadorSeleccionable): void {
    if (!player.seleccionado && !this.canAddMore) {
      this.snackBar.open(`Límite alcanzado: máximo ${this.MAX_CONVOCADOS} convocados`, '', {
        duration: 2500,
        panelClass: 'snack-warn'
      });
      return;
    }
    const wasSelected = player.seleccionado;
    this.players.update(curr =>
      curr.map(p => p.internalId === player.internalId
        ? { ...p, seleccionado: !wasSelected, titular: wasSelected ? false : p.titular }
        : p)
    );
    this.autoSave$.next();
  }

  markNoVa(player: JugadorSeleccionable, event: Event): void {
    event.stopPropagation();
    this.players.update(curr =>
      curr.map(p => p.internalId === player.internalId ? { ...p, seleccionado: false, noVa: true, titular: false } : p)
    );
    this.autoSave$.next();
  }

  undoNoVa(player: JugadorSeleccionable): void {
    this.players.update(curr =>
      curr.map(p => p.internalId === player.internalId ? { ...p, noVa: false } : p)
    );
    this.autoSave$.next();
  }

  getNoVaByPosition(codigo: string): JugadorSeleccionable[] {
    return this.players().filter(j => j.noVa && j.posicion?.codigo === codigo)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }

  toggleTitular(player: JugadorSeleccionable): void {
    if (player.titular) {
      // Quitar de titulares
      this.players.update(curr =>
        curr.map(p => p.internalId === player.internalId ? { ...p, titular: false } : p)
      );
      this.autoSave$.next();
      return;
    }
    // Validar máximo 11
    if (this.totalTitulares() >= this.MAX_TITULARES) {
      this.snackBar.open(`Máximo ${this.MAX_TITULARES} titulares (1 arquero + 10 jugadores)`, '', {
        duration: 2500, panelClass: 'snack-warn'
      });
      return;
    }
    // Validar máximo 1 ARQ
    if (player.posicion?.codigo === 'ARQ' && (this.titularPosCounts()['ARQ'] || 0) >= this.MAX_TITULARES_ARQ) {
      this.snackBar.open('Solo podés tener 1 arquero titular', '', {
        duration: 2500, panelClass: 'snack-warn'
      });
      return;
    }
    this.players.update(curr =>
      curr.map(p => p.internalId === player.internalId ? { ...p, titular: true } : p)
    );
    this.autoSave$.next();
  }

  convocarPlayer(player: JugadorSeleccionable, event: Event): void {
    event.stopPropagation();
    if (!player.seleccionado && !this.canAddMore) {
      this.snackBar.open(`Límite alcanzado: máximo ${this.MAX_CONVOCADOS} convocados`, '', {
        duration: 2500,
        panelClass: 'snack-warn'
      });
      return;
    }
    const wasSelected = player.seleccionado;
    this.players.update(curr =>
      curr.map(p => p.internalId === player.internalId
        ? { ...p, seleccionado: !wasSelected, titular: wasSelected ? false : p.titular }
        : p)
    );
    this.autoSave$.next();
  }

  selectAll(codigo: string): void {
    const current = this.players();
    const group = current.filter(p => p.posicion?.codigo === codigo);
    const allSelected = group.every(p => p.seleccionado);
    let count = current.filter(p => p.seleccionado).length;
    this.players.set(current.map(p => {
      if (p.posicion?.codigo !== codigo) return p;
      if (allSelected) {
        if (p.seleccionado) { count--; return { ...p, seleccionado: false }; }
      } else if (!p.seleccionado && count < this.MAX_CONVOCADOS) {
        count++; return { ...p, seleccionado: true };
      }
      return p;
    }));
  }

  clearAll(): void {
    this.players.update(curr => curr.map(p => ({ ...p, seleccionado: false, noVa: false, titular: false })));
  }

  clearPositions(): void {
    this.draggedPositions.clear();
    this.savedPositions.clear();
    this._dragPxCache.clear();
    // Forzar re-render de las posiciones
    this.players.update(curr => [...curr]);
  }

  get confColor(): string {
    return this.CONF_COLORS[this.pais?.confederacion?.codigo ?? ''] ?? '#7c3aed';
  }

  private readonly FIFA_TO_ISO: Record<string, string> = {
    'ARG': 'AR', 'BRA': 'BR', 'URU': 'UY', 'COL': 'CO',
    'CHI': 'CL', 'PAR': 'PY', 'ECU': 'EC', 'BOL': 'BO',
    'PER': 'PE', 'VEN': 'VE',
    'GER': 'DE', 'ENG': 'GB', 'FRA': 'FR', 'ESP': 'ES',
    'ITA': 'IT', 'POR': 'PT', 'NED': 'NL', 'BEL': 'BE',
    'SUI': 'CH', 'AUT': 'AT', 'CRO': 'HR', 'SVN': 'SI',
    'DEN': 'DK', 'SWE': 'SE', 'NOR': 'NO', 'FIN': 'FI',
    'ISL': 'IS', 'IRL': 'IE', 'SCO': 'GB', 'WAL': 'GB',
    'TUR': 'TR', 'POL': 'PL', 'ROU': 'RO', 'HUN': 'HU',
    'GRE': 'GR', 'SRB': 'RS', 'CZE': 'CZ', 'SVK': 'SK',
    'UKR': 'UA', 'ALB': 'AL', 'MKD': 'MK', 'MNE': 'ME',
    'BIH': 'BA', 'RUS': 'RU', 'GEO': 'GE',
    'USA': 'US', 'MEX': 'MX', 'CAN': 'CA', 'CRC': 'CR',
    'HON': 'HN', 'PAN': 'PA', 'SLV': 'SV', 'TRI': 'TT',
    'JAM': 'JM', 'HAI': 'HT', 'GUA': 'GT', 'CUB': 'CU',
    'MAR': 'MA', 'SEN': 'SN', 'NGA': 'NG', 'GHA': 'GH',
    'CMR': 'CM', 'CIV': 'CI', 'EGY': 'EG', 'TUN': 'TN',
    'ALG': 'DZ', 'RSA': 'ZA', 'ZAF': 'ZA', 'KEN': 'KE',
    'JPN': 'JP', 'KOR': 'KR', 'IRN': 'IR', 'SAU': 'SA',
    'AUS': 'AU', 'QAT': 'QA', 'UAE': 'AE', 'IRQ': 'IQ',
    'JOR': 'JO', 'UZB': 'UZ', 'CHN': 'CN', 'IND': 'IN',
    'NZL': 'NZ', 'FIJ': 'FJ',
  };

  getFlagEmoji(codigo: string): string {
    if (!codigo) return '🏳️';
    const upper = codigo.toUpperCase();
    const iso = upper.length === 3
      ? (this.FIFA_TO_ISO[upper] ?? upper.substring(0, 2))
      : upper;
    if (iso.length !== 2) return '🏳️';
    try {
      const pts = iso.split('').map(c => 0x1F1E6 - 65 + c.charCodeAt(0));
      return String.fromCodePoint(...pts);
    } catch { return '🏳️'; }
  }

  getLogoUrl(): string | null {
    if (!this.pais?.apiTeamId) return null;
    return CountriesService.proxyUrl(`https://media.api-sports.io/football/teams/${this.pais.apiTeamId}.png`);
  }

  guardarConvocatoria(): void {
    const seleccionados = this.players().filter(p => p.seleccionado);
    const noVa = this.players().filter(p => p.noVa);
    const titulares = this.players().filter(p => p.titular);

    this.saving = true;
    const jugadorIds = seleccionados.map(p => Number(p.internalId));
    const noVaIds = noVa.map(p => Number(p.internalId));
    const titularesIds = titulares.map(p => Number(p.internalId));

    this.countriesService.guardarConvocatoria(this.paisId, jugadorIds, noVaIds, titularesIds).subscribe({
      next: (resp) => {
        this.convocatoriaEstado = resp.estado;
        const tab = this.activeTab();

        // Si estamos en titulares y hay posiciones arrastradas, guardarlas también
        if (tab === 'titulares' && this.savedPositions.size > 0) {
          const posiciones = Array.from(this.savedPositions.entries()).map(([jugadorId, pos]) => ({
            jugadorId, x: Math.round(pos.x * 100) / 100, y: Math.round(pos.y * 100) / 100
          }));
          this.countriesService.guardarPosicionesTitulares(this.paisId, posiciones).subscribe({
            next: () => {
              this.saving = false;
              this.draggedPositions.clear();
            },
            error: () => {
              this.saving = false;
              this.snackBar.open('Error al guardar posiciones.', '', { duration: 3000, panelClass: 'snack-error' });
            }
          });
        } else {
          this.saving = false;
        }
      },
      error: () => {
        this.saving = false;
        this.snackBar.open('Error al guardar. Intentá de nuevo.', '', {
          duration: 4000,
          panelClass: 'snack-error'
        });
      }
    });
  }

  volverAPaises(): void {
    this.router.navigate(['/countries']);
  }

  irAPlantel(): void {
    this.router.navigate(['/countries']);
  }

  setTab(tab: 'convocatoria' | 'titulares' | 'nova' | 'vista3d'): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'convocatoria' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  // ═══ STATS PANEL ═══

  /** Llamado al hacer tap sobre un jugador en el canvas pitch-3d */
  onPitchPlayerClicked(jugadorId: number): void {
    const player = this.players().find(p => p.internalId === jugadorId);
    if (player) { this.selectPlayer(player); }
  }

  selectPlayer(player: JugadorSeleccionable): void {
    if (this.selectedPlayer()?.internalId === player.internalId) {
      this.selectedPlayer.set(null);
      this.playerStats.set(null);
      this.statsError.set('');
      return;
    }
    this.selectedPlayer.set(player);
    this.playerStats.set(null);
    this.statsError.set('');
    this.loadPlayerStats(player.internalId);
  }

  closeStatsPanel(): void {
    this.selectedPlayer.set(null);
    this.playerStats.set(null);
    this.statsError.set('');
  }

  private loadPlayerStats(playerId: number): void {
    this.statsLoading.set(true);
    this.http.get<{ stats: PlayerStats; cached: boolean; syncDate?: string; message?: string }>(
      `${environment.apiUrl}/jugadores/${playerId}/stats`
    ).subscribe({
      next: (res) => {
        const s = res.stats as any;
        if (!s || Object.keys(s).length === 0) {
          this.statsError.set('Sin estadísticas disponibles para esta temporada.');
        } else {
          this.playerStats.set(s as PlayerStats);
          if (s.rating) {
            this.ratingCache.set(playerId, s.rating);
          }
        }
        this.statsLoading.set(false);
      },
      error: () => {
        this.statsError.set('No se pudieron cargar las estadísticas.');
        this.statsLoading.set(false);
      }
    });
  }

  // ═══ DRAG & DROP CANCHA ═══
  @ViewChild('pitchFieldRef') pitchFieldRef!: ElementRef<HTMLDivElement>;
  @ViewChild('pitch3d') pitch3dRef?: PitchThreeDComponent;
  @ViewChild('pitch3dView') pitch3dViewRef?: Pitch3dViewComponent;

  trackById(_: number, player: JugadorSeleccionable): number {
    return player.internalId;
  }

  /** Retorna posición en píxeles para cdkDragFreeDragPosition (con cache) */
  getPlayerDragPos(player: JugadorSeleccionable): { x: number; y: number } {
    const id = Number(player.internalId);
    const cached = this._dragPxCache.get(id);
    if (cached) return cached;

    const field = this.pitchFieldRef?.nativeElement;
    if (!field || !field.clientWidth) return ConvocadosComponent.ZERO_POS;

    const pct = this.savedPositions.get(id) ?? this.getDefaultPositionPct(player);
    // Asegurar que todos los titulares tengan su posición en savedPositions
    if (!this.savedPositions.has(id)) {
      this.savedPositions.set(id, pct);
    }
    const pos = {
      x: (pct.x / 100) * field.clientWidth - 28,
      y: (pct.y / 100) * field.clientHeight - 30
    };
    this._dragPxCache.set(id, pos);
    return pos;
  }

  /** Calcula posición por defecto (%) según posición de juego */
  private getDefaultPositionPct(player: JugadorSeleccionable): { x: number; y: number } {
    const pos = player.posicion?.codigo || 'MED';
    const titulares = this.players().filter(p => p.titular && p.posicion?.codigo === pos);
    const idx = titulares.findIndex(p => p.internalId === player.internalId);
    const count = titulares.length;

    const hSpacing = count > 1 ? 70 / (count - 1) : 0;
    const hStart = count > 1 ? 15 : 50;
    const x = count > 1 ? hStart + idx * hSpacing : hStart;

    const yMap: Record<string, number> = { 'DEL': 12, 'MED': 38, 'DEF': 64, 'ARQ': 88 };
    const y = yMap[pos] ?? 50;
    return { x, y };
  }

  /** Cuando se suelta un jugador después de arrastrarlo */
  onDragEnded(event: CdkDragEnd, player: JugadorSeleccionable): void {
    const field = this.pitchFieldRef?.nativeElement;
    if (!field) return;

    const pos = event.source.getFreeDragPosition();
    const id = Number(player.internalId);

    // Actualizar cache de píxeles (misma referencia que CdkDrag usa)
    this._dragPxCache.set(id, { x: pos.x, y: pos.y });

    // Convertir a porcentaje para guardar en servidor
    const xPct = ((pos.x + 28) / field.clientWidth) * 100;
    const yPct = ((pos.y + 30) / field.clientHeight) * 100;
    this.draggedPositions.set(id, { x: xPct, y: yPct });
    this.savedPositions.set(id, { x: xPct, y: yPct });
  }

  /** Handler de posición emitida por el componente 3D — auto-guarda */
  on3dPositionChanged(event: { jugadorId: number; x: number; y: number }): void {
    this.savedPositions.set(event.jugadorId, { x: event.x, y: event.y });
    this.draggedPositions.set(event.jugadorId, { x: event.x, y: event.y });
    this.autoSave$.next();
  }

  /** Guarda SOLO las posiciones de los titulares en la cancha */
  guardarPosiciones(): void {
    if (this.savedPositions.size === 0) {
      this.snackBar.open('No hay posiciones para guardar.', '', { duration: 2500 });
      return;
    }
    this.savingPositions = true;
    const posiciones = Array.from(this.savedPositions.entries()).map(([jugadorId, pos]) => ({
      jugadorId, x: Math.round(pos.x * 100) / 100, y: Math.round(pos.y * 100) / 100
    }));
    this.countriesService.guardarPosicionesTitulares(this.paisId, posiciones).subscribe({
      next: () => {
        this.savingPositions = false;
        this.draggedPositions.clear();
        this.snackBar.open('✅ Posiciones guardadas', '', { duration: 3000, panelClass: 'snack-success' });
      },
      error: () => {
        this.savingPositions = false;
        this.snackBar.open('Error al guardar posiciones. Intentá de nuevo.', '', { duration: 3000, panelClass: 'snack-error' });
      }
    });
  }

  /** Exportar cancha como imagen PNG con marca DT26 y país + fecha */
  exportingPitch = false;

  scrollToPitch(): void {
    document.getElementById('pitch-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  exportPitchAsPng(): void {
    if (!this.pitch3dRef) return;
    this.exportingPitch = true;

    const username = this.authService.getCurrentUser()?.user;
    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    this.pitch3dRef.captureSnapshot(username, this.pais?.nombre, fecha).then(canvas => {
      canvas.toBlob(blob => {
        if (!blob) { this.exportingPitch = false; return; }
        const file = new File([blob], `XI-${this.pais?.nombre ?? 'titular'}.png`, { type: 'image/png' });
        const paisNombre = this.pais?.nombre ?? 'mi selección';
        const shareText = `⚽🏆 Este es mi 11 titular de ${paisNombre} para el Mundial 2026!\n\n` +
          `Armá tu equipo ideal en 👉 https://dt26.win\n` +
          `Elegí tus selecciones favoritas, armá tu convocatoria y compartí tu XI con tus amigos. ¡Vamos! 🔥`;
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          navigator.share({ files: [file], title: `Mi XI Titular - ${paisNombre}`, text: shareText })
            .catch(() => this.downloadCanvas(canvas));
        } else {
          this.downloadCanvas(canvas);
        }
        this.exportingPitch = false;
      }, 'image/png');
    });
  }

  private downloadCanvas(canvas: HTMLCanvasElement): void {
    const link = document.createElement('a');
    link.download = `XI-${this.pais?.nombre ?? 'titular'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  /** Compartir la vista 3D de titulares como imagen */
  compartir3D(): void {
    if (!this.pitch3dViewRef) {
      this.snackBar.open('La vista 3D no está disponible.', '', { duration: 3000, panelClass: 'snack-error' });
      return;
    }
    this.exportingPitch = true;
    const canvas = this.pitch3dViewRef.captureImage();
    const paisNombre = this.pais?.nombre ?? 'mi selección';
    const shareText = `⚽🏆 Este es mi 11 titular de ${paisNombre} para el Mundial 2026!\n\n` +
      `Armá tu equipo ideal en 👉 https://dt26.win\n` +
      `Elegí tus selecciones favoritas, armá tu convocatoria y compartí tu XI con tus amigos. ¡Vamos! 🔥`;
    canvas.toBlob(blob => {
      if (!blob) { this.exportingPitch = false; return; }
      const file = new File([blob], `XI-3D-${paisNombre}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        navigator.share({ files: [file], title: `Mi XI Titular - ${paisNombre}`, text: shareText })
          .catch(() => this.downloadCanvas(canvas))
          .finally(() => { this.exportingPitch = false; });
      } else {
        this.downloadCanvas(canvas);
        this.exportingPitch = false;
      }
    }, 'image/png');
  }
}
