/** Visor 3D estilo CAD técnico (Three.js): fondo claro, luz plana, rejilla de plano de
 * trabajo, tríada de ejes X/Y/Z, selección por raycaster y cotas conmutables. */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ViewMode = 'perspective' | 'orthographic' | 'section' | 'wireframe';

/** Información de una pieza seleccionable (se adjunta en mesh.userData.pick). */
export interface PickInfo {
  id: string;
  partKind: string;
  name: string;
  index?: number;
}

export const CAD = {
  background: '#eef2f6',
  gridMajor: '#94a3b8',
  gridMinor: '#cbd5e1',
  edges: '#1e293b',
  dimLine: '#475569',
  dimText: '#ea580c',
  selEmissive: '#35e0c4',
  selOutline: '#0d9488',
  hoverOutline: '#5eead4',
  axisX: '#ef4444',
  axisY: '#22c55e',
  axisZ: '#3b82f6',
};

export class SceneViewer {
  container: HTMLElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  perspCamera: THREE.PerspectiveCamera;
  orthoCamera: THREE.OrthographicCamera;
  active: THREE.Camera;
  controls: OrbitControls;
  clipPlane: THREE.Plane;
  modelGroup: THREE.Group | null = null;
  viewMode: ViewMode = 'perspective';
  onFrame?: (dt: number, t: number) => void;
  onPick?: (pick: PickInfo | null) => void;

  private raf = 0;
  private clock = new THREE.Clock();
  private ro: ResizeObserver;

  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private down = { x: 0, y: 0, moved: false };
  private selectedId: string | null = null;
  private dimsVisible = true;

  private axisScene: THREE.Scene;
  private axisCamera: THREE.OrthographicCamera;
  private axisGroup: THREE.Group;

  constructor(container: HTMLElement) {
    this.container = container;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CAD.background);

