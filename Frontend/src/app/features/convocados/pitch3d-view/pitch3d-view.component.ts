import {
  Component, Input, AfterViewInit, OnDestroy, OnChanges,
  SimpleChanges, ViewChild, ElementRef, NgZone, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { JugadorSeleccionable } from '../convocados.component';
import type { PlayerPos } from '../pitch-3d/pitch-3d.component';

/* ── Dimensiones del campo 3D (en unidades de la escena) ── */
const HW = 34;   // semi-ancho  (~34m)
const HL = 40;   // semi-largo  (~40m, campo = 80m)
const LY = 0.07; // altura sobre el pasto
const LT = 0.055;
const LW = 0.23;

/* ── Colores por posición ── */
const POS_HEX: Record<string, number> = {
  POR: 0xf59e0b, ARQ: 0xf59e0b,
  DEF: 0x3b82f6,
  MED: 0x10b981,
  DEL: 0xef4444,
};
const POS_GLOW: Record<string, string> = {
  POR: '#f59e0b', ARQ: '#f59e0b',
  DEF: '#3b82f6',
  MED: '#10b981',
  DEL: '#ef4444',
};

@Component({
  selector: 'app-pitch3d-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div #container class="c3d">
      <div class="loading" *ngIf="!ready">
        <span>Cargando vista 3D…</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .c3d {
      width: 100%;
      height: clamp(340px, 56vw, 540px);
      border-radius: 12px;
      overflow: hidden;
      background: #030d03;
      position: relative;
    }
    .loading {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.4); font-size: 14px; font-family: Arial, sans-serif;
    }
    /* Etiquetas CSS2D */
    :host ::ng-deep .lbl3d {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 9px; font-weight: 900;
      color: #fff; text-transform: uppercase;
      letter-spacing: 1.6px; white-space: nowrap;
      pointer-events: none;
      background: rgba(0,0,0,.55);
      border: 1px solid rgba(255,255,255,.22);
      border-radius: 7px;
      padding: 1px 7px;
      text-shadow: 0 1px 4px #000;
    }
  `]
})
export class Pitch3dViewComponent implements AfterViewInit, OnDestroy, OnChanges {

  @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;

  @Input() players: JugadorSeleccionable[] = [];
  @Input() savedPositions: Map<number, PlayerPos> = new Map();
  @Input() posColorFn: (codigo?: string) => string = () => '#94a3b8';
  @Input() dtNombre?: string;
  @Input() dtFotoUrl?: string;

  ready = false;

  /* Three.js objects (typed as any para evitar import estático) */
  private T: any;         // módulo three
  private CSS2DO: any;    // CSS2DObject class
  private scene: any;
  private camera: any;
  private renderer: any;
  private css2dR: any;
  private glowMeshes: any[] = [];
  private tokenGroup: any;
  private animId = 0;
  private fr = 0;
  private ro!: ResizeObserver;

  constructor(private zone: NgZone, private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.initThree();
    });
  }

  ngOnChanges(c: SimpleChanges): void {
    if (!this.scene) return;
    if (c['players'] || c['savedPositions']) {
      this.zone.runOutsideAngular(() => this.rebuildTokens());
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animId);
    this.ro?.disconnect();
    try { this.renderer?.dispose(); } catch { /* noop */ }
    this.css2dR?.domElement?.parentNode?.removeChild(this.css2dR.domElement);
    this.renderer?.domElement?.parentNode?.removeChild(this.renderer.domElement);
  }

  /* ── Carga lazy de Three.js ─────────────────────────────── */
  private async initThree(): Promise<void> {
    try {
      const [threeModule, css2dModule] = await Promise.all([
        import('three'),
        import(/* @vite-ignore */ 'three/addons/renderers/CSS2DRenderer.js'),
      ]);
      this.T       = threeModule;
      this.CSS2DO  = css2dModule.CSS2DObject;
      const CSS2DR = css2dModule.CSS2DRenderer;

      const container = this.containerRef.nativeElement;
      const w = container.clientWidth  || 360;
      const h = container.clientHeight || 480;

      /* Escena */
      const scene = new this.T.Scene();
      this.scene = scene;

      /* Fondo: degradado oscuro verde/negro */
      {
        const cv = document.createElement('canvas');
        cv.width = 4; cv.height = 512;
        const cx = cv.getContext('2d')!;
        const g = cx.createLinearGradient(0, 0, 0, 512);
        g.addColorStop(0,   '#060d04');
        g.addColorStop(.3,  '#041204');
        g.addColorStop(.7,  '#030d03');
        g.addColorStop(1,   '#010801');
        cx.fillStyle = g; cx.fillRect(0, 0, 4, 512);
        scene.background = new this.T.CanvasTexture(cv);
      }
      scene.fog = new this.T.Fog(0x041204, 210, 380);

      /* Cámara */
      const camera = new this.T.PerspectiveCamera(68, w / h, 0.5, 500);
      camera.position.set(0, 90, 75);
      camera.lookAt(0, 0, 0);
      this.camera = camera;

      /* WebGL renderer */
      const renderer = new this.T.WebGLRenderer({ antialias: true, precision: 'highp' });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type    = this.T.PCFSoftShadowMap;
      renderer.toneMapping       = this.T.NoToneMapping;
      renderer.outputColorSpace  = this.T.SRGBColorSpace;
      container.appendChild(renderer.domElement);
      this.renderer = renderer;

      /* CSS2D renderer */
      const css2dR = new CSS2DR();
      css2dR.setSize(w, h);
      css2dR.domElement.style.cssText =
        'position:absolute;top:0;left:0;pointer-events:none;width:100%;height:100%;';
      container.appendChild(css2dR.domElement);
      this.css2dR = css2dR;

      /* Iluminación */
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
      const back  = new this.T.DirectionalLight(0xff5500, 0.28);
      back.position.set(14, 55, -88);
      scene.add(back);
      const fillL = new this.T.DirectionalLight(0x2244bb, 0.14);
      fillL.position.set(-88, 32, 12);
      scene.add(fillL);

      /* Pasto */
      scene.add(this.buildGround());

      /* Líneas */
      scene.add(this.buildFieldLines());

      /* Tokens de jugadores */
      this.tokenGroup = new this.T.Group();
      scene.add(this.tokenGroup);
      this.rebuildTokens();

      /* ResizeObserver */
      this.ro = new ResizeObserver(() => this.onResize());
      this.ro.observe(container);

      /* Loop */
      this.loop();

      /* Avisar a Angular que ya está listo */
      this.zone.run(() => { this.ready = true; this.cdr.detectChanges(); });

    } catch (err) {
      console.error('[pitch3d-view] Error cargando Three.js:', err);
    }
  }

  /* ── Resize ─────────────────────────────────────────────── */
  private onResize(): void {
    const el = this.containerRef.nativeElement;
    const w  = el.clientWidth  || 360;
    const h  = el.clientHeight || 480;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.css2dR.setSize(w, h);
  }

  /* ── Pasto texturizado ──────────────────────────────────── */
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
      ctx.lineWidth = 0.38 + Math.random() * 0.7;
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
        map: t,
        color: new this.T.Color(.11, .38, .06),
        roughness: .84, metalness: 0,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    return ground;
  }

  /* ── Líneas del campo ───────────────────────────────────── */
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

    /* Perímetro */
    fL(-HW, -HL,  HW, -HL);
    fL( HW, -HL,  HW,  HL);
    fL( HW,  HL, -HW,  HL);
    fL(-HW,  HL, -HW, -HL);
    /* Línea de medio */
    fL(-HW, 0, HW, 0);
    /* Círculo y punto central */
    fC(0, 0, 9.15);
    fDot(0, 0);

    /* Áreas (norte y sur) */
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

  /* ── Fichas de jugadores ────────────────────────────────── */
  private rebuildTokens(): void {
    if (!this.scene || !this.tokenGroup) return;

    /* Limpiar tokens anteriores */
    while (this.tokenGroup.children.length > 0) {
      this.tokenGroup.remove(this.tokenGroup.children[0]);
    }
    this.glowMeshes = [];

    this.players.forEach(p => {
      const id  = Number(p.internalId);
      const pct = this.savedPositions.get(id) ?? this.defaultPct(p);
      const token = this.makeToken(p, pct);
      this.tokenGroup.add(token);
    });
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

  /* Convierte porcentajes (0-100) a coordenadas Three.js */
  private pctToWorld(xPct: number, yPct: number): [number, number] {
    const x3d = (xPct / 100 * 2 - 1) * HW;
    const z3d = (yPct / 100 * 2 - 1) * HL;
    return [x3d, z3d];
  }

  private makeToken(p: JugadorSeleccionable, pct: PlayerPos): any {
    const grp   = new this.T.Group();
    const code  = p.posicion?.codigo ?? 'MED';
    const hex   = POS_HEX[code] ?? 0x94a3b8;
    const glow  = POS_GLOW[code] ?? '#94a3b8';
    const [wx, wz] = this.pctToWorld(pct.x, pct.y);

    /* Halo en el pasto */
    const haloS   = 256;
    const haloCv  = document.createElement('canvas');
    haloCv.width  = haloS; haloCv.height = haloS;
    const hCtx    = haloCv.getContext('2d')!;
    const hg      = hCtx.createRadialGradient(haloS/2, haloS/2, haloS*.04, haloS/2, haloS/2, haloS/2);
    hg.addColorStop(0,   glow + 'cc');
    hg.addColorStop(.45, glow + '44');
    hg.addColorStop(1,   glow + '00');
    hCtx.fillStyle = hg; hCtx.fillRect(0, 0, haloS, haloS);
    const haloMesh = new this.T.Mesh(
      new this.T.CircleGeometry(5.2, 32),
      new this.T.MeshBasicMaterial({
        map: new this.T.CanvasTexture(haloCv),
        transparent: true, depthWrite: false,
        blending: this.T.AdditiveBlending,
      })
    );
    haloMesh.rotation.x = -Math.PI / 2;
    haloMesh.position.y = 0.12;
    grp.add(haloMesh);

    /* Cara del disco: canvas con foto o inicial */
    const faceTex = this.buildFaceCanvas(p, glow);

    /* Disco */
    const sideMat = new this.T.MeshStandardMaterial({
      color:    new this.T.Color(hex),
      emissive: new this.T.Color(hex),
      emissiveIntensity: .55, roughness: .12, metalness: .92,
    });
    const faceMat = new this.T.MeshStandardMaterial({
      map: faceTex, emissiveMap: faceTex,
      emissive: new this.T.Color(hex),
      emissiveIntensity: .22, roughness: .18, metalness: .35,
    });
    const disc = new this.T.Mesh(
      new this.T.CylinderGeometry(3.1, 3.1, 0.54, 56),
      [sideMat, faceMat, faceMat]
    );
    disc.position.y  = 0.38;
    disc.castShadow  = true;
    disc.userData.sm = sideMat;
    grp.add(disc);
    this.glowMeshes.push(disc);

    /* Foto async: si hay URL, la cargamos y actualizamos la textura */
    if (p.urlFoto) {
      const img   = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const tex = this.buildFaceCanvasWithImg(img, glow);
        faceMat.map         = tex;
        faceMat.emissiveMap = tex;
        faceMat.needsUpdate = true;
      };
      img.src = p.urlFoto;
    }

    /* Etiqueta CSS2D */
    const label = (p.apellido?.split(' ')?.[0] ?? p.nombre ?? '?').toUpperCase();
    const div   = document.createElement('div');
    div.className   = 'lbl3d';
    div.textContent = label;
    const lbl = new this.CSS2DO(div);
    lbl.position.set(0, 2.6, 0);
    grp.add(lbl);

    grp.position.set(wx, 0, wz);
    grp.userData.baseX = wx;
    grp.userData.baseZ = wz;
    grp.userData.phase = Math.random() * Math.PI * 2;
    return grp;
  }

  private buildFaceCanvas(p: JugadorSeleccionable, glow: string): any {
    const S = 256, cx = S / 2, cy = S / 2, r = S / 2 - 4;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d')!;

    /* Fondo con color de posición */
    const bg = ctx.createRadialGradient(cx, cy * .6, 0, cx, cy, r);
    bg.addColorStop(0,  glow + 'ff');
    bg.addColorStop(.5, glow + 'aa');
    bg.addColorStop(1,  glow + '33');
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = bg; ctx.fill();

    /* Inicial */
    const inicial = (p.apellido || p.nombre || '?').charAt(0).toUpperCase();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(S * .42)}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
    ctx.fillText(inicial, cx, cy + 4);

    const t = new this.T.CanvasTexture(cv);
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  private buildFaceCanvasWithImg(img: HTMLImageElement, glow: string): any {
    const S = 256, cx = S / 2, cy = S / 2, r = S / 2 - 4;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d')!;

    /* Fondo */
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    const scale  = (S / img.naturalWidth);
    const drawW  = S;
    const drawH  = img.naturalHeight * scale;
    const dy     = drawH > S ? -(drawH - S) * 0.15 : (S - drawH) / 2;
    ctx.drawImage(img, 0, dy, drawW, drawH);

    /* Borde de color */
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = glow; ctx.lineWidth = 8; ctx.stroke();

    const t = new this.T.CanvasTexture(cv);
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  /* ── Loop de animación ──────────────────────────────────── */
  private loop(): void {
    this.animId = requestAnimationFrame(() => this.loop());
    this.fr += 0.010;

    /* Pulso de glow */
    this.glowMeshes.forEach((m, i) => {
      if (m.userData.sm) {
        m.userData.sm.emissiveIntensity = .42 + Math.sin(this.fr * .9 + i * .75) * .16;
      }
    });

    /* Movimiento orgánico suave */
    if (this.tokenGroup) {
      this.tokenGroup.children.forEach((grp: any) => {
        const ph = grp.userData.phase ?? 0;
        const t  = this.fr * 0.55;
        const r  = 1.6;
        grp.position.x = grp.userData.baseX + Math.sin(t + ph) * r;
        grp.position.z = grp.userData.baseZ + Math.sin(t * 0.7 + ph + 1.4) * r * 0.6;
      });
    }

    this.renderer.render(this.scene, this.camera);
    this.css2dR.render(this.scene, this.camera);
  }
}
