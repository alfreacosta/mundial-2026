import {
  Component, Input, AfterViewInit, OnDestroy, OnChanges,
  SimpleChanges, ViewChild, ElementRef, NgZone
} from '@angular/core';

export interface MiniPlayer {
  id: number;
  apellido: string;
  camiseta?: number | null;
  posAbr: string;   // POR, ARQ, DEF, MED, DEL
  x: number;        // porcentaje 0-100
  y: number;        // porcentaje 0-100
  urlFoto?: string | null;
}

// Colores por posición
const POS_CFG: Record<string, { glow: string; hex: number }> = {
  POR: { glow: '#f59e0b', hex: 0xf59e0b },
  ARQ: { glow: '#f59e0b', hex: 0xf59e0b },
  DEF: { glow: '#3b82f6', hex: 0x3b82f6 },
  MED: { glow: '#10b981', hex: 0x10b981 },
  DEL: { glow: '#ef4444', hex: 0xef4444 },
};

const HW = 34, HL = 40;
const FW_R = 60, FH_R = 90;

@Component({
  selector: 'app-mini-pitch',
  standalone: true,
  imports: [],
  template: `<div #container style="width:100%;position:relative;border-radius:10px;overflow:hidden;background:#041204;"></div>`,
})
export class MiniPitchComponent implements AfterViewInit, OnDestroy, OnChanges {

  @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;
  @Input() players: MiniPlayer[] = [];