    this.perspCamera = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000);
    this.perspCamera.position.set(90, 70, 120);

    const aspect = w / h;
    const fs = 90;
    this.orthoCamera = new THREE.OrthographicCamera(-fs * aspect, fs * aspect, fs, -fs, -2000, 2000);
    this.orthoCamera.position.set(90, 70, 120);

    this.active = this.perspCamera;

    this.controls = new OrbitControls(this.perspCamera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 20, 0);

    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

    this.setupLights();
    this.setupGround();

    const triad = this.buildTriad();
    this.axisScene = triad.scene;
    this.axisCamera = triad.camera;
    this.axisGroup = triad.group;

    this.bindPointer();

    this.ro = new ResizeObserver(() => this.onResize());
    this.ro.observe(container);

    this.animate();
  }

  private setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const hemi = new THREE.HemisphereLight(0xffffff, 0xc7d0da, 0.55);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1.35);
    key.position.set(70, 150, 100);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 600;
    const d = 180;
    key.shadow.camera.left = -d;
    key.shadow.camera.right = d;
    key.shadow.camera.top = d;
    key.shadow.camera.bottom = -d;
    key.shadow.bias = -0.0004;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-90, 60, -70);
    this.scene.add(fill);
  }

  private setupGround() {
    const minor = new THREE.GridHelper(600, 120, new THREE.Color(CAD.gridMinor), new THREE.Color(CAD.gridMinor));
    (minor.material as THREE.Material).opacity = 0.5;
    (minor.material as THREE.Material).transparent = true;
    minor.position.y = -0.02;
    this.scene.add(minor);

    const major = new THREE.GridHelper(600, 24, new THREE.Color(CAD.gridMajor), new THREE.Color(CAD.gridMajor));
    (major.material as THREE.Material).opacity = 0.85;
    (major.material as THREE.Material).transparent = true;
    major.position.y = -0.01;
    this.scene.add(major);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.ShadowMaterial({ opacity: 0.14, color: 0x1e293b })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  /** Tríada de ejes fija en la esquina, orientada según la cámara. */
  private buildTriad() {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 10);
    camera.position.set(0, 0, 4);
    camera.lookAt(0, 0, 0);
    const group = new THREE.Group();

    const mkAxis = (dir: THREE.Vector3, color: string, label: string) => {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color });
      const len = 1.05;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 8), mat);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.28, 12), mat);
      const up = new THREE.Vector3(0, 1, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
      shaft.position.copy(dir.clone().multiplyScalar(len / 2));
      shaft.quaternion.copy(q);
      cone.position.copy(dir.clone().multiplyScalar(len + 0.14));
      cone.quaternion.copy(q);
      g.add(shaft, cone, this.makeLabel(label, color, dir.clone().multiplyScalar(len + 0.45)));
      return g;
    };
    group.add(mkAxis(new THREE.Vector3(1, 0, 0), CAD.axisX, 'X'));
    group.add(mkAxis(new THREE.Vector3(0, 1, 0), CAD.axisY, 'Y'));
    group.add(mkAxis(new THREE.Vector3(0, 0, 1), CAD.axisZ, 'Z'));
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), new THREE.MeshBasicMaterial({ color: 0x334155 }));
    group.add(hub);
    scene.add(group);
    return { scene, camera, group };
  }

  private makeLabel(text: string, color: string, pos: THREE.Vector3): THREE.Sprite {
    const s = 64;
    const cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const ctx = cv.getContext('2d')!;
    ctx.font = 'bold 44px IBM Plex Mono, monospace';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, s / 2, s / 2);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    spr.scale.set(0.55, 0.55, 0.55);
    spr.position.copy(pos);
    return spr;
  }

  // ---- Selección por clic ---------------------------------------------------
  private bindPointer() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      this.down = { x: e.clientX, y: e.clientY, moved: false };
    });
    el.addEventListener('pointermove', (e) => {
      if (e.buttons !== 0) {
        if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 4) this.down.moved = true;
        return;
      }
      el.style.cursor = this.pickAt(e.clientX, e.clientY) ? 'pointer' : 'default';
    });
    el.addEventListener('pointerup', (e) => {
      if (this.down.moved) return;
      const pick = this.pickAt(e.clientX, e.clientY);
      this.select(pick ? pick.userData.pick.id : null);
      this.onPick?.(pick ? (pick.userData.pick as PickInfo) : null);
    });
  }

  private pickAt(clientX: number, clientY: number): THREE.Object3D | null {
    if (!this.modelGroup) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.active as THREE.PerspectiveCamera);
    const hits = this.raycaster.intersectObject(this.modelGroup, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData && o.userData.pick) return o;
        o = o.parent;
      }
    }
    return null;
  }

  /** Aplica/limpia el resaltado de la pieza cuyo id coincide. */
  select(id: string | null) {
    this.selectedId = id;
    if (!this.modelGroup) return;
    this.modelGroup.traverse((o: any) => {
      if (!o.isMesh || !o.userData?.pick) return;
      const on = o.userData.pick.id === id;
      this.setHighlight(o, on);
    });
  }

  clearSelection() {
    this.select(null);
    this.onPick?.(null);
  }

  private setHighlight(mesh: any, on: boolean) {
    const mats: any[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      if (!m.emissive) return;
      if (on) {
        if (!m.userData) m.userData = {};
        if (m.userData._baseEmissive === undefined) {
          m.userData._baseEmissive = m.emissive.getHex();
          m.userData._baseEmissiveI = m.emissiveIntensity;
        }
        m.emissive.set(CAD.selEmissive);
        m.emissiveIntensity = 0.5;
      } else if (m.userData && m.userData._baseEmissive !== undefined) {
        m.emissive.setHex(m.userData._baseEmissive);
        m.emissiveIntensity = m.userData._baseEmissiveI;
        m.userData._baseEmissive = undefined;
      }
      m.needsUpdate = true;
    });
    const existing = mesh.getObjectByName('__sel_outline');
    if (on && !existing) {
      const edges = new THREE.EdgesGeometry(mesh.geometry, 25);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: CAD.selOutline, depthTest: false, transparent: true })
      );
      line.name = '__sel_outline';
      line.renderOrder = 999;
      mesh.add(line);
    } else if (!on && existing) {
      existing.geometry.dispose();
      (existing.material as THREE.Material).dispose();
      mesh.remove(existing);
    }
  }

  setDimensionsVisible(v: boolean) {
    this.dimsVisible = v;
    this.applyDimsVisibility();
  }

  private applyDimsVisibility() {
    this.modelGroup?.traverse((o: any) => {
      if (o.userData?.dim) o.visible = this.dimsVisible;
    });
  }

  setModel(group: THREE.Group) {
    if (this.modelGroup) {
      this.scene.remove(this.modelGroup);
      this.disposeGroup(this.modelGroup);
    }
    this.modelGroup = group;
    this.scene.add(group);
    this.selectedId = null;
    this.applyDimsVisibility();
    this.applyViewMode();
  }

  setViewMode(mode: ViewMode) {
    this.viewMode = mode;
    if (mode === 'orthographic') this.active = this.orthoCamera;
    else this.active = this.perspCamera;
    this.controls.object = this.active as any;
    this.controls.update();
    this.applyViewMode();
  }

  private applyViewMode() {
    const wire = this.viewMode === 'wireframe';
    const clip = this.viewMode === 'section';
    this.renderer.localClippingEnabled = clip;
    this.modelGroup?.traverse((o: any) => {
      if (o.isMesh && o.material) {
        const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m: any) => {
          m.wireframe = wire;
          m.clippingPlanes = clip ? [this.clipPlane] : [];
          m.side = clip ? THREE.DoubleSide : THREE.FrontSide;
          m.needsUpdate = true;
        });
      }
    });
  }

  frameCamera(radius: number, center: THREE.Vector3) {
    this.controls.target.copy(center);
    const dir = new THREE.Vector3(1.1, 0.85, 1.3).normalize();
    this.perspCamera.position.copy(center.clone().add(dir.multiplyScalar(radius * 2.4)));
    this.orthoCamera.position.copy(this.perspCamera.position);
    const aspect = this.container.clientWidth / this.container.clientHeight;
    const fs = radius * 1.4;
    this.orthoCamera.left = -fs * aspect;
    this.orthoCamera.right = fs * aspect;
    this.orthoCamera.top = fs;
    this.orthoCamera.bottom = -fs;
    this.orthoCamera.updateProjectionMatrix();
    this.controls.update();
  }

  resetView() {
    this.setViewMode('perspective');
  }

  private onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.perspCamera.aspect = w / h;
    this.perspCamera.updateProjectionMatrix();
    const aspect = w / h;
    const fs = this.orthoCamera.top;
    this.orthoCamera.left = -fs * aspect;
    this.orthoCamera.right = fs * aspect;
    this.orthoCamera.updateProjectionMatrix();
  }

  private animate = () => {
    this.raf = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    const t = this.clock.elapsedTime;
    if (this.onFrame) this.onFrame(dt, t);
    this.controls.update();

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setViewport(0, 0, w, h);
    this.renderer.setScissorTest(false);
    this.renderer.clear();
    this.renderer.render(this.scene, this.active);

    // Tríada de ejes en la esquina inferior izquierda
    const s = 92;
    const m = 10;
    this.renderer.setViewport(m, m, s, s);
    this.renderer.setScissor(m, m, s, s);
    this.renderer.setScissorTest(true);
    this.renderer.clearDepth();
    this.axisGroup.quaternion.copy(this.active.quaternion).invert();
    this.renderer.render(this.axisScene, this.axisCamera);
    this.renderer.setScissorTest(false);
  };

  private disposeGroup(group: THREE.Object3D) {
    group.traverse((o: any) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m: any) => m.dispose && m.dispose());
      }
    });
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    if (this.modelGroup) this.disposeGroup(this.modelGroup);
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

