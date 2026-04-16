import {
  Component, Input, Output, EventEmitter, AfterViewInit,
  OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import type { JugadorSeleccionable } from '../convocados.component';

export interface PlayerPos { x: number; y: number; }

const FW = 60;   // ancho del campo (world units)
const FH = 90;   // alto del campo
const TR = 3.8;  // radio del token del jugador

@Component({
  selector: 'app-pitch-3d',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div #wrap class="p3d-wrap">
      <canvas #cvs class="p3d-canvas"></canvas>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .p3d-wrap {
      width: 100%;
      border-radius: 12px;
      overflow: hidden;
      background: #1a6b2a;
      cursor: grab;
      &:active { cursor: grabbing; }
    }
    .p3d-canvas { width: 100%; height: 100%; display: block; touch-action: none; }
  `]
})
export class PitchThreeDComponent implements AfterViewInit, OnDestroy, OnChanges {

  @ViewChild('cvs') cvsRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('wrap') wrapRef!: ElementRef<HTMLDivElement>;

  @Input() players: JugadorSeleccionable[] = [];
  @Input() savedPositions: Map<number, PlayerPos> = new Map();
  @Input() posColorFn: (codigo?: string) => string = () => '#94a3b8';

  @Output() positionChanged = new EventEmitter<{ jugadorId: number; x: number; y: number }>();

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private raf = 0;
  private ro!: ResizeObserver;
  private needsRender = true;

  private playerGroups = new Map<number, THREE.Group>();
  private texCache     = new Map<string, THREE.Texture>();

  private raycaster  = new THREE.Raycaster();
  private fieldPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private dragging: { id: number; group: THREE.Group } | null = null;

  constructor(private zone: NgZone) {}

  // ─── Lifecycle ────────────────────────────────────────────────

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.init();
      this.buildField();
      this.spawnPlayers();
      this.startLoop();
      this.bindEvents();
      this.ro = new ResizeObserver(() => this.onResize());
      this.ro.observe(this.wrapRef.nativeElement);
    });
  }

  ngOnChanges(c: SimpleChanges): void {
    if (!this.scene) return;
    if (c['players'] || c['savedPositions'])
      this.zone.runOutsideAngular(() => this.spawnPlayers());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.renderer?.dispose();
    this.texCache.forEach(t => t.dispose());
    this.texCache.clear();
  }

  // ─── Init ─────────────────────────────────────────────────────

  private init(): void {
    const w = this.wrapRef.nativeElement.clientWidth || 360;
    const h = this.calcH(w);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.cvsRef.nativeElement,
      antialias: true,
      preserveDrawingBuffer: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1a6b2a');

    this.camera = this.makeCamera(w, h);

    // Luz uniforme para que las fotos no quemen ni se oscurezcan
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const top = new THREE.DirectionalLight(0xffffff, 0.4);
    top.position.set(0, 100, 0);
    this.scene.add(top);
  }

  private makeCamera(w: number, h: number): THREE.OrthographicCamera {
    const aspect = w / h;
    const halfH  = FH / 2 + 5;
    const halfW  = halfH * aspect;
    const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 300);
    cam.position.set(0, 100, 0);
    cam.lookAt(0, 0, 0);
    return cam;
  }

  private calcH(w: number): number {
    return Math.round(w * ((FH + 10) / (FW + 10)));
  }

  // ─── Field ────────────────────────────────────────────────────

  private buildField(): void {
    const texW = 1024;
    const texH = Math.round(texW * (FH / FW));
    const cv   = document.createElement('canvas');
    cv.width = texW; cv.height = texH;
    const ctx  = cv.getContext('2d')!;

    // Franjas
    const N = 10;
    for (let i = 0; i < N; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1e7a2e' : '#228c35';
      ctx.fillRect(0, i * texH / N, texW, texH / N + 1);
    }

    const sx = (v: number) => ((v + FW / 2) / FW) * texW;
    const sy = (v: number) => ((v + FH / 2) / FH) * texH;
    const dw = (v: number) => (v / FW) * texW;
    const dh = (v: number) => (v / FH) * texH;

    ctx.strokeStyle = 'rgba(255,255,255,0.90)';
    ctx.lineWidth = 4; ctx.lineCap = 'round';

    // Borde
    ctx.strokeRect(sx(-FW/2), sy(-FH/2), dw(FW), dh(FH));
    // Línea media
    ctx.beginPath(); ctx.moveTo(sx(-FW/2), sy(0)); ctx.lineTo(sx(FW/2), sy(0)); ctx.stroke();
    // Círculo central
    ctx.beginPath(); ctx.ellipse(sx(0), sy(0), dw(9.15), dh(9.15), 0, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.ellipse(sx(0), sy(0), dw(0.5), dh(0.5), 0, 0, Math.PI*2); ctx.fill();
    // Áreas
    const paW=40.32,paH=16.5,gaW=18.32,gaH=5.5;
    ctx.strokeRect(sx(-paW/2),sy(FH/2-paH),dw(paW),dh(paH));
    ctx.strokeRect(sx(-paW/2),sy(-FH/2),dw(paW),dh(paH));
    ctx.strokeRect(sx(-gaW/2),sy(FH/2-gaH),dw(gaW),dh(gaH));
    ctx.strokeRect(sx(-gaW/2),sy(-FH/2),dw(gaW),dh(gaH));
    // Puntos de penal
    [FH/2-11,-(FH/2-11)].forEach(py=>{
      ctx.fillStyle='rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.ellipse(sx(0),sy(py),dw(0.55),dh(0.55),0,0,Math.PI*2); ctx.fill();
    });
    // Arcos de penal
    ctx.beginPath(); ctx.arc(sx(0),sy(FH/2-11),dh(9.15),Math.PI*1.18,Math.PI*1.82); ctx.stroke();
    ctx.beginPath(); ctx.arc(sx(0),sy(-(FH/2-11)),dh(9.15),Math.PI*0.18,Math.PI*0.82); ctx.stroke();
    // Corners
    [[- FW/2,-FH/2,0,Math.PI/2],[FW/2,-FH/2,Math.PI/2,Math.PI],
     [FW/2,FH/2,Math.PI,3*Math.PI/2],[-FW/2,FH/2,3*Math.PI/2,2*Math.PI]]
    .forEach(([cx,cy,s,e])=>{
      ctx.beginPath(); ctx.arc(sx(cx),sy(cy),dw(1),s,e); ctx.stroke();
    });
    // Arcos (goalposts top-down)
    const gW=7.32, gD=2;
    ctx.strokeRect(sx(-gW/2),sy(FH/2),dw(gW),dh(gD));
    ctx.strokeRect(sx(-gW/2),sy(-FH/2-gD),dw(gW),dh(gD));

    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(FW, FH),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    mesh.rotation.x = -Math.PI / 2;
    this.scene.add(mesh);
    this.requestRender();
  }

  // ─── Players ──────────────────────────────────────────────────

  private spawnPlayers(): void {
    this.playerGroups.forEach(g => this.scene.remove(g));
    this.playerGroups.clear();
    this.players.forEach(p => {
      const grp = this.buildToken(p);
      this.scene.add(grp);
      this.playerGroups.set(Number(p.internalId), grp);
    });
    this.requestRender();
  }

  private buildToken(p: JugadorSeleccionable): THREE.Group {
    const grp = new THREE.Group();
    const pct = this.getPosPct(p);
    const [wx, wz] = this.pctToWorld(pct.x, pct.y);
    grp.position.set(wx, 0, wz);
    grp.userData['id'] = Number(p.internalId);

    const color = this.posColorFn(p.posicion?.codigo);

    // Sombra sutil
    const shdw = new THREE.Mesh(
      new THREE.CircleGeometry(TR + 0.4, 36),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
    );
    shdw.rotation.x = -Math.PI / 2;
    shdw.position.set(0.25, 0.01, 0.25);
    grp.add(shdw);

    // Disco de foto — placeholder con inicial
    const placeHolder = this.makeInitialTex(p.apellido || p.nombre || '?', color);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(TR, 48),
      new THREE.MeshBasicMaterial({ map: placeHolder, side: THREE.FrontSide, transparent: true })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.05;
    grp.add(disc);

    // Anillo de color de posición (ring encima del disco)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(TR - 0.55, TR, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.FrontSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    grp.add(ring);

    // Anillo blanco fino
    const ringW = new THREE.Mesh(
      new THREE.RingGeometry(TR - 0.9, TR - 0.55, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.70, side: THREE.FrontSide })
    );
    ringW.rotation.x = -Math.PI / 2;
    ringW.position.y = 0.065;
    grp.add(ringW);

    // Label apellido
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(TR * 2.2, TR * 0.72),
      new THREE.MeshBasicMaterial({
        map: this.makeNameTex(p.apellido?.split(' ')?.[0] ?? p.nombre ?? '', color),
        transparent: true, side: THREE.DoubleSide, depthWrite: false
      })
    );
    label.rotation.x = -Math.PI / 2;
    label.position.set(0, 0.07, TR + TR * 0.42);
    grp.add(label);

    // Carga foto async
    if (p.urlFoto) {
      this.loadPhoto(p.urlFoto, color).then(tex => {
        if (!this.scene) return;
        disc.material = new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide, transparent: true });
        this.requestRender();
      });
    }

    return grp;
  }

  // ─── Textures ─────────────────────────────────────────────────

  private makeInitialTex(name: string, color: string): THREE.Texture {
    const S = 256, c = S / 2, r = S / 2 - 4;
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const ctx = cv.getContext('2d')!;
    // Fondo degradado con el color de posición
    const g = ctx.createRadialGradient(c, c - 10, 0, c, c, r);
    g.addColorStop(0, color + 'cc'); g.addColorStop(1, color + '44');
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    // Inicial
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `bold ${Math.round(S * 0.38)}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name.charAt(0).toUpperCase(), c, c);
    return new THREE.CanvasTexture(cv);
  }

  private async loadPhoto(url: string, borderColor: string): Promise<THREE.Texture> {
    const key = url + borderColor;
    if (this.texCache.has(key)) return this.texCache.get(key)!;
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const S = 256, c = S / 2, r = S / 2 - 4;
        const cv = document.createElement('canvas');
        cv.width = S; cv.height = S;
        const ctx = cv.getContext('2d')!;
        // Clip circular
        ctx.save();
        ctx.beginPath(); ctx.arc(c, c, r - 8, 0, Math.PI * 2); ctx.clip();
        // Recortar la mitad superior de la foto (zona del rostro)
        const sw = img.naturalWidth;
        const sh = Math.round(img.naturalHeight * 0.62);
        ctx.drawImage(img, 0, 0, sw, sh, 4, 4, S - 8, S - 8);
        ctx.restore();
        const tex = new THREE.CanvasTexture(cv);
        this.texCache.set(key, tex);
        resolve(tex);
      };
      img.onerror = () => resolve(this.makeInitialTex('?', borderColor));
      img.src = url;
    });
  }

  private makeNameTex(name: string, color: string): THREE.Texture {
    const W = 224, H = 52;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d')!;
    const r = H / 2 - 2;
    // Pill oscura
    ctx.fillStyle = 'rgba(0,0,0,0.80)';
    ctx.beginPath();
    ctx.moveTo(r + 2, 2); ctx.arcTo(W-2, 2, W-2, H-2, r);
    ctx.arcTo(W-2, H-2, 2, H-2, r); ctx.arcTo(2, H-2, 2, 2, r);
    ctx.arcTo(2, 2, W-2, 2, r); ctx.closePath(); ctx.fill();
    // Borde del color de posición
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
    // Texto
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 20px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 2;
    ctx.fillText(name.toUpperCase(), W / 2, H / 2 + 0.5);
    return new THREE.CanvasTexture(cv);
  }

  // ─── Position helpers ─────────────────────────────────────────

  private getPosPct(p: JugadorSeleccionable): PlayerPos {
    const id = Number(p.internalId);
    return this.savedPositions.get(id) ?? this.defaultPct(p);
  }

  private defaultPct(p: JugadorSeleccionable): PlayerPos {
    const code = p.posicion?.codigo ?? 'MED';
    const same  = this.players.filter(t => t.posicion?.codigo === code);
    const idx   = same.findIndex(t => t.internalId === p.internalId);
    const n     = same.length;
    const x     = n > 1 ? 15 + idx * (70 / (n - 1)) : 50;
    const yMap: Record<string, number> = { ARQ: 88, DEF: 65, MED: 40, DEL: 15 };
    return { x, y: yMap[code] ?? 50 };
  }

  private pctToWorld(xp: number, yp: number): [number, number] {
    return [(xp / 100 - 0.5) * FW, (yp / 100 - 0.5) * FH];
  }

  private worldToPct(wx: number, wz: number): PlayerPos {
    return {
      x: Math.max(2, Math.min(98, (wx / FW + 0.5) * 100)),
      y: Math.max(2, Math.min(98, (wz / FH + 0.5) * 100))
    };
  }

  // ─── Render on-demand ─────────────────────────────────────────

  private startLoop(): void {
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      if (!this.needsRender) return;
      this.needsRender = false;
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  private requestRender(): void { this.needsRender = true; }

  // ─── Resize ───────────────────────────────────────────────────

  private onResize(): void {
    const w = this.wrapRef.nativeElement.clientWidth;
    if (!w) return;
    const h = this.calcH(w);
    const aspect = w / h;
    const halfH = FH / 2 + 5, halfW = halfH * aspect;
    this.camera.left = -halfW; this.camera.right = halfW;
    this.camera.top  =  halfH; this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.requestRender();
  }

  // ─── Drag ─────────────────────────────────────────────────────

  private bindEvents(): void {
    const cvs = this.cvsRef.nativeElement;
    cvs.addEventListener('pointerdown',   e => this.onDown(e),  { passive: false });
    cvs.addEventListener('pointermove',   e => this.onMove(e),  { passive: false });
    cvs.addEventListener('pointerup',     e => this.onUp(e));
    cvs.addEventListener('pointercancel', () => { this.dragging = null; });
  }

  private ndc(e: PointerEvent): THREE.Vector2 {
    const r = this.cvsRef.nativeElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - r.left) / r.width)  *  2 - 1,
      -((e.clientY - r.top)  / r.height) *  2 + 1
    );
  }

  private onDown(e: PointerEvent): void {
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    const candidates: THREE.Object3D[] = [];
    this.playerGroups.forEach(g => g.children.forEach(c => candidates.push(c)));
    const hits = this.raycaster.intersectObjects(candidates, false);
    if (!hits.length) return;
    const hit = hits[0].object;
    this.playerGroups.forEach((grp, id) => {
      if (grp.children.some(c => c === hit)) this.dragging = { id, group: grp };
    });
    if (this.dragging) {
      e.preventDefault();
      this.cvsRef.nativeElement.setPointerCapture(e.pointerId);
    }
  }

  private onMove(e: PointerEvent): void {
    if (!this.dragging) return;
    e.preventDefault();
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    const pt = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.fieldPlane, pt)) {
      const hw = FW / 2 - TR, hh = FH / 2 - TR;
      pt.x = Math.max(-hw, Math.min(hw, pt.x));
      pt.z = Math.max(-hh, Math.min(hh, pt.z));
      this.dragging.group.position.set(pt.x, 0, pt.z);
      this.requestRender();
    }
  }

  private onUp(e: PointerEvent): void {
    if (!this.dragging) return;
    const { id, group } = this.dragging;
    const pct = this.worldToPct(group.position.x, group.position.z);
    this.zone.run(() => this.positionChanged.emit({ jugadorId: id, x: pct.x, y: pct.y }));
    this.dragging = null;
    this.cvsRef.nativeElement.releasePointerCapture(e.pointerId);
  }

  // ─── Export ───────────────────────────────────────────────────

  captureSnapshot(username?: string, countryName?: string, date?: string): HTMLCanvasElement {
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement;
    const out = document.createElement('canvas');
    out.width = src.width; out.height = src.height;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(src, 0, 0);
    const dpr = Math.min(window.devicePixelRatio, 2);
    const W = out.width, H = out.height;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.font = `bold ${Math.round(32*dpr)}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('dt26.win', W/2, H/2);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = `600 ${Math.round(10*dpr)}px Arial`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('dt26.win', 12*dpr, 10*dpr);
    if (username) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.font = `500 ${Math.round(8*dpr)}px Arial`;
      ctx.fillText(`@${username}`, 12*dpr, 22*dpr);
    }
    if (countryName || date) {
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.font = `500 ${Math.round(8*dpr)}px Arial`;
      ctx.textAlign = 'right';
      ctx.fillText(`${countryName??''} · ${date??''}`, W-12*dpr, 10*dpr);
    }
    return out;
  }
}


export interface PlayerPos { x: number; y: number; }

// ────────────────────────────────────────────────────────────────
//  Pitch3D – Three.js broadcast-style interactive football pitch
// ────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-pitch-3d',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div #wrap class="p3d-wrap">
      <canvas #cvs class="p3d-canvas"></canvas>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .p3d-wrap {
      width: 100%;
      position: relative;
      background: #071a07;
      cursor: grab;
      &:active { cursor: grabbing; }
    }
    .p3d-canvas {
      width: 100%;
      height: 100%;
      display: block;
      touch-action: none;
      outline: none;
    }
  `]
})
export class PitchThreeDComponent implements AfterViewInit, OnDestroy, OnChanges {