  // Three.js se tipea como any para evitar imports estáticos
  private scene: any;
  private camera: any;
  private renderer: any;
  private css2d: any;
  private tokenGroup: any;
  private glowMeshes: any[] = [];
  private tokenGroups: any[] = [];
  private THREE: any;
  private CSS2DRenderer: any;
  private CSS2DObject: any;
  private photoCache = new Map<string, HTMLImageElement | null>();
  private animId = 0;
  private fr = 0;
  private ro!: ResizeObserver;
  private initialized = false;

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      // Import dinámico → Three.js va en su propio chunk, no bloquea el bundle principal
      Promise.all([
        import('three'),
        import('three/addons/renderers/CSS2DRenderer.js' as any),
      ]).then(([THREE, { CSS2DRenderer, CSS2DObject }]) => {
        this.THREE = THREE;
        this.CSS2DRenderer = CSS2DRenderer;
        this.CSS2DObject = CSS2DObject;
        this.initScene();
        this.ro = new ResizeObserver(() => this.onResize());
        this.ro.observe(this.containerRef.nativeElement);
        this.loop();
      }).catch(e => console.error('[mini-pitch] Error cargando Three.js:', e));
    });
  }

  ngOnChanges(c: SimpleChanges): void {
    if (!this.initialized) return;
    if (c['players']) this.rebuildTokens();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animId);
    this.ro?.disconnect();
    this.renderer?.dispose();
    this.css2d?.domElement?.remove();
  }

  // ═══════════════════════════════════════════════
  // ESCENA
  // ═══════════════════════════════════════════════
  private initScene(): void {
    const THREE = this.THREE;
    const container = this.containerRef.nativeElement;
    const w = container.clientWidth || 300;
    const h = Math.round(w * (FH_R + 8) / (FW_R + 8));

    this.scene = new THREE.Scene();

    // Fondo degradado oscuro
    const bgCv = document.createElement('canvas');
    bgCv.width = 4; bgCv.height = 512;
    const bgCtx = bgCv.getContext('2d')!;
    const bgGrad = bgCtx.createLinearGradient(0, 0, 0, 512);
    bgGrad.addColorStop(0,   '#020a02');
    bgGrad.addColorStop(.20, '#041504');
    bgGrad.addColorStop(.52, '#030e03');
    bgGrad.addColorStop(.78, '#020802');
    bgGrad.addColorStop(1,   '#010401');
    bgCtx.fillStyle = bgGrad;
    bgCtx.fillRect(0, 0, 4, 512);
    this.scene.background = new THREE.CanvasTexture(bgCv);
    this.scene.fog = new THREE.Fog(0x041204, 210, 380);

    // Cámara
    this.camera = new THREE.PerspectiveCamera(68, w / h, 0.5, 500);
    this.camera.position.set(0, 90, 75);
    this.camera.lookAt(0, 0, 0);

    // Renderer WebGL
    this.renderer = new THREE.WebGLRenderer({ antialias: true, precision: 'highp' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 3));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping        = THREE.NoToneMapping;
    this.renderer.outputColorSpace   = THREE.SRGBColorSpace;
    container.style.height = h + 'px';
    container.appendChild(this.renderer.domElement);

    // Renderer CSS2D (etiquetas)
    this.css2d = new this.CSS2DRenderer();
    this.css2d.setSize(w, h);
    this.css2d.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
    container.appendChild(this.css2d.domElement);

    // Iluminación
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.60));
    this.scene.add(new THREE.HemisphereLight(0xfff4d0, 0x1a6412, 0.80));
    const key = new THREE.DirectionalLight(0xfff8e8, 1.55);
    key.position.set(-18, 92, 58);
    key.castShadow = true;
    key.shadow.mapSize.setScalar(2048);
    key.shadow.camera.left = -80; key.shadow.camera.right = 80;
    key.shadow.camera.top  = 80;  key.shadow.camera.bottom = -80;
    key.shadow.camera.near = 20;  key.shadow.camera.far = 260;
    key.shadow.bias = -0.001;
    this.scene.add(key);
    const back = new THREE.DirectionalLight(0xff5500, 0.28);
    back.position.set(14, 55, -88);
    this.scene.add(back);
    const fillL = new THREE.DirectionalLight(0x2244bb, 0.14);
    fillL.position.set(-88, 32, 12);
    this.scene.add(fillL);

    this.buildField();
    this.tokenGroup = new THREE.Group();
    this.scene.add(this.tokenGroup);
    this.rebuildTokens();
    this.initialized = true;
  }

  // ═══════════════════════════════════════════════
  // CANCHA
  // ═══════════════════════════════════════════════
  private buildField(): void {
    const THREE = this.THREE;

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(165, 118),
      new THREE.MeshStandardMaterial({
        map: this.buildGrassTex(),
        color: new THREE.Color(.11, .38, .06),
        roughness: .84,
        metalness: 0,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const wMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const linesGrp = new THREE.Group();
    this.scene.add(linesGrp);
    const LY = 0.07, LT = 0.055, LW = 0.23;

    const fL = (x1: number, z1: number, x2: number, z2: number, w = LW) => {
      const dx = x2-x1, dz = z2-z1, len = Math.sqrt(dx*dx+dz*dz);
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, LT, w), wMat);
      m.position.set((x1+x2)/2, LY, (z1+z2)/2);
      m.rotation.y = -Math.atan2(dz, dx);
      linesGrp.add(m);
    };
    const fC = (cx: number, cz: number, r: number, w = LW) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, w/2, 8, 128), wMat);
      m.rotation.x = Math.PI/2; m.position.set(cx, LY, cz); linesGrp.add(m);
    };
    const fArc = (cx: number, cz: number, r: number, a0: number, a1: number, w = LW, segs = 80) => {
      const pts: any[] = [];
      for (let i = 0; i <= segs; i++) {
        const a = a0+(a1-a0)*i/segs;
        pts.push(new THREE.Vector3(cx+Math.cos(a)*r, 0, cz+Math.sin(a)*r));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, w/2, 6, false), wMat);
      m.position.y = LY; linesGrp.add(m);
    };
    const fDot = (cx: number, cz: number, r = .32) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, LT, 16), wMat);
      m.position.set(cx, LY, cz); linesGrp.add(m);
    };

    fL(-HW,-HL, HW,-HL); fL(HW,-HL, HW,HL); fL(HW,HL,-HW,HL); fL(-HW,HL,-HW,-HL);
    fL(-HW, 0, HW, 0);
    fC(0, 0, 9.15); fDot(0, 0);

    const drawArea = (zs: number) => {
      const gz = zs*HL;
      const PBW=20.16, PBD=16.5, GBW=9.16, GBD=5.5;
      fL(-PBW,gz,-PBW,gz-zs*PBD); fL(-PBW,gz-zs*PBD,PBW,gz-zs*PBD); fL(PBW,gz-zs*PBD,PBW,gz);
      fL(-GBW,gz,-GBW,gz-zs*GBD); fL(-GBW,gz-zs*GBD,GBW,gz-zs*GBD); fL(GBW,gz-zs*GBD,GBW,gz);
      const spotZ = gz-zs*11; fDot(0, spotZ);
      const aInt = Math.asin(5.5/9.15);
      fArc(0, spotZ, 9.15, zs>0 ? Math.PI+aInt : aInt, zs>0 ? 2*Math.PI-aInt : Math.PI-aInt);
      const GW=3.66, GD=2.44;
      fL(-GW,gz,-GW,gz+zs*GD); fL(-GW,gz+zs*GD,GW,gz+zs*GD); fL(GW,gz+zs*GD,GW,gz);
    };
    drawArea(1); drawArea(-1);
  }

  private buildGrassTex(): any {
    const THREE = this.THREE;
    const S = 2048;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#1a5c0b'; ctx.fillRect(0, 0, S, S);
    const N = 8, sh = S/N;
    for (let i = 0; i < N; i++) {
      ctx.fillStyle = i%2===0 ? 'rgba(50,120,18,0.55)' : 'rgba(5,30,2,0.50)';
      ctx.fillRect(0, i*sh, S, sh);
    }
    for (let i = 0; i < 20000; i++) {
      const x = Math.random()*S, y = Math.random()*S;
      const v = 38+Math.floor(Math.random()*58);
      ctx.strokeStyle = `rgba(0,${v},0,0.042)`;
      ctx.lineWidth = 0.38+Math.random()*.7;
      ctx.beginPath(); ctx.moveTo(x,y);
      ctx.lineTo(x+(Math.random()-.5)*.55, y+1.2+Math.random()*3.8);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 1);
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    return t;
  }

  // ═══════════════════════════════════════════════
  // TOKENS
  // ═══════════════════════════════════════════════
  private rebuildTokens(): void {
    this.tokenGroup.clear();
    this.glowMeshes = [];
    this.tokenGroups = [];
    this.players.forEach(p => {
      const grp = this.makeToken(p);
      this.tokenGroup.add(grp);
      this.tokenGroups.push(grp);
    });
  }

  private makeToken(p: MiniPlayer): any {
    const THREE = this.THREE;
    const grp = new THREE.Group();
    const cfg = POS_CFG[p.posAbr] ?? POS_CFG['DEF'];

    // Halo en el pasto
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(5.6, 32),
      new THREE.MeshBasicMaterial({
        map: this.buildHaloTex(cfg.glow),
        transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    halo.rotation.x = -Math.PI/2; halo.position.y = .12; grp.add(halo);

    // Disco
    const faceTex = this.buildFaceTex(p, cfg, null);
    const sideMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cfg.hex), emissive: new THREE.Color(cfg.hex),
      emissiveIntensity: .62, roughness: .07, metalness: .97,
    });
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceTex, emissiveMap: faceTex,
      emissive: new THREE.Color(cfg.glow),
      emissiveIntensity: .28, roughness: .16, metalness: .40,
    });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.1,3.1,.54,56), [sideMat, faceMat, faceMat]);
    disc.position.y = .38; disc.castShadow = true;
    disc.userData['sm'] = sideMat;
    grp.add(disc); this.glowMeshes.push(disc);

    // Etiqueta CSS2D
    const div = document.createElement('div');
    div.style.cssText = [
      "font-family:'Segoe UI',Arial,sans-serif", 'font-size:9.5px', 'font-weight:900',
      'color:#fff', 'text-transform:uppercase', 'letter-spacing:1.8px', 'white-space:nowrap',
      'pointer-events:none', 'background:rgba(0,0,0,.52)',
      `border:1px solid ${cfg.glow}55`, 'border-radius:8px',
      'padding:1px 7px', 'text-shadow:0 1px 4px #000',
    ].join(';');
    div.textContent = (p.apellido.split(' ')[0] ?? p.apellido).toUpperCase();
    const lbl = new this.CSS2DObject(div);
    lbl.position.set(0, 2.7, 0); grp.add(lbl);

    // Posición en la cancha: x/y % → coordenadas Three.js
    const tx = (p.x/100 - 0.5) * 2 * (HW * 0.86);
    const tz = (p.y/100 - 0.5) * 2 * (HL * 0.86);
    grp.position.set(tx, 0, tz);
    grp.userData['baseX'] = tx;
    grp.userData['baseZ'] = tz;
    grp.userData['phase'] = Math.random() * Math.PI * 2;

    if (p.urlFoto) this.loadPhoto(p.urlFoto, faceTex, p, cfg);
    return grp;
  }

  private buildFaceTex(p: MiniPlayer, cfg: { glow: string; hex: number }, photo: HTMLImageElement | null): any {
    const THREE = this.THREE;
    const S = 512, cx = 256, cy = 256, r = 238;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d')!;
    const hexStr = '#' + cfg.hex.toString(16).padStart(6, '0');
    const bg = ctx.createRadialGradient(cx, cy*.58, 0, cx, cy, r);
    bg.addColorStop(0,   hexStr+'dd'); bg.addColorStop(.48, hexStr+'88');
    bg.addColorStop(.86, hexStr+'33'); bg.addColorStop(1,   cfg.glow+'44');
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fillStyle=bg; ctx.fill();
    for (let i=8; i>=1; i--) {
      ctx.beginPath(); ctx.arc(cx,cy,r-2,0,Math.PI*2);
      ctx.strokeStyle=cfg.glow; ctx.lineWidth=i*5+2; ctx.globalAlpha=.055; ctx.stroke();
    }
    ctx.globalAlpha=1;
    ctx.beginPath(); ctx.arc(cx,cy,r-2,0,Math.PI*2); ctx.strokeStyle=cfg.glow; ctx.lineWidth=9; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,cy,r-19,0,Math.PI*2); ctx.strokeStyle=cfg.glow+'55'; ctx.lineWidth=2; ctx.stroke();
    const sh=ctx.createLinearGradient(cx-r*.55,cy-r*.72,cx+r*.2,cy);
    sh.addColorStop(0,'rgba(255,255,255,.26)'); sh.addColorStop(1,'rgba(255,255,255,0)');
    ctx.beginPath(); ctx.arc(cx,cy,r-3,0,Math.PI*2); ctx.fillStyle=sh; ctx.fill();
    if (photo) {
      const innerR=r-20;
      ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,innerR,0,Math.PI*2); ctx.clip();
      const diam=innerR*2, scale=diam/photo.naturalWidth;
      const drawW=diam, drawH=photo.naturalHeight*scale;
      const dy=drawH>diam ? -(drawH-diam)*0.15 : (diam-drawH)/2;
      ctx.drawImage(photo, cx-innerR, cy-innerR+dy, drawW, drawH);
      ctx.restore();
    } else {
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.font=`bold ${Math.floor(S*.36)}px Arial`;
      ctx.shadowColor=cfg.glow; ctx.shadowBlur=32;
      ctx.fillStyle='rgba(255,255,255,.97)';
      ctx.fillText(p.camiseta!=null ? String(p.camiseta) : (p.apellido||'?').charAt(0).toUpperCase(), cx, cy+5);
      ctx.shadowBlur=0;
    }
    const t = new THREE.CanvasTexture(cv);
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    return t;
  }

  private buildHaloTex(glow: string): any {
    const THREE = this.THREE;
    const S = 256;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d')!;
    const g = ctx.createRadialGradient(S/2,S/2,S*.04,S/2,S/2,S/2);
    g.addColorStop(0, glow+'ee'); g.addColorStop(.40, glow+'55'); g.addColorStop(1, glow+'00');
    ctx.fillStyle=g; ctx.fillRect(0,0,S,S);
    return new THREE.CanvasTexture(cv);
  }

  private loadPhoto(url: string, faceTex: any, p: MiniPlayer, cfg: { glow: string; hex: number }): void {
    const cached = this.photoCache.get(url);
    if (cached !== undefined) {
      if (cached) { const u=this.buildFaceTex(p,cfg,cached); faceTex.image=u.image; faceTex.needsUpdate=true; }
      return;
    }
    this.photoCache.set(url, null);
    const img = new Image(); img.crossOrigin='anonymous';
    img.onload = () => {
      this.photoCache.set(url, img);
      const u = this.buildFaceTex(p, cfg, img);
      faceTex.image = u.image; faceTex.needsUpdate = true;
    };
    img.onerror = () => this.photoCache.set(url, null);
    img.src = url;
  }

  // ═══════════════════════════════════════════════
  // RESIZE
  // ═══════════════════════════════════════════════
  private onResize(): void {
    if (!this.renderer) return;
    const container = this.containerRef.nativeElement;
    const w = container.clientWidth || 300;
    const h = Math.round(w * (FH_R+8) / (FW_R+8));
    container.style.height = h+'px';
    this.camera.aspect = w/h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.css2d.setSize(w, h);
  }

  // ═══════════════════════════════════════════════
  // LOOP
  // ═══════════════════════════════════════════════
  private loop(): void {
    this.animId = requestAnimationFrame(() => this.loop());
    this.fr += 0.010;
    this.glowMeshes.forEach((m, i) => {
      const sm = m.userData['sm'];
      if (sm) sm.emissiveIntensity = .48 + Math.sin(this.fr*.9+i*.75)*.17;
    });
    this.tokenGroups.forEach(grp => {
      const ph = grp.userData['phase'], t = this.fr*0.55, r = 1.8;
      grp.position.x = grp.userData['baseX'] + Math.sin(t+ph)*r;
      grp.position.z = grp.userData['baseZ'] + Math.sin(t*0.7+ph+1.4)*r*0.6;
    });
    this.renderer.render(this.scene, this.camera);
    this.css2d.render(this.scene, this.camera);
  }
}