/** Rampa de color esfuerzo/térmica: azul (frío) → cian → verde → amarillo → rojo (caliente). */
export function heatColor(t: number): THREE.Color {
  const c = new THREE.Color();
  const x = Math.max(0, Math.min(1, t));
  c.setHSL((1 - x) * 0.66, 0.85, 0.35 + 0.2 * x);
  return c;
}

/** Añade un contorno de aristas (estilo técnico) como hijo de una malla. */
export function addEdges(mesh: THREE.Mesh, color = CAD.edges, threshold = 30) {
  const edges = new THREE.EdgesGeometry(mesh.geometry, threshold);
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color }));
  line.userData.nonPick = true;
  mesh.add(line);
  return line;
}

/** Etiqueta de texto (sprite) para cotas. */
function dimSprite(text: string): THREE.Sprite {
  const pad = 8;
  const fs = 42;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d')!;
  ctx.font = `600 ${fs}px IBM Plex Mono, monospace`;
  const tw = ctx.measureText(text).width;
  cv.width = Math.ceil(tw + pad * 2);
  cv.height = fs + pad * 2;
  const c2 = cv.getContext('2d')!;
  c2.font = `600 ${fs}px IBM Plex Mono, monospace`;
  c2.fillStyle = 'rgba(238,242,246,0.92)';
  c2.fillRect(0, 0, cv.width, cv.height);
  c2.fillStyle = CAD.dimText;
  c2.textBaseline = 'middle';
  c2.textAlign = 'center';
  c2.fillText(text, cv.width / 2, cv.height / 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const scale = 0.05;
  spr.scale.set(cv.width * scale, cv.height * scale, 1);
  return spr;
}

/** Cota entre dos puntos: línea con topes + etiqueta al centro (marcada como userData.dim). */
export function makeDimension(p1: THREE.Vector3, p2: THREE.Vector3, text: string): THREE.Group {
  const g = new THREE.Group();
  g.userData.dim = true;
  const mat = new THREE.LineBasicMaterial({ color: CAD.dimLine, depthTest: false, transparent: true });
  const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
  const line = new THREE.Line(geo, mat);
  line.renderOrder = 998;
  g.add(line);

  const dir = p2.clone().sub(p1).normalize();
  const perp = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const tick = perp.clone().multiplyScalar(2.4);
  [p1, p2].forEach((p) => {
    const tg = new THREE.BufferGeometry().setFromPoints([p.clone().add(tick), p.clone().sub(tick)]);
    const tl = new THREE.Line(tg, mat);
    tl.renderOrder = 998;
    g.add(tl);
  });

  const mid = p1.clone().add(p2).multiplyScalar(0.5).add(perp.clone().multiplyScalar(4));
  const spr = dimSprite(text);
  spr.position.copy(mid);
  spr.renderOrder = 1000;
  g.add(spr);
  return g;
}
