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
