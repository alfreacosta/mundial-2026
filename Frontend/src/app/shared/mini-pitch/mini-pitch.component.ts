import {
  Component, Input, AfterViewInit, OnDestroy, OnChanges,
  SimpleChanges, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MiniPlayer {
  id: number;
  apellido: string;
  camiseta?: number | null;
  posAbr: string;   // POR, ARQ, DEF, MED, DEL
  x: number;        // porcentaje 0-100
  y: number;        // porcentaje 0-100
  urlFoto?: string | null;
}

const POS_COLOR: Record<string, string> = {
  POR: '#f59e0b', ARQ: '#f59e0b',
  DEF: '#3b82f6',
  MED: '#10b981',
  DEL: '#ef4444',
};

const FW = 60, FH = 90;

@Component({
  selector: 'app-mini-pitch',
  standalone: true,
  imports: [CommonModule],
  template: `<canvas #cvs style="width:100%;display:block;border-radius:10px;"></canvas>`,
})
export class MiniPitchComponent implements AfterViewInit, OnDestroy, OnChanges {

  @ViewChild('cvs') cvsRef!: ElementRef<HTMLCanvasElement>;

  @Input() players: MiniPlayer[] = [];

  private ctx!: CanvasRenderingContext2D;
  private ro!: ResizeObserver;
  private dpr = 1;
  private fX = 4; private fY = 4; private fW = 0; private fH = 0;
  private photoCache = new Map<string, HTMLImageElement | null>();

  private get TR(): number { return Math.max(10, Math.round(this.fW / FW * 3.8)); }

  ngAfterViewInit(): void {
    this.ctx = this.cvsRef.nativeElement.getContext('2d')!;
    this.ro = new ResizeObserver(() => this.onResize());
    this.ro.observe(this.cvsRef.nativeElement.parentElement!);
    this.onResize();
  }

  ngOnChanges(c: SimpleChanges): void {
    if (!this.ctx) return;
    if (c['players']) { this.loadPhotos(); this.draw(); }
  }

  ngOnDestroy(): void { this.ro?.disconnect(); }

  private onResize(): void {
    const parent = this.cvsRef.nativeElement.parentElement!;
    const cssW = parent.clientWidth || 280;
    const cssH = Math.round(cssW * (FH + 8) / (FW + 8));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cvs = this.cvsRef.nativeElement;
    cvs.width  = cssW * this.dpr;
    cvs.height = cssH * this.dpr;
    cvs.style.height = cssH + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const m = 4;
    this.fX = m; this.fY = m; this.fW = cssW - m * 2; this.fH = cssH - m * 2;
    this.loadPhotos();
    this.draw();
  }

  private loadPhotos(): void {
    this.players.forEach(p => {
      if (!p.urlFoto) return;
      const url = p.urlFoto;
      if (this.photoCache.has(url)) return;
      this.photoCache.set(url, null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { this.photoCache.set(url, img); this.draw(); };
      img.onerror  = () => this.photoCache.set(url, null);
      img.src = url;
    });
  }

  private draw(): void {
    if (!this.ctx || !this.fW) return;
    const parent = this.cvsRef.nativeElement.parentElement!;
    const cssW = parent.clientWidth || 280;
    const cssH = Math.round(cssW * (FH + 8) / (FW + 8));
    this.ctx.clearRect(0, 0, cssW, cssH);
    this.drawField();
    this.players.forEach(p => this.drawToken(p));
  }

  private drawField(): void {
    const ctx = this.ctx;
    const { fX, fY, fW, fH } = this;

    ctx.save();
    ctx.beginPath(); this.pill(ctx, fX, fY, fW, fH, 8); ctx.clip();

    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#0d3d14' : '#0f4517';
      ctx.fillRect(fX, fY + i * fH / 10, fW, fH / 10 + 1);
    }

    const sx = (v: number) => fX + (v + FW / 2) / FW * fW;
    const sy = (v: number) => fY + (v + FH / 2) / FH * fH;
    const dw = (v: number) => v / FW * fW;
    const dh = (v: number) => v / FH * fH;

    ctx.strokeStyle = 'rgba(255,255,255,0.80)';
    ctx.lineWidth = 1; ctx.lineCap = 'round';

    ctx.strokeRect(fX + 0.5, fY + 0.5, fW - 1, fH - 1);
    ctx.beginPath(); ctx.moveTo(fX, sy(0)); ctx.lineTo(fX + fW, sy(0)); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(sx(0), sy(0), dw(9.15), dh(9.15), 0, 0, Math.PI * 2); ctx.stroke();

    const paW = 40.32, paH = 16.5, gaW = 18.32, gaH = 5.5;
    ctx.strokeRect(sx(-paW/2), sy( FH/2-paH), dw(paW), dh(paH));
    ctx.strokeRect(sx(-paW/2), sy(-FH/2),     dw(paW), dh(paH));
    ctx.strokeRect(sx(-gaW/2), sy( FH/2-gaH), dw(gaW), dh(gaH));
    ctx.strokeRect(sx(-gaW/2), sy(-FH/2),     dw(gaW), dh(gaH));

    const gW = 7.32, gD = 2;
    ctx.strokeRect(sx(-gW/2), sy( FH/2),      dw(gW), dh(gD));
    ctx.strokeRect(sx(-gW/2), sy(-FH/2 - gD), dw(gW), dh(gD));

    ctx.beginPath(); ctx.arc(sx(0), sy( FH/2-11),  dh(9.15), Math.PI*1.18, Math.PI*1.82); ctx.stroke();
    ctx.beginPath(); ctx.arc(sx(0), sy(-(FH/2-11)), dh(9.15), Math.PI*0.18, Math.PI*0.82); ctx.stroke();

    ctx.restore();
  }

  private drawToken(p: MiniPlayer): void {
    const ctx = this.ctx;
    const cx = this.fX + p.x / 100 * this.fW;
    const cy = this.fY + p.y / 100 * this.fH;
    const R  = this.TR;
    const color = POS_COLOR[p.posAbr] ?? '#94a3b8';

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.restore();

    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.87, 0, Math.PI * 2);
    ctx.fillStyle = 'white'; ctx.fill();

    const innerR = R * 0.82;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI * 2); ctx.clip();

    const img = p.urlFoto ? (this.photoCache.get(p.urlFoto) ?? null) : null;
    if (img) {
      const diam = innerR * 2;
      const scale = diam / img.naturalWidth;
      const drawW = diam;
      const drawH = img.naturalHeight * scale;
      const dy = drawH > diam ? -(drawH - diam) * 0.15 : (diam - drawH) / 2;
      ctx.drawImage(img, cx - innerR, cy - innerR + dy, drawW, drawH);
    } else {
      const g = ctx.createRadialGradient(cx, cy - innerR * 0.2, 0, cx, cy, innerR);
      g.addColorStop(0, color + 'cc'); g.addColorStop(1, color + '44');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = `bold ${Math.round(R * 0.7)}px Arial`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((p.apellido || '?').charAt(0).toUpperCase(), cx, cy);
    }
    ctx.restore();

    const label = (p.apellido.split(' ')?.[0] ?? '').toUpperCase();
    ctx.font = `700 ${Math.max(9, Math.round(R * 0.36))}px Arial`;
    const textW  = ctx.measureText(label).width;
    const labelW = Math.max(textW + R * 0.5, R * 1.4);
    const labelH = Math.max(10, Math.round(R * 0.52));
    const lx = cx - labelW / 2;
    const ly = cy + R + 2;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.80)';
    ctx.beginPath(); this.pill(ctx, lx, ly, labelW, labelH, labelH / 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, ly + labelH / 2);
    ctx.restore();
  }

  private pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}