  @ViewChild('cvs') cvsRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('wrap') wrapRef!: ElementRef<HTMLDivElement>;

  @Input() players: JugadorSeleccionable[] = [];
  @Input() savedPositions: Map<number, PlayerPos> = new Map();
  @Input() posColorFn: (codigo?: string) => string = () => '#94a3b8';

  @Output() positionChanged = new EventEmitter<{ jugadorId: number; x: number; y: number }>();

  // ── Three.js core ─────────────────────────────────────────────
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private raf = 0;
  private ro!: ResizeObserver;

  // ── Field world dimensions (world units ≈ meters) ─────────────
  private readonly FW = 60;   // width
  private readonly FH = 90;   // height

  // ── Meshes ────────────────────────────────────────────────────
  private playerGroups = new Map<number, THREE.Group>();
  private texCache = new Map<string, THREE.Texture>();

  // ── Drag state ────────────────────────────────────────────────
  private fieldPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private raycaster = new THREE.Raycaster();
  private dragging: { id: number; group: THREE.Group } | null = null;

  constructor(private zone: NgZone) {}

  // ════════════════════════════════════════ LIFECYCLE ═══════════

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.initThree();
      this.buildField();
      this.spawnPlayers();
      this.startLoop();
      this.requestRender();
      this.bindEvents();
      this.ro = new ResizeObserver(() => this.onResize());
      this.ro.observe(this.wrapRef.nativeElement);
    });
  }

  ngOnChanges(c: SimpleChanges): void {
    if (!this.scene) return;
    if (c['players'] || c['savedPositions']) {
      this.zone.runOutsideAngular(() => this.spawnPlayers());
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.renderer?.dispose();
    this.texCache.forEach(t => t.dispose());
    this.texCache.clear();
  }

  // ════════════════════════════════════════ INIT ════════════════

  private initThree(): void {
    const canvas = this.cvsRef.nativeElement;
    const w = this.wrapRef.nativeElement.clientWidth || 360;
    const h = Math.round(w * (4 / 3));

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true   // needed for PNG export
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#071a07');
    // Sin fog — impide ver jugadores del fondo con claridad

    // Camera – más cenital para reducir el efecto de miniaturización en perspectiva
    this.camera = new THREE.PerspectiveCamera(65, w / h, 0.5, 600);
    this.camera.position.set(0, 145, 38);
    this.camera.lookAt(0, 0, -18);

    // Ambient light — suave, no sobreexpone las fotos
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));

    // Main sun (directional) — menos intenso para no quemar las texturas
    const sun = new THREE.DirectionalLight(0xfff8e7, 1.3);
    sun.position.set(25, 90, -30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.near = 1; sc.far = 260;
    sc.left = -65; sc.right = 65; sc.top = 70; sc.bottom = -70;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);

    // Fill suave
    const fill = new THREE.DirectionalLight(0x9ac8ff, 0.3);
    fill.position.set(-20, 45, 40);
    this.scene.add(fill);

    // Ground under the stadium
    const gGeo = new THREE.PlaneGeometry(400, 400);
    const gMat = new THREE.MeshLambertMaterial({ color: '#061206' });
    const ground = new THREE.Mesh(gGeo, gMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  // ════════════════════════════════════════ FIELD ═══════════════

  private buildField(): void {
    const FW = this.FW, FH = this.FH;

    // ── Canvas texture with proper football markings ────────────
    const texW = 1024, texH = Math.round(texW * (FH / FW));
    const cv = document.createElement('canvas');
    cv.width = texW; cv.height = texH;
    const ctx = cv.getContext('2d')!;

    // Green pitch stripes
    const stripes = 12;
    const sh = texH / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1a6b2a' : '#1e803a';
      ctx.fillRect(0, i * sh, texW, sh + 1);
    }

    // Helper scale functions
    const sx = (v: number) => ((v + FW / 2) / FW) * texW;
    const sy = (v: number) => ((v + FH / 2) / FH) * texH;
    const dw = (v: number) => (v / FW) * texW;
    const dh = (v: number) => (v / FH) * texH;

    const markStyle = 'rgba(255,255,255,0.88)';
    ctx.strokeStyle = markStyle;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const strokeRect = (x: number, y: number, w: number, h: number) =>
      ctx.strokeRect(sx(x), sy(y), dw(w), dh(h));

    const fillDot = (cx: number, cy: number, r: number) => {
      ctx.fillStyle = markStyle;
      ctx.beginPath();
      ctx.arc(sx(cx), sy(cy), dw(r), 0, Math.PI * 2);
      ctx.fill();
    };

    const strokeOval = (cx: number, cy: number, r: number) => {
      ctx.beginPath();
      ctx.ellipse(sx(cx), sy(cy), dw(r), dh(r), 0, 0, Math.PI * 2);
      ctx.stroke();
    };

    // Outer border
    strokeRect(-FW / 2, -FH / 2, FW, FH);

    // Halfway line
    ctx.beginPath();
    ctx.moveTo(sx(-FW / 2), sy(0));
    ctx.lineTo(sx(FW / 2), sy(0));
    ctx.stroke();

    // Center circle (r = 9.15m)
    strokeOval(0, 0, 9.15);
    fillDot(0, 0, 0.7);

    // Penalty areas (top and bottom)
    const paW = 40.32, paH = 16.5;
    strokeRect(-paW / 2, FH / 2 - paH, paW, paH);
    strokeRect(-paW / 2, -FH / 2, paW, paH);

    // Goal areas
    const gaW = 18.32, gaH = 5.5;
    strokeRect(-gaW / 2, FH / 2 - gaH, gaW, gaH);
    strokeRect(-gaW / 2, -FH / 2, gaW, gaH);

    // Penalty spots
    fillDot(0, FH / 2 - 11, 0.6);
    fillDot(0, -FH / 2 + 11, 0.6);

    // Penalty arcs
    ctx.save();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(sx(0), sy(FH / 2 - 11), dh(9.15), Math.PI * 1.20, Math.PI * 1.80);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx(0), sy(-FH / 2 + 11), dh(9.15), Math.PI * 0.20, Math.PI * 0.80);
    ctx.stroke();
    ctx.restore();

    // Corner arcs (r = 1m)
    const corners = [
      { x: -FW / 2, y: -FH / 2, s: 0, e: Math.PI / 2 },
      { x: FW / 2, y: -FH / 2, s: Math.PI / 2, e: Math.PI },
      { x: FW / 2, y: FH / 2, s: Math.PI, e: 3 * Math.PI / 2 },
      { x: -FW / 2, y: FH / 2, s: 3 * Math.PI / 2, e: 2 * Math.PI },
    ];
    corners.forEach(c => {
      ctx.beginPath();
      ctx.arc(sx(c.x), sy(c.y), dw(1), c.s, c.e);
      ctx.stroke();
    });

    // Goals (extensions of goal lines)
    const goalW = 7.32, goalExt = 2.5;
    strokeRect(-goalW / 2, FH / 2, goalW, goalExt);
    strokeRect(-goalW / 2, -FH / 2 - goalExt, goalW, goalExt);

    // Subtle vignette
    const vig = ctx.createRadialGradient(texW / 2, texH / 2, texH * 0.15,
      texW / 2, texH / 2, texH * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, texW, texH);

    const fieldTex = new THREE.CanvasTexture(cv);
    fieldTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    // ── Pitch plane ─────────────────────────────────────────────
    const pGeo = new THREE.PlaneGeometry(FW, FH);
    const pMat = new THREE.MeshLambertMaterial({ map: fieldTex });
    const pitch = new THREE.Mesh(pGeo, pMat);
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    this.scene.add(pitch);

    // ── 3D Goals ────────────────────────────────────────────────
    this.buildGoal(FH / 2 + goalExt / 2, 1);
    this.buildGoal(-FH / 2 - goalExt / 2, -1);

    // ── Stadium bowl (dark curved wall) ─────────────────────────
    const bowlGeo = new THREE.CylinderGeometry(110, 90, 50, 64, 1, true);
    const bowlMat = new THREE.MeshBasicMaterial({
      color: '#0a1a0a', side: THREE.BackSide, transparent: true, opacity: 0.92
    });
    this.scene.add(new THREE.Mesh(bowlGeo, bowlMat));

    // Stadium lights — menos intensos
    const lightPositions = [[-55, 40, -50], [55, 40, -50], [55, 40, 55], [-55, 40, 55]] as const;
    lightPositions.forEach(([lx, ly, lz]) => {
      const pt = new THREE.PointLight(0xfff0cc, 40, 160, 1.5);
      pt.position.set(lx, ly, lz);
      this.scene.add(pt);
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.6, 40, 6),
        new THREE.MeshBasicMaterial({ color: '#334433' })
      );
      tower.position.set(lx, 20, lz);
      this.scene.add(tower);
    });
  }

  private buildGoal(zPos: number, dir: number): void {
    const mat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 100 });
    const postR = 0.14;
    const goalW = 7.32, goalH = 2.44, goalD = 2.5;

    const lPost = new THREE.Mesh(new THREE.CylinderGeometry(postR, postR, goalH, 10), mat);
    lPost.position.set(-goalW / 2, goalH / 2, zPos);
    lPost.castShadow = true;
    this.scene.add(lPost);

    const rPost = lPost.clone();
    rPost.position.set(goalW / 2, goalH / 2, zPos);
    this.scene.add(rPost);

    const bar = new THREE.Mesh(new THREE.CylinderGeometry(postR, postR, goalW, 10), mat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, goalH, zPos);
    bar.castShadow = true;
    this.scene.add(bar);

    // Net
    const netMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.07, side: THREE.DoubleSide
    });
    const netBack = new THREE.Mesh(new THREE.PlaneGeometry(goalW, goalH), netMat);
    netBack.position.set(0, goalH / 2, zPos + dir * goalD / 2);
    this.scene.add(netBack);

    const netTop = new THREE.Mesh(new THREE.PlaneGeometry(goalW, goalD), netMat);
    netTop.rotation.x = -Math.PI / 2;
    netTop.position.set(0, goalH, zPos + dir * goalD / 4);
    this.scene.add(netTop);

    // Side nets
    [-1, 1].forEach(side => {
      const sideNet = new THREE.Mesh(new THREE.PlaneGeometry(goalD, goalH), netMat);
      sideNet.rotation.y = Math.PI / 2;
      sideNet.position.set(side * goalW / 2, goalH / 2, zPos + dir * goalD / 4);
      this.scene.add(sideNet);
    });
  }

  // ════════════════════════════════════════ PLAYERS ═════════════

  private spawnPlayers(): void {
    this.playerGroups.forEach(g => this.scene.remove(g));
    this.playerGroups.clear();

    this.players.forEach(p => {
      const grp = this.createPlayerGroup(p);
      this.scene.add(grp);
      this.playerGroups.set(Number(p.internalId), grp);
    });
    this.requestRender();
  }

  private createPlayerGroup(p: JugadorSeleccionable): THREE.Group {
    const grp = new THREE.Group();
    const pct = this.getPosPct(p);
    const [wx, wz] = this.pctToWorld(pct.x, pct.y);
    grp.position.set(wx, 0, wz);
    grp.userData['id'] = Number(p.internalId);
    grp.scale.setScalar(2.6);

    const posColor = this.posColorFn(p.posicion?.codigo);
    const threeColor = new THREE.Color(posColor);

    // ── Floor glow (shadow disc) ─────────────────────────────────
    const glowMat = new THREE.MeshBasicMaterial({
      color: threeColor, transparent: true, opacity: 0.22, side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(new THREE.CircleGeometry(2.4, 36), glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.02;
    grp.add(glow);

    // ── Cylinder base ─────────────────────────────────────────────
    const cylMat = new THREE.MeshPhongMaterial({
      color: threeColor,
      emissive: threeColor,
      emissiveIntensity: 0.18,
      shininess: 140,
    });
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 0.35, 36), cylMat);
    cyl.position.y = 0.18;
    cyl.castShadow = true;
    cyl.receiveShadow = true;
    grp.add(cyl);

    // ── Inner ring (white border on top of cylinder) ─────────────
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.FrontSide
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.65, 36), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.37;
    grp.add(ring);

    // ── Photo disc (async load) ───────────────────────────────────
    const photoGeo = new THREE.CircleGeometry(1.35, 36);
    let placeholderMat: THREE.MeshBasicMaterial;

    if (p.urlFoto) {
      placeholderMat = new THREE.MeshBasicMaterial({ color: threeColor.clone().multiplyScalar(1.3), side: THREE.FrontSide });
      const photoDisc = new THREE.Mesh(photoGeo, placeholderMat);
      photoDisc.rotation.x = -Math.PI / 2;
      photoDisc.position.y = 0.37;
      grp.add(photoDisc);

      this.loadPhotoTex(p.urlFoto, posColor).then(tex => {
        if (!this.scene) return;
        const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide, transparent: true });
        photoDisc.material = mat;
        this.requestRender();
      });
    } else {
      const initTex = this.makeInitialsTex(p.apellido || p.nombre || '?', posColor);
      const initMat = new THREE.MeshBasicMaterial({ map: initTex, side: THREE.FrontSide });
      const initDisc = new THREE.Mesh(photoGeo, initMat);
      initDisc.rotation.x = -Math.PI / 2;
      initDisc.position.y = 0.37;
      grp.add(initDisc);
    }

    // ── Name label ───────────────────────────────────────────────
    const firstName = p.apellido?.split(' ')?.[0] ?? p.nombre ?? '';
    const nameTex = this.makeNameTex(firstName, posColor);
    const nameMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(5.2, 1.3),
      new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, side: THREE.DoubleSide, depthWrite: false })
    );
    nameMesh.rotation.x = -Math.PI / 2;
    nameMesh.position.set(0, 0.02, 2.6);
    grp.add(nameMesh);

    return grp;
  }

  // ════════════════════════════════════════ POSITION HELPERS ════

  private getPosPct(p: JugadorSeleccionable): PlayerPos {
    const id = Number(p.internalId);
    return this.savedPositions.has(id) ? this.savedPositions.get(id)! : this.calcDefaultPct(p);
  }

  private calcDefaultPct(p: JugadorSeleccionable): PlayerPos {
    const code = p.posicion?.codigo ?? 'MED';
    const samePos = this.players.filter(t => t.posicion?.codigo === code);
    const idx = samePos.findIndex(t => t.internalId === p.internalId);
    const count = samePos.length;
    const x = count > 1 ? 15 + idx * (70 / (count - 1)) : 50;
    const yMap: Record<string, number> = { ARQ: 88, DEF: 64, MED: 38, DEL: 12 };
    return { x, y: yMap[code] ?? 50 };
  }

  private pctToWorld(xPct: number, yPct: number): [number, number] {
    return [(xPct / 100 - 0.5) * this.FW, (yPct / 100 - 0.5) * this.FH];
  }

  private worldToPct(wx: number, wz: number): PlayerPos {
    return {
      x: Math.max(2, Math.min(98, (wx / this.FW + 0.5) * 100)),
      y: Math.max(2, Math.min(98, (wz / this.FH + 0.5) * 100))
    };
  }

  // ════════════════════════════════════════ TEXTURE HELPERS ═════

  private async loadPhotoTex(url: string, borderColor: string): Promise<THREE.Texture> {
    if (this.texCache.has(url)) return this.texCache.get(url)!;
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const size = 128;
        const cv = document.createElement('canvas');
        cv.width = size; cv.height = size;
        const ctx = cv.getContext('2d')!;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, 0, 0, size, size);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 5;
        ctx.stroke();
        const tex = new THREE.CanvasTexture(cv);
        this.texCache.set(url, tex);
        resolve(tex);
      };
      img.onerror = () => resolve(this.makeInitialsTex('?', borderColor));
      img.src = url;
    });
  }

  private makeInitialsTex(name: string, color: string): THREE.Texture {
    const size = 128;
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const ctx = cv.getContext('2d')!;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = color + '44';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = 'white';
    ctx.font = `bold ${Math.round(size * 0.45)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText(name.charAt(0).toUpperCase(), size / 2, size / 2);
    return new THREE.CanvasTexture(cv);
  }

  private makeNameTex(name: string, accentColor: string): THREE.Texture {
    const w = 256, h = 58;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d')!;
    const r = h / 2;

    // Pill background
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.beginPath();
    ctx.moveTo(r, 2); ctx.lineTo(w - r, 2);
    ctx.arcTo(w - 2, 2, w - 2, h - 2, r - 2);
    ctx.lineTo(w - 2, h - r);
    ctx.arcTo(w - 2, h - 2, w - r, h - 2, r - 2);
    ctx.lineTo(r, h - 2);
    ctx.arcTo(2, h - 2, 2, h - r, r - 2);
    ctx.lineTo(2, r);
    ctx.arcTo(2, 2, r, 2, r - 2);
    ctx.closePath();
    ctx.fill();

    // Accent bottom border
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 22px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(name.toUpperCase(), w / 2, h / 2 + 1);

    return new THREE.CanvasTexture(cv);
  }

  // ════════════════════════════════════════ RENDER LOOP ══════════

  needsRender = true;

  private startLoop(): void {
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      if (!this.needsRender) return;
      this.needsRender = false;
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  private requestRender(): void {
    this.needsRender = true;
  }

  // ════════════════════════════════════════ RESIZE ══════════════

  private onResize(): void {
    const wrap = this.wrapRef.nativeElement;
    const w = wrap.clientWidth;
    if (!w) return;
    const h = Math.round(w * (4 / 3));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.requestRender();
  }

  // ════════════════════════════════════════ DRAG ════════════════

  private bindEvents(): void {
    const cvs = this.cvsRef.nativeElement;
    cvs.addEventListener('pointerdown', e => this.onDown(e), { passive: false });
    cvs.addEventListener('pointermove', e => this.onMove(e), { passive: false });
    cvs.addEventListener('pointerup', e => this.onUp(e));
    cvs.addEventListener('pointercancel', () => { this.dragging = null; });
  }

  private getNDC(e: PointerEvent): THREE.Vector2 {
    const rect = this.cvsRef.nativeElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  private onDown(e: PointerEvent): void {
    const ndc = this.getNDC(e);
    this.raycaster.setFromCamera(ndc, this.camera);
    // Collect all child meshes of each player group
    const candidates: THREE.Object3D[] = [];
    this.playerGroups.forEach(g => g.children.forEach(c => candidates.push(c)));
    const hits = this.raycaster.intersectObjects(candidates, false);
    if (!hits.length) return;

    const hitObj = hits[0].object;
    this.playerGroups.forEach((grp, id) => {
      if (grp.children.some(c => c === hitObj)) {
        this.dragging = { id, group: grp };
      }
    });
    if (this.dragging) {
      e.preventDefault();
      (cvs => cvs.setPointerCapture(e.pointerId))(this.cvsRef.nativeElement);
    }
  }

  private onMove(e: PointerEvent): void {
    if (!this.dragging) return;
    e.preventDefault();
    const ndc = this.getNDC(e);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.fieldPlane, hit)) {
      const hw = this.FW / 2 + 2, hh = this.FH / 2 + 2;
      hit.x = Math.max(-hw, Math.min(hw, hit.x));
      hit.z = Math.max(-hh, Math.min(hh, hit.z));
      this.dragging.group.position.set(hit.x, 0, hit.z);
      this.requestRender();
    }
  }

  private onUp(e: PointerEvent): void {
    if (!this.dragging) return;
    const { id, group } = this.dragging;
    const pct = this.worldToPct(group.position.x, group.position.z);
    this.zone.run(() => this.positionChanged.emit({ jugadorId: id, x: pct.x, y: pct.y }));
    this.dragging = null;
    this.cvsRef.nativeElement.releasePointerCapture(e.pointerId);
  }

  // ════════════════════════════════════════ EXPORT ══════════════

  /** Genera canvas 2D con el render actual + watermarks para exportar PNG */
  captureSnapshot(username?: string, countryName?: string, date?: string): HTMLCanvasElement {
    // Force a clean render
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement;

    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d')!;

    // Paste 3D render
    ctx.drawImage(src, 0, 0);

    // Scale factor
    const dpr = Math.min(window.devicePixelRatio, 2);
    const W = out.width, H = out.height;

    // ── Watermarks ──────────────────────────────────────────────
    // Center watermark (faint)
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.055)';
    ctx.font = `bold ${Math.round(36 * dpr)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('dt26.win', 0, 0);
    ctx.restore();

    // Top-left: site + user
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.font = `600 ${Math.round(11 * dpr)}px Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('dt26.win', 12 * dpr, 10 * dpr);
    if (username) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.font = `500 ${Math.round(9 * dpr)}px Arial`;
      ctx.fillText(`@${username}`, 12 * dpr, 24 * dpr);
    }

    // Top-right: country + date
    if (countryName || date) {
      ctx.fillStyle = 'rgba(255,255,255,0.24)';
      ctx.font = `500 ${Math.round(9 * dpr)}px Arial`;
      ctx.textAlign = 'right';
      ctx.fillText(`${countryName ?? ''} · ${date ?? ''}`, W - 12 * dpr, 10 * dpr);
    }

    return out;
  }
}
