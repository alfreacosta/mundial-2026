import {
  Component, Input, Output, EventEmitter, AfterViewInit,
  OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { JugadorSeleccionable } from '../convocados.component';

export interface PlayerPos { x: number; y: number; }

const FW = 60;
const FH = 90;

@Component({
  selector: 'app-pitch-3d',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div #wrap class="wrap">
      <canvas #cvs class="cvs"></canvas>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .wrap { width: 100%; border-radius: 12px; overflow: hidden; background: #071a07; }
    .cvs  { width: 100%; display: block; touch-action: none; }
  `]
})
export class PitchThreeDComponent implements AfterViewInit, OnDestroy, OnChanges {

  @ViewChild('cvs') cvsRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('wrap') wrapRef!: ElementRef<HTMLDivElement>;

  @Input() players: JugadorSeleccionable[] = [];
  @Input() savedPositions: Map<number, PlayerPos> = new Map();
  @Input() posColorFn: (codigo?: string) => string = () => '#94a3b8';
  @Input() dtNombre?: string;
  @Input() dtFotoUrl?: string;

  @Output() positionChanged = new EventEmitter<{ jugadorId: number; x: number; y: number }>();
  @Output() playerClicked   = new EventEmitter<number>(); // emite jugadorId al hacer tap

  private dtImg: HTMLImageElement | null = null;

  private ctx!: CanvasRenderingContext2D;
  private ro!: ResizeObserver;
  private dpr = 1;

  private fX = 5; private fY = 5; private fW = 0; private fH = 0;

  private playerData: Array<{
    id: number;
    p: JugadorSeleccionable;
    pct: PlayerPos;
    img: HTMLImageElement | null;
    color: string;
  }> = [];

  private photoCache = new Map<string, HTMLImageElement | null>();
  private dragging: { idx: number } | null = null;
  private dragOffset = { x: 0, y: 0 };
  private pointerDownPos = { x: 0, y: 0 };
  private pointerDownTime = 0;

  private get TR(): number { return Math.round(this.fW / FW * 3.9); }

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    this.ctx = this.cvsRef.nativeElement.getContext('2d')!;
    this.zone.runOutsideAngular(() => {
      this.ro = new ResizeObserver(() => this.onResize());
      this.ro.observe(this.wrapRef.nativeElement);
      this.onResize();
      this.bindEvents();
    });
    if (this.dtFotoUrl) { this.loadDtPhoto(); }
  }

  ngOnChanges(c: SimpleChanges): void {
    if (!this.ctx) return;
    if (this.dragging) return; // no reconstruir mientras se arrastra
    if (c['dtFotoUrl']) { this.loadDtPhoto(); }
    if (c['players'] || c['savedPositions'] || c['dtNombre'] || c['dtFotoUrl']) { this.buildPlayerData(); this.draw(); }
  }

  ngOnDestroy(): void { this.ro?.disconnect(); }

  // ─── Resize ──────────────────────────────────────────────────────

  private onResize(): void {
    const cssW = this.wrapRef.nativeElement.clientWidth || 360;
    const cssH = Math.max(180, Math.round(cssW * (FH + 10) / (FW + 10)) - 70);
    this.dpr   = Math.min(window.devicePixelRatio || 1, 2);
    const cvs  = this.cvsRef.nativeElement;
    cvs.width  = cssW * this.dpr;
    cvs.height = cssH * this.dpr;
    cvs.style.height = cssH + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const m = 5;
    this.fX = m; this.fY = m; this.fW = cssW - m * 2; this.fH = cssH - m * 2;
    this.buildPlayerData();
    this.draw();
  }

  // ─── Player data ─────────────────────────────────────────────────

  private buildPlayerData(): void {
    const prev = new Map(this.playerData.map(d => [d.id, d]));
    this.playerData = this.players.map(p => {
      const id    = Number(p.internalId);
      const prevD = prev.get(id);
      // Si el jugador estaba siendo arrastrado, conservar su posición actual
      const isDragging = this.dragging !== null && prevD && this.playerData[this.dragging.idx]?.id === id;
      const pct   = isDragging ? prevD!.pct : (this.savedPositions.get(id) ?? this.defaultPct(p));
      const color = this.posColorFn(p.posicion?.codigo);
      return { id, p, pct, img: prevD?.img ?? null, color };
    });
    this.loadPhotos();
  }

  private loadPhotos(): void {
    this.playerData.forEach(d => {
      if (!d.p.urlFoto) return;
      const url = d.p.urlFoto;
      if (this.photoCache.has(url)) { d.img = this.photoCache.get(url) ?? null; return; }
      this.photoCache.set(url, null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.photoCache.set(url, img);
        const item = this.playerData.find(x => x.p.urlFoto === url);
        if (item) item.img = img;
        this.draw();
      };
      img.onerror = () => this.photoCache.set(url, null);
      img.src = url;
    });
  }

  private loadDtPhoto(): void {
    if (!this.dtFotoUrl) { this.dtImg = null; return; }
    if (this.photoCache.has(this.dtFotoUrl)) {
      this.dtImg = this.photoCache.get(this.dtFotoUrl) ?? null;
      return;
    }
    this.photoCache.set(this.dtFotoUrl, null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.photoCache.set(this.dtFotoUrl!, img);
      this.dtImg = img;
      this.draw();
    };
    img.onerror = () => { this.photoCache.set(this.dtFotoUrl!, null); };
    img.src = this.dtFotoUrl;
  }

  private defaultPct(p: JugadorSeleccionable): PlayerPos {
    const code = p.posicion?.codigo ?? 'MED';
    const same = this.players.filter(t => t.posicion?.codigo === code);
    const idx  = same.findIndex(t => t.internalId === p.internalId);
    const n    = same.length;
    const x    = n > 1 ? 10 + idx * (80 / (n - 1)) : 50;
    const yMap: Record<string, number> = { ARQ: 90, DEF: 70, MED: 45, DEL: 18 };
    return { x, y: yMap[code] ?? 50 };
  }

  // ─── Draw ────────────────────────────────────────────────────────

  private draw(): void {
    if (!this.ctx || !this.fW) return;
    const cssW = this.wrapRef.nativeElement.clientWidth || 360;
    const cssH = Math.round(cssW * (FH + 10) / (FW + 10));
    this.ctx.clearRect(0, 0, cssW, cssH);
    this.drawField();
    this.playerData.forEach(d => this.drawToken(d));
    if (this.dtNombre) { this.drawDtToken(); }
  }

  private drawField(): void {
    const ctx = this.ctx;
    const { fX, fY, fW, fH } = this;

    ctx.save();
    ctx.beginPath();
    this.pill(ctx, fX, fY, fW, fH, 6);
    ctx.clip();

    // Franjas
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#0d3d14' : '#0f4517';
      ctx.fillRect(fX, fY + i * fH / 10, fW, fH / 10 + 1);
    }

    const sx = (v: number) => fX + (v + FW / 2) / FW * fW;
    const sy = (v: number) => fY + (v + FH / 2) / FH * fH;
    const dw = (v: number) => v / FW * fW;
    const dh = (v: number) => v / FH * fH;

    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5; ctx.lineCap = 'round';

    ctx.strokeRect(fX + 0.75, fY + 0.75, fW - 1.5, fH - 1.5);
    ctx.beginPath(); ctx.moveTo(fX, sy(0)); ctx.lineTo(fX + fW, sy(0)); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(sx(0), sy(0), dw(9.15), dh(9.15), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(sx(0), sy(0), 2, 0, Math.PI * 2); ctx.fill();

    const paW = 40.32, paH = 16.5, gaW = 18.32, gaH = 5.5;
    ctx.strokeRect(sx(-paW/2), sy( FH/2 - paH), dw(paW), dh(paH));
    ctx.strokeRect(sx(-paW/2), sy(-FH/2),        dw(paW), dh(paH));
    ctx.strokeRect(sx(-gaW/2), sy( FH/2 - gaH), dw(gaW), dh(gaH));
    ctx.strokeRect(sx(-gaW/2), sy(-FH/2),        dw(gaW), dh(gaH));

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    [FH/2 - 11, -(FH/2 - 11)].forEach(py => {
      ctx.beginPath(); ctx.arc(sx(0), sy(py), 2, 0, Math.PI * 2); ctx.fill();
    });
    ctx.beginPath(); ctx.arc(sx(0), sy( FH/2 - 11),  dh(9.15), Math.PI * 1.18, Math.PI * 1.82); ctx.stroke();
    ctx.beginPath(); ctx.arc(sx(0), sy(-(FH/2 - 11)), dh(9.15), Math.PI * 0.18, Math.PI * 0.82); ctx.stroke();

    ([ [-FW/2,-FH/2, 0, Math.PI/2], [FW/2,-FH/2, Math.PI/2, Math.PI],
       [FW/2, FH/2, Math.PI, 3*Math.PI/2], [-FW/2,FH/2, 3*Math.PI/2, 2*Math.PI]
    ] as [number,number,number,number][]).forEach(([cx,cy,s,e]) => {
      ctx.beginPath(); ctx.arc(sx(cx), sy(cy), dw(1), s, e); ctx.stroke();
    });

    const gW = 7.32, gD = 2;
    ctx.strokeRect(sx(-gW/2), sy( FH/2),       dw(gW), dh(gD));
    ctx.strokeRect(sx(-gW/2), sy(-FH/2 - gD),  dw(gW), dh(gD));

    ctx.restore();
  }

  private drawToken(d: typeof this.playerData[0]): void {
    const ctx = this.ctx;
    const [cx, cy] = this.pctToCanvas(d.pct.x, d.pct.y);
    const R = this.TR;

    // Sombra
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur  = 8;
    ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = d.color; ctx.fill();
    ctx.restore();

    // Anillo color
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = d.color; ctx.fill();

    // Anillo blanco
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.87, 0, Math.PI * 2);
    ctx.fillStyle = 'white'; ctx.fill();

    // Foto / inicial
    const innerR = R * 0.82;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI * 2); ctx.clip();

    if (d.img) {
      const diam  = innerR * 2;
      const scale = diam / d.img.naturalWidth;
      const drawW = diam;
      const drawH = d.img.naturalHeight * scale;
      const dy    = drawH > diam ? -(drawH - diam) * 0.15 : (diam - drawH) / 2;
      ctx.drawImage(d.img, cx - innerR, cy - innerR + dy, drawW, drawH);
    } else {
      const g = ctx.createRadialGradient(cx, cy - innerR * 0.2, 0, cx, cy, innerR);
      g.addColorStop(0, d.color + 'cc'); g.addColorStop(1, d.color + '44');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = `bold ${Math.round(R * 0.7)}px Arial`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((d.p.apellido || d.p.nombre || '?').charAt(0).toUpperCase(), cx, cy);
    }
    ctx.restore();

    // Label
    const label  = (d.p.apellido?.split(' ')?.[0] ?? d.p.nombre ?? '').toUpperCase();
    ctx.font     = `700 ${Math.round(R * 0.38)}px Arial`;
    const textW  = ctx.measureText(label).width;
    const labelW = Math.max(textW + R * 0.6, R * 1.6);
    const labelH = Math.round(R * 0.56);
    const lx = cx - labelW / 2;
    const ly = cy + R + 3;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.beginPath(); this.pill(ctx, lx, ly, labelW, labelH, labelH / 2); ctx.fill();
    ctx.strokeStyle = d.color; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 1;
    ctx.fillText(label, cx, ly + labelH / 2);
    ctx.restore();
  }

  // ─── DT Token ────────────────────────────────────────────────────

  private drawDtToken(): void {
    const ctx = this.ctx;
    // El ctx está en escala dpr via setTransform, pero drawDtToken dibuja
    // en coordenadas CSS — usar coordenadas CSS directamente
    const cssR  = Math.round(this.TR * 1.1);
    const cssCx = this.fX + 8;
    const cssCy = this.fY + this.fH - cssR * 2 - 10;  // esquina inferior izquierda
    const cxc   = cssCx + cssR;
    const cyc   = cssCy + cssR;

    // Sombra exterior
    ctx.save();
    ctx.shadowColor  = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur   = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;
    ctx.beginPath(); ctx.arc(cxc, cyc, cssR, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b'; ctx.fill();
    ctx.restore();

    // Anillo blanco exterior
    ctx.beginPath(); ctx.arc(cxc, cyc, cssR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5; ctx.stroke();

    // Foto o inicial del DT
    const innerR = cssR * 0.92;
    ctx.save();
    ctx.beginPath(); ctx.arc(cxc, cyc, innerR, 0, Math.PI * 2); ctx.clip();
    if (this.dtImg) {
      const diam  = innerR * 2;
      const scale = diam / this.dtImg.naturalWidth;
      const drawW = diam;
      const drawH = this.dtImg.naturalHeight * scale;
      const dy    = drawH > diam ? -(drawH - diam) * 0.15 : (diam - drawH) / 2;
      ctx.drawImage(this.dtImg, cxc - innerR, cyc - innerR + dy, drawW, drawH);
    } else {
      ctx.fillStyle = '#334155';
      ctx.beginPath(); ctx.arc(cxc, cyc, innerR, 0, Math.PI * 2); ctx.fill();
      const initial = this.dtNombre?.split(' ').pop()?.charAt(0).toUpperCase() ?? 'D';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = `bold ${Math.round(cssR * 0.65)}px Arial`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(initial, cxc, cyc);
    }
    ctx.restore();

    // Etiqueta debajo con apellido
    const apellido = (this.dtNombre?.split(' ').pop() ?? 'DT').toUpperCase();
    ctx.font = `700 ${Math.round(cssR * 0.36)}px Arial`;
    const textW  = ctx.measureText(apellido).width;
    const labelW = Math.max(textW + cssR * 0.6, cssR * 1.6);
    const labelH = Math.round(cssR * 0.52);
    const lx = cxc - labelW / 2;
    const ly = cyc + cssR + 2;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.beginPath(); this.pill(ctx, lx, ly, labelW, labelH, labelH / 2); ctx.fill();
    ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(apellido, cxc, ly + labelH / 2);
    ctx.restore();
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);    ctx.arcTo(x + w, y,     x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);    ctx.arcTo(x,     y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);        ctx.arcTo(x,     y,     x + r, y, r);
    ctx.closePath();
  }

  private pctToCanvas(xp: number, yp: number): [number, number] {
    return [this.fX + xp / 100 * this.fW, this.fY + yp / 100 * this.fH];
  }

  private canvasToPct(cx: number, cy: number): PlayerPos {
    return {
      x: Math.max(2, Math.min(98, (cx - this.fX) / this.fW * 100)),
      y: Math.max(2, Math.min(98, (cy - this.fY) / this.fH * 100))
    };
  }

  // ─── Eventos drag ────────────────────────────────────────────────

  private bindEvents(): void {
    const cvs = this.cvsRef.nativeElement;
    cvs.addEventListener('pointerdown',   e => this.onDown(e),  { passive: false });
    cvs.addEventListener('pointermove',   e => this.onMove(e),  { passive: false });
    cvs.addEventListener('pointerup',     e => this.onUp(e));
    cvs.addEventListener('pointercancel', () => {
      this.dragging = null;
    });
  }

  private getPos(e: PointerEvent): { x: number; y: number } {
    const r = this.cvsRef.nativeElement.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown(e: PointerEvent): void {
    const pos = this.getPos(e);
    const R   = this.TR;
    for (let i = this.playerData.length - 1; i >= 0; i--) {
      const d = this.playerData[i];
      const [cx, cy] = this.pctToCanvas(d.pct.x, d.pct.y);
      if (Math.hypot(pos.x - cx, pos.y - cy) <= R + 8) {
        this.dragging    = { idx: i };
        this.dragOffset  = { x: pos.x - cx, y: pos.y - cy };
        this.pointerDownPos  = { ...pos };
        this.pointerDownTime = Date.now();
        e.preventDefault();
        this.cvsRef.nativeElement.setPointerCapture(e.pointerId);
        return;
      }
    }
    // Si no toca un jugador no hace preventDefault → el scroll de página funciona
  }

  private onMove(e: PointerEvent): void {
    if (!this.dragging) return;
    e.preventDefault();
    const pos = this.getPos(e);
    const d   = this.playerData[this.dragging.idx];
    d.pct     = this.canvasToPct(pos.x - this.dragOffset.x, pos.y - this.dragOffset.y);
    this.draw();
  }

  private onUp(e: PointerEvent): void {
    if (!this.dragging) return;
    const d   = this.playerData[this.dragging.idx];
    const pos = this.getPos(e);
    const elapsed  = Date.now() - this.pointerDownTime;
    const distance = Math.hypot(pos.x - this.pointerDownPos.x, pos.y - this.pointerDownPos.y);

    if (elapsed < 300 && distance < 6) {
      // Es un tap → emitir click para ver estadísticas
      const jugadorId = d.id;
      this.dragging = null;
      this.cvsRef.nativeElement.releasePointerCapture(e.pointerId);
      this.zone.run(() => this.playerClicked.emit(jugadorId));
      return;
    }

    // Es un drag → emitir posición actualizada
    const pct = { ...d.pct };
    this.zone.run(() => this.positionChanged.emit({ jugadorId: d.id, x: pct.x, y: pct.y }));
    this.dragging = null;
    this.cvsRef.nativeElement.releasePointerCapture(e.pointerId);
  }

  // ─── Export ──────────────────────────────────────────────────────

  captureSnapshot(username?: string, countryName?: string, date?: string): Promise<HTMLCanvasElement> {
    const src = this.cvsRef.nativeElement;
    const out = document.createElement('canvas');
    out.width = src.width; out.height = src.height;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(src, 0, 0);
    const dpr = this.dpr;
    const W = out.width, H = out.height;

    // Watermark central semi-transparente
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.font = `bold ${Math.round(32 * dpr)}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('dt26.win', W / 2, H / 2);

    if (countryName || date) {
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.font = `500 ${Math.round(8 * dpr)}px Arial`;
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText(`${countryName ?? ''} · ${date ?? ''}`, W - 12 * dpr, 10 * dpr);
    }
    if (username) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.font = `500 ${Math.round(8 * dpr)}px Arial`;
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText(`@${username}`, W - 12 * dpr, 22 * dpr);
    }

    // Logo DT26 en esquina superior izquierda
    return new Promise(resolve => {
      const logo = new Image();
      logo.onload = () => {
        const logoSize = Math.round(48 * dpr);
        const pad = Math.round(10 * dpr);
        ctx.drawImage(logo, pad, pad, logoSize, logoSize);
        resolve(out);
      };
      logo.onerror = () => resolve(out);
      logo.src = '/images/logodt26.png';
    });
  }
}
