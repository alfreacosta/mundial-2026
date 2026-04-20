import {
  Component, Input, AfterViewInit, OnDestroy, OnChanges,
  SimpleChanges, ViewChild, ElementRef, NgZone, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { JugadorSeleccionable } from '../convocados.component';
import type { PlayerPos } from '../pitch-3d/pitch-3d.component';

const HW = 34;
const HL = 40;
const LY = 0.07;
const LT = 0.055;
const LW = 0.23;

@Component({
  selector: 'app-pitch3d-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pitch3d-wrapper">
      <div #container class="c3d">
        <canvas #overlay class="overlay-cvs"></canvas>
        <div class="loading-msg" *ngIf="!ready">Cargando vista 3D…</div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .pitch3d-wrapper { display: flex; flex-direction: column; width: 100%; }
    .c3d {
      width: 100%;
      height: clamp(360px, 60vw, 580px);
      border-radius: 12px;
      overflow: hidden;
      background: #030d03;
      position: relative;
    }
    .overlay-cvs {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
    }
    .loading-msg {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.35);
      font-size: 13px; font-family: Arial, sans-serif;
      pointer-events: none;
    }
  `]
})
export class Pitch3dViewComponent implements AfterViewInit, OnDestroy, OnChanges {

  @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('overlay')   overlayRef!:   ElementRef<HTMLCanvasElement>;

  @Input() players:        JugadorSeleccionable[] = [];
  @Input() savedPositions: Map<number, PlayerPos>  = new Map();
  @Input() posColorFn:     (codigo?: string) => string = () => '#94a3b8';
  @Input() dtNombre?:  string;
  @Input() dtFotoUrl?: string;
  @Input() paisNombre?: string;
  @Input() paisLogoUrl?: string | null;
  @Input() usuario?: string;

  ready = false;

  private logoImg:    HTMLImageElement | null = null;
  private paisLogoImg: HTMLImageElement | null = null;

  /* Posición actual de cámara (para mostrar en UI) */
  camY   = 63;
  camZ   = 41;
  camLZ  = 0;
  camFov = 70;
  private camX   = 0;
  camAngle = 0; // rotación horizontal en radianes

  /* Getters para el HUD */
  get camPosX(): number { return Math.sin(this.camAngle) * this.camZ; }
  get camPosZ(): number { return Math.cos(this.camAngle) * this.camZ; }
  get camAngleDeg(): number { return this.camAngle * 180 / Math.PI; }

  private T: any;
  private scene:    any;
  private camera:   any;
  private renderer: any;

  private octx!: CanvasRenderingContext2D;
  private dpr = 1;

  private playerData: Array<{
    id: number;
    p: JugadorSeleccionable;
    pct: PlayerPos;
    img: HTMLImageElement | null;
    color: string;
  }> = [];
  private dtImg: HTMLImageElement | null = null;
  private photoCache = new Map<string, HTMLImageElement | null>();

  private animId = 0;
  private ro!: ResizeObserver;

  constructor(private zone: NgZone, private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => this.initThree());
    this.loadLogoImg();
  }

  ngOnChanges(c: SimpleChanges): void {
    if (!this.scene) return;
    if (c['dtFotoUrl']) this.loadDtPhoto();
    if (c['paisLogoUrl']) this.loadPaisLogo();
    if (c['players'] || c['savedPositions'] || c['dtNombre'] || c['dtFotoUrl']) {
      this.buildPlayerData();
    }
  }

  private loadLogoImg(): void {
    const img = new Image();
    img.onload  = () => { this.logoImg = img; };
    img.onerror = () => { this.logoImg = null; };
    img.src = '/images/logodt26.png';
  }

  private loadPaisLogo(): void {
    if (!this.paisLogoUrl) { this.paisLogoImg = null; return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => { this.paisLogoImg = img; };
    img.onerror = () => { this.paisLogoImg = null; };
    img.src = this.paisLogoUrl;
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animId);
    this.ro?.disconnect();
    try { this.renderer?.dispose(); } catch { /* noop */ }
    this.renderer?.domElement?.parentNode?.removeChild(this.renderer.domElement);
  }

  /* ── Controles de cámara ──────────────────────────────────── */
  camMove(action: string): void {
    const step = 4;
    switch (action) {
      case 'up':       this.camY   += step; break;
      case 'down':     this.camY   = Math.max(5, this.camY - step); break;
      case 'in':       this.camZ   = Math.max(5, this.camZ - step); break;
      case 'out':      this.camZ   += step; break;
      case 'tiltUp':   this.camLZ  -= step; break;
      case 'tiltDown': this.camLZ  += step; break;
      case 'rot45':    this.camAngle += Math.PI / 4; break;
      case 'rot-45':   this.camAngle -= Math.PI / 4; break;
      case 'fovIn':    this.camFov  = Math.min(120, this.camFov + 5); break;
      case 'fovOut':   this.camFov  = Math.max(30,  this.camFov - 5); break;
    }
    this.applyCamera();
    this.cdr.detectChanges();
  }

  camReset(): void {
    this.camY = 63; this.camZ = 41; this.camLZ = 0;
    this.camFov = 70; this.camAngle = 0;
    this.applyCamera();
    this.cdr.detectChanges();
  }

  private applyCamera(): void {
    if (!this.camera) return;
    /* Rotación horizontal alrededor del origen */
    const posX = Math.sin(this.camAngle) * this.camZ;
    const posZ = Math.cos(this.camAngle) * this.camZ;
    this.camera.position.set(posX, this.camY, posZ);
    this.camera.fov = this.camFov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, 0, this.camLZ);
  }

  /* ── Init Three.js ────────────────────────────────────────── */
  private async initThree(): Promise<void> {
    try {
      const [threeModule] = await Promise.all([import('three')]);
      this.T = threeModule;

      const container = this.containerRef.nativeElement;
      const w = container.clientWidth  || 360;
      const h = container.clientHeight || 480;

      const scene = new this.T.Scene();
      this.scene = scene;

      {
        const cv = document.createElement('canvas');
        cv.width = 4; cv.height = 512;
        const cx = cv.getContext('2d')!;
        const g = cx.createLinearGradient(0, 0, 0, 512);
        g.addColorStop(0,  '#060d04');
        g.addColorStop(.3, '#041204');
        g.addColorStop(.7, '#030d03');
        g.addColorStop(1,  '#010801');
        cx.fillStyle = g; cx.fillRect(0, 0, 4, 512);
        scene.background = new this.T.CanvasTexture(cv);
      }
      scene.fog = new this.T.Fog(0x041204, 210, 380);

      const camera = new this.T.PerspectiveCamera(this.camFov, w / h, 0.5, 500);
      camera.position.set(0, this.camY, this.camZ);
      camera.lookAt(0, 0, this.camLZ);
      this.camera = camera;

      const renderer = new this.T.WebGLRenderer({ antialias: true, precision: 'highp' });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type    = this.T.PCFSoftShadowMap;
      renderer.toneMapping       = this.T.NoToneMapping;
      renderer.outputColorSpace  = this.T.SRGBColorSpace;
      container.insertBefore(renderer.domElement, container.firstChild);
      renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
      this.renderer = renderer;

      scene.add(new this.T.AmbientLight(0xffffff, 0.60));
      scene.add(new this.T.HemisphereLight(0xfff4d0, 0x1a6412, 0.80));
      const key = new this.T.DirectionalLight(0xfff8e8, 1.55);
      key.position.set(-18, 92, 58);
      key.castShadow = true;
      key.shadow.mapSize.setScalar(2048);
      key.shadow.camera.left   = -80; key.shadow.camera.right = 80;
      key.shadow.camera.top    =  80; key.shadow.camera.bottom = -80;
      key.shadow.camera.near   = 20;  key.shadow.camera.far   = 260;
      key.shadow.bias = -0.001;
      scene.add(key);
      const back = new this.T.DirectionalLight(0xff5500, 0.28);
      back.position.set(14, 55, -88);
      scene.add(back);
      const fillL = new this.T.DirectionalLight(0x2244bb, 0.14);
      fillL.position.set(-88, 32, 12);
      scene.add(fillL);

      scene.add(this.buildGround());
      scene.add(this.buildFieldLines());

      this.dpr  = Math.min(window.devicePixelRatio || 1, 2);
      this.octx = this.overlayRef.nativeElement.getContext('2d')!;
      this.resizeOverlay(w, h);

      this.buildPlayerData();
      if (this.dtFotoUrl) this.loadDtPhoto();

      this.ro = new ResizeObserver(() => this.onResize());
      this.ro.observe(container);

      this.loop();

      this.zone.run(() => { this.ready = true; this.cdr.detectChanges(); });

    } catch (err) {
      console.error('[pitch3d-view] Error:', err);
    }
  }

  private onResize(): void {
    const el = this.containerRef.nativeElement;
    const w  = el.clientWidth  || 360;
    const h  = el.clientHeight || 480;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.resizeOverlay(w, h);
  }

  private resizeOverlay(w: number, h: number): void {
    const cvs = this.overlayRef.nativeElement;
    cvs.width  = w * this.dpr;
    cvs.height = h * this.dpr;
    cvs.style.width  = w + 'px';
    cvs.style.height = h + 'px';
    this.octx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private buildGround(): any {
    const S = 2048;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d')!;

    ctx.fillStyle = '#1a5c0b';
    ctx.fillRect(0, 0, S, S);

    const N = 8, sh = S / N;
    for (let i = 0; i < N; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(50,120,18,0.55)' : 'rgba(5,30,2,0.50)';
      ctx.fillRect(0, i * sh, S, sh);
    }
    for (let i = 0; i < 20000; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const v = 38 + Math.floor(Math.random() * 58);
      ctx.strokeStyle = `rgba(0,${v},0,0.042)`;
      ctx.lineWidth   = 0.38 + Math.random() * 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - .5) * 0.55, y + 1.2 + Math.random() * 3.8);
      ctx.stroke();
    }

    const t = new this.T.CanvasTexture(cv);
    t.wrapS = t.wrapT = this.T.RepeatWrapping;
    t.repeat.set(1, 1);
    t.anisotropy      = this.renderer.capabilities.getMaxAnisotropy();
    t.minFilter       = this.T.LinearMipmapLinearFilter;
    t.magFilter       = this.T.LinearFilter;
    t.generateMipmaps = true;

    const ground = new this.T.Mesh(
      new this.T.PlaneGeometry(165, 118),
      new this.T.MeshStandardMaterial({
        map: t, color: new this.T.Color(.11, .38, .06),
        roughness: .84, metalness: 0,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    return ground;
  }

  private buildFieldLines(): any {
    const grp  = new this.T.Group();
    const wMat = new this.T.MeshBasicMaterial({ color: 0xffffff });

    const fL = (x1: number, z1: number, x2: number, z2: number, w = LW) => {
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.sqrt(dx * dx + dz * dz);
      const m = new this.T.Mesh(new this.T.BoxGeometry(len, LT, w), wMat);
      m.position.set((x1 + x2) / 2, LY, (z1 + z2) / 2);
      m.rotation.y = -Math.atan2(dz, dx);
      grp.add(m);
    };
    const fC = (cx: number, cz: number, r: number, w = LW) => {
      const m = new this.T.Mesh(new this.T.TorusGeometry(r, w / 2, 8, 128), wMat);
      m.rotation.x = Math.PI / 2;
      m.position.set(cx, LY, cz);
      grp.add(m);
    };
    const fArc = (cx: number, cz: number, r: number, a0: number, a1: number, w = LW, segs = 80) => {
      const pts: any[] = [];
      for (let i = 0; i <= segs; i++) {
        const a = a0 + (a1 - a0) * i / segs;
        pts.push(new this.T.Vector3(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r));
      }
      const curve = new this.T.CatmullRomCurve3(pts);
      const m = new this.T.Mesh(new this.T.TubeGeometry(curve, segs, w / 2, 6, false), wMat);
      m.position.y = LY;
      grp.add(m);
    };
    const fDot = (cx: number, cz: number, r = 0.32) => {
      const m = new this.T.Mesh(new this.T.CylinderGeometry(r, r, LT, 16), wMat);
      m.position.set(cx, LY, cz);
      grp.add(m);
    };

    fL(-HW, -HL,  HW, -HL);
    fL( HW, -HL,  HW,  HL);
    fL( HW,  HL, -HW,  HL);
    fL(-HW,  HL, -HW, -HL);
    fL(-HW, 0, HW, 0);
    fC(0, 0, 9.15);
    fDot(0, 0);

    const drawArea = (zs: number) => {
      const gz = zs * HL;
      const PBW = 20.16, PBD = 16.5, GBW = 9.16, GBD = 5.5;
      fL(-PBW, gz,          -PBW, gz - zs * PBD);
      fL(-PBW, gz - zs*PBD,  PBW, gz - zs * PBD);
      fL( PBW, gz - zs*PBD,  PBW, gz);
      fL(-GBW, gz,          -GBW, gz - zs * GBD);
      fL(-GBW, gz - zs*GBD,  GBW, gz - zs * GBD);
      fL( GBW, gz - zs*GBD,  GBW, gz);
      const spotZ = gz - zs * 11;
      fDot(0, spotZ);
      const aInt = Math.asin(5.5 / 9.15);
      const a0 = zs > 0 ? Math.PI + aInt : aInt;
      const a1 = zs > 0 ? 2 * Math.PI - aInt : Math.PI - aInt;
      fArc(0, spotZ, 9.15, a0, a1);
      const GW = 3.66, GD = 2.44;
      fL(-GW, gz,          -GW, gz + zs * GD);
      fL(-GW, gz + zs*GD,   GW, gz + zs * GD);
      fL( GW, gz + zs*GD,   GW, gz);
    };
    drawArea( 1);
    drawArea(-1);

    return grp;
  }

  private buildPlayerData(): void {
    const prev = new Map(this.playerData.map(d => [d.id, d]));
    this.playerData = this.players.map(p => {
      const id    = Number(p.internalId);
      const prevD = prev.get(id);
      const pct   = this.savedPositions.get(id) ?? this.defaultPct(p);
      const color = this.posColorFn(p.posicion?.codigo);
      return { id, p, pct, img: prevD?.img ?? null, color };
    });
    this.loadPhotos();
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
    img.onload = () => { this.photoCache.set(this.dtFotoUrl!, img); this.dtImg = img; };
    img.onerror = () => this.photoCache.set(this.dtFotoUrl!, null);
    img.src = this.dtFotoUrl;
  }

  private projectToScreen(xPct: number, yPct: number): [number, number] | null {
    if (!this.camera || !this.T) return null;
    const worldX = (xPct / 100 * 2 - 1) * HW;
    const worldZ = (yPct / 100 * 2 - 1) * HL;
    const vec = new this.T.Vector3(worldX, 0.5, worldZ);
    vec.project(this.camera);
    if (vec.z > 1) return null;
    const el = this.containerRef.nativeElement;
    const sw = el.clientWidth  || 360;
    const sh = el.clientHeight || 480;
    return [(vec.x + 1) / 2 * sw, (-vec.y + 1) / 2 * sh];
  }

  private tokenRadius(yPct: number): number {
    const sw       = this.containerRef.nativeElement.clientWidth || 360;
    const baseR    = Math.round(sw / 20);
    const depthScale = 0.68 + (yPct / 100) * 0.48;
    return Math.round(baseR * depthScale);
  }

  private loop(): void {
    this.animId = requestAnimationFrame(() => this.loop());
    this.renderer.render(this.scene, this.camera);
    this.drawOverlay();
  }

  private drawOverlay(): void {
    if (!this.octx) return;
    const el = this.containerRef.nativeElement;
    const w  = el.clientWidth  || 360;
    const h  = el.clientHeight || 480;
    this.octx.clearRect(0, 0, w, h);

    // ── Marca de agua diagonal (3× "dt26.win" a 40°) ──────────
    this.drawWatermark(w, h);

    // ── Jugadores ──────────────────────────────────────────────
    const sorted = [...this.playerData].sort((a, b) => a.pct.y - b.pct.y);
    sorted.forEach(d => this.drawToken(d));

    // ── DT (arriba-izquierda fuera de la cancha) ───────────────
    if (this.dtNombre) this.drawDtToken();

    // ── Branding top-left (logo + url) ────────────────────────
    this.drawBranding(w);

    // ── País top-right ─────────────────────────────────────────
    if (this.paisNombre) this.drawPaisLabel(w);
  }

  private drawWatermark(w: number, h: number): void {
    const ctx = this.octx;
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#ffffff';
    const angle = -40 * Math.PI / 180;
    const fontSize = Math.round(w / 10);
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const offsets = [-h * 0.28, 0, h * 0.28];
    for (const dy of offsets) {
      ctx.save();
      ctx.translate(w / 2, h / 2 + dy);
      ctx.rotate(angle);
      ctx.fillText('dt26.win', 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  private drawBranding(w: number): void {
    const ctx    = this.octx;
    const margin = 8;
    const logoSz = Math.round(w / 9);
    const dtR    = Math.round(w / 22);
    const gap    = 8;
    const logoX  = margin;
    const logoY  = margin;

    // Logo DT26
    if (this.logoImg) {
      ctx.save();
      ctx.globalAlpha = 0.90;
      ctx.drawImage(this.logoImg, logoX, logoY, logoSz, logoSz);
      ctx.restore();
    }

    // Texto: a la derecha del DT token
    // DT token center X = margin + logoSz + gap + dtR
    const dtCX  = margin + logoSz + gap + dtR;
    const textX = dtCX + dtR + gap;
    const midY  = margin + Math.round(logoSz / 2);
    const fontSize = Math.round(w / 26);
    const lineH    = fontSize + 5;
    const textTopY = midY - Math.round(lineH * (this.usuario ? 1 : 0.5));

    ctx.save();
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('www.dt26.win', textX, textTopY);
    if (this.usuario) {
      ctx.font = `${Math.round(fontSize * 0.85)}px Arial`;
      ctx.fillStyle = 'rgba(255,255,255,0.50)';
      ctx.fillText(`usuario: ${this.usuario}`, textX, textTopY + lineH);
    }
    ctx.restore();
  }

  private drawPaisLabel(w: number): void {
    const ctx   = this.octx;
    const pad   = 8;
    const logoSz = Math.round(w / 14);
    const fontSize = Math.round(w / 26);
    ctx.font = `bold ${fontSize}px Arial`;
    const textW = ctx.measureText(this.paisNombre ?? '').width;
    const gap   = this.paisLogoImg ? logoSz + 6 : 0;
    const totalW = gap + textW + pad * 2;
    const totalH = Math.max(logoSz, fontSize + 4) + pad;

    // Fondo semitransparente
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    const rx = w - pad - totalW;
    const ry = pad;
    this.pill(ctx, rx, ry, totalW, totalH, totalH / 2);
    ctx.fill();

    // Logo país
    if (this.paisLogoImg) {
      const imgY = ry + (totalH - logoSz) / 2;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.drawImage(this.paisLogoImg, rx + pad, imgY, logoSz, logoSz);
      ctx.restore();
    }

    // Nombre país
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4;
    ctx.fillText(this.paisNombre ?? '', rx + pad + gap, ry + totalH / 2);
    ctx.restore();
  }

  private drawToken(d: typeof this.playerData[0]): void {
    const proj = this.projectToScreen(d.pct.x, d.pct.y);
    if (!proj) return;
    const [cx, cy] = proj;
    const R = this.tokenRadius(d.pct.y);
    const ctx = this.octx;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur  = 8;
    ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = d.color; ctx.fill();
    ctx.restore();

    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = d.color; ctx.fill();

    ctx.beginPath(); ctx.arc(cx, cy, R * 0.87, 0, Math.PI * 2);
    ctx.fillStyle = 'white'; ctx.fill();

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

  private drawDtToken(): void {
    // Posición: a la derecha del logo, centrado verticalmente con él
    const el    = this.containerRef.nativeElement;
    const cssW  = el.clientWidth  || 360;
    const margin = 8;
    const logoSz = Math.round(cssW / 9);
    const cssR   = Math.round(cssW / 22);
    const gap    = 8;
    const cxc   = margin + logoSz + gap + cssR;
    const cyc   = margin + Math.round(logoSz / 2);
    const ctx   = this.octx;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 3;
    ctx.beginPath(); ctx.arc(cxc, cyc, cssR, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b'; ctx.fill();
    ctx.restore();

    ctx.beginPath(); ctx.arc(cxc, cyc, cssR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5; ctx.stroke();

    const innerR = cssR * 0.92;
    ctx.save();
    ctx.beginPath(); ctx.arc(cxc, cyc, innerR, 0, Math.PI * 2); ctx.clip();
    if (this.dtImg) {
      const diam = innerR * 2;
      const drawW = diam;
      const drawH = this.dtImg.naturalHeight * (diam / this.dtImg.naturalWidth);
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

    const apellido = (this.dtNombre?.split(' ').pop() ?? 'DT').toUpperCase();
    ctx.font  = `700 ${Math.round(cssR * 0.36)}px Arial`;
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

  /** Captura la imagen 3D compuesta (WebGL + overlay de jugadores) */
  captureImage(): HTMLCanvasElement {
    // Forzar un render fresco antes de capturar
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
    const webglCanvas  = this.renderer.domElement as HTMLCanvasElement;
    const overlayCanvas = this.overlayRef.nativeElement as HTMLCanvasElement;
    const out = document.createElement('canvas');
    out.width  = webglCanvas.width;
    out.height = webglCanvas.height;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(webglCanvas,  0, 0);
    // El overlay puede tener distinto dpr → escalar al tamaño del output
    ctx.drawImage(overlayCanvas, 0, 0, out.width, out.height);
    return out;
  }

  private pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);     ctx.arcTo(x + w, y,     x + w, y + r,     r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);     ctx.arcTo(x,     y + h, x,     y + h - r, r);
    ctx.lineTo(x, y + r);         ctx.arcTo(x,     y,     x + r, y,         r);
    ctx.closePath();
  }
}
