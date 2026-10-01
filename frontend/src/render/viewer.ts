/**
 * Visor 3D estilo CAD: fondo claro en degradado, iluminación plana, rejilla
 * de plano de trabajo, tríada de ejes XYZ, ViewCube, cotas conmutables y plano
 * de corte ajustable.
 *
 * Sin sombras: la profundidad la dan las aristas oscuras y el color de datos
 * (esfuerzo σ). El visor es claro; el resto de la interfaz se queda oscuro.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { axisLabel, textSprite } from './labels';

export type ViewMode = 'perspective' | 'orthographic' | 'section' | 'wireframe' | 'exploded';

/** Información de una pieza seleccionable (se adjunta en mesh.userData.pick). */
export interface PickInfo {
  id: string;
  partKind: string;
  name: string;
  index?: number;
}

export const CAD = {
  /** Degradado vertical del fondo estilo hoja CAD. */
  bgTop: '#f4f7fb',
  bgBottom: '#d5dde8',
  gridMajor: '#9fb3c8',
  gridMinor: '#9fb3c8',
  edge: '#1f2d3d',
  dimLine: '#1f2d3d',
  dimText: '#1f2d3d',
  dimChip: '#f8fafc',
  dimChipBorder: '#9fb3c8',
  selEmissive: '#0284c7',
  selOutline: '#0284c7',
  axisX: '#d32f2f',
  axisY: '#2e7d32',
  axisZ: '#1565c0',
  ink: '#1f2d3d',
} as const;

/** Orientaciones del ViewCube. */
export type CubeView = 'iso' | 'front' | 'rear' | 'left' | 'right' | 'top' | 'bottom';
const CUBE_DIR: Record<CubeView, THREE.Vector3> = {
  iso: new THREE.Vector3(1.1, 0.85, 1.3),
  front: new THREE.Vector3(0, 0.25, 1),
  rear: new THREE.Vector3(0, 0.25, -1),
  left: new THREE.Vector3(-1, 0.25, 0),
  right: new THREE.Vector3(1, 0.25, 0),
  top: new THREE.Vector3(0, 1, 0.001),
  bottom: new THREE.Vector3(0, -1, 0.001),
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
  /** Se dispara al elegir una cara del ViewCube. */
  onCubeView?: (v: CubeView) => void;
  cubeView: CubeView = 'iso';
  /** Posición del cursor en la escena, para la barra de estado. */
  onHover?: (pt: THREE.Vector3 | null) => void;

  private raf = 0;
  private clock = new THREE.Clock();
  private ro: ResizeObserver;

  private raycaster = new THREE.Raycaster();
  private cubeRay = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private down = { x: 0, y: 0, moved: false };
  private selectedId: string | null = null;
  private dimsVisible = true;

  private axisScene: THREE.Scene;
  private axisCamera: THREE.OrthographicCamera;
  private axisGroup: THREE.Group;

  private cubeScene: THREE.Scene;
  private cubeCamera: THREE.OrthographicCamera;
  private cubeRoot: THREE.Group;
  private cubeSize = 96;

  /** Mapa de esfuerzo conmutado desde el botón del propio visor. */
  private stressMapOn = false;
  private stressBtn: HTMLButtonElement;
  /** Render target del mapa de entorno (PMREM); se libera en dispose(). */
  private envRT: THREE.WebGLRenderTarget | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.autoClear = false;
    // Sin sombras: el estilo CAD es plano.
    this.renderer.shadowMap.enabled = false;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = gradientTexture(CAD.bgTop, CAD.bgBottom);

    // Mapa de entorno (PMREM): da reflejo y contraste a los materiales PBR
    // sin necesidad de sombras. Es lo que separa un "viewer CAD" de un
    // bloque plano negro.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    this.perspCamera = new THREE.PerspectiveCamera(45, w / h, 0.5, 4000);
    this.perspCamera.position.set(110, 90, 150);

    const aspect = w / h;
    const fs = 70;
    this.orthoCamera = new THREE.OrthographicCamera(-fs * aspect, fs * aspect, fs, -fs, -4000, 4000);
    this.orthoCamera.position.set(110, 90, 150);

    this.active = this.perspCamera;

    this.controls = new OrbitControls(this.perspCamera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.target.set(0, 20, 0);

    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

    this.setupLights();
    this.setupGround();

    const triad = this.buildTriad();
    this.axisScene = triad.scene;
    this.axisCamera = triad.camera;
    this.axisGroup = triad.group;

    const cube = this.buildCube();
    this.cubeScene = cube.scene;
    this.cubeCamera = cube.camera;
    this.cubeRoot = cube.root;

    this.bindPointer();
    this.stressBtn = this.buildStressButton();

    this.ro = new ResizeObserver(() => this.onResize());
    this.ro.observe(container);

    this.animate();
  }

  /** Iluminación: el entorno PMREM es la fuente principal; las luces sólo
   *  dirigen el brillo. Con environment + estas intensidades ninguna pieza
   *  queda negra. */
  private setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const hemi = new THREE.HemisphereLight(0xf4f7fb, 0xd5dde8, 0.4);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(90, 180, 120);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xc8d3df, 0.25);
    fill.position.set(-120, 60, -90);
    this.scene.add(fill);
  }

  /** Botón «mapa de esfuerzo», propio del visor: apagado por defecto. */
  private buildStressButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'mapa de esfuerzo';
    btn.style.cssText =
      'position:absolute;z-index:6;right:10px;bottom:10px;padding:3px 9px;' +
      `font:11px ${"'IBM Plex Mono', ui-monospace, monospace"};background:#f8fafc;` +
      'color:#1f2d3d;border:1px solid #9fb3c8;cursor:pointer;border-radius:0;';
    btn.addEventListener('click', () => {
      this.stressMapOn = !this.stressMapOn;
      this.setStressMap(this.stressMapOn);
      btn.style.color = this.stressMapOn ? '#0284c7' : '#1f2d3d';
      btn.style.borderColor = this.stressMapOn ? '#0284c7' : '#9fb3c8';
    });
    this.container.appendChild(btn);
    return btn;
  }

  /** Llama al hook del modelo (assembly) buscando `userData.setStressMap`. */
  private setStressMap(v: boolean) {
    const find = (o: THREE.Object3D): ((s: boolean) => void) | null => {
      const fn = (o.userData as any)?.setStressMap;
      if (typeof fn === 'function') return fn as (s: boolean) => void;
      for (const c of o.children) {
        const r = find(c);
        if (r) return r;
      }
      return null;
    };
    find(this.modelGroup ?? new THREE.Group())?.(v);
  }

  /** Rejilla de plano de trabajo en dos escalas: fina al 40 %, mayores al 70 %. */
  private setupGround() {
    const minor = new THREE.GridHelper(
      400,
      80,
      new THREE.Color(CAD.gridMinor),
      new THREE.Color(CAD.gridMinor)
    );
    (minor.material as THREE.Material).opacity = 0.4;
    (minor.material as THREE.Material).transparent = true;
    minor.position.y = -0.05;
    this.scene.add(minor);

    const major = new THREE.GridHelper(
      400,
      16,
      new THREE.Color(CAD.gridMajor),
      new THREE.Color(CAD.gridMajor)
    );
    (major.material as THREE.Material).opacity = 0.7;
    (major.material as THREE.Material).transparent = true;
    major.position.y = -0.04;
    this.scene.add(major);
  }

  /** Tríada XYZ fija en la esquina inferior izquierda, orientada con la cámara. */
  private buildTriad() {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 10);
    camera.position.set(0, 0, 4);
    camera.lookAt(0, 0, 0);
    const group = new THREE.Group();

    const mkAxis = (dir: THREE.Vector3, color: string, label: string) => {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color });
      const len = 1.0;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, len, 8), mat);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 12), mat);
      const up = new THREE.Vector3(0, 1, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
      shaft.position.copy(dir.clone().multiplyScalar(len / 2));
      shaft.quaternion.copy(q);
      cone.position.copy(dir.clone().multiplyScalar(len + 0.13));
      cone.quaternion.copy(q);
      g.add(shaft, cone, axisLabel(label, color).translateX(dir.x * 0.42).translateY(dir.y * 0.42).translateZ(dir.z * 0.42));
      return g;
    };
    group.add(mkAxis(new THREE.Vector3(1, 0, 0), CAD.axisX, 'x'));
    group.add(mkAxis(new THREE.Vector3(0, 1, 0), CAD.axisY, 'y'));
    group.add(mkAxis(new THREE.Vector3(0, 0, 1), CAD.axisZ, 'z'));
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), new THREE.MeshBasicMaterial({ color: CAD.ink })));
    scene.add(group);
    return { scene, camera, group };
  }

  /** ViewCube: cubo de navegación con las 6 caras pulsables. */
  private buildCube() {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1.7, 1.7, 1.7, -1.7, 0.1, 20);
    camera.position.set(0, 0, 6);
    camera.lookAt(0, 0, 0);
    const root = new THREE.Group();

    const faces: { view: CubeView; color: string; n: THREE.Vector3 }[] = [
      { view: 'front', color: '#c9d5e3', n: new THREE.Vector3(0, 0, 1) },
      { view: 'rear', color: '#aebdd0', n: new THREE.Vector3(0, 0, -1) },
      { view: 'right', color: '#c9d5e3', n: new THREE.Vector3(1, 0, 0) },
      { view: 'left', color: '#aebdd0', n: new THREE.Vector3(-1, 0, 0) },
      { view: 'top', color: '#dde6f0', n: new THREE.Vector3(0, 1, 0) },
      { view: 'bottom', color: '#93a7bf', n: new THREE.Vector3(0, -1, 0) },
    ];
    for (const f of faces) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1.45, 1.45),
        new THREE.MeshBasicMaterial({ color: f.color, side: THREE.DoubleSide })
      );
      m.position.copy(f.n).multiplyScalar(0.78);
      m.lookAt(0, 0, 0);
      m.userData.cubeView = f.view;
      m.userData.normal = f.n.clone();
      root.add(m);
    }
    // Aristas del cubo, oscuras: legibles sobre el fondo claro del visor.
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.56, 1.56, 1.56)),
      new THREE.LineBasicMaterial({ color: CAD.ink })
    );
    root.add(edges);
    scene.add(root);
    return { scene, camera, root };
  }

  // ---- selección por clic ---------------------------------------------------

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
      const inCube = this.cubeHit(e.clientX, e.clientY);
      el.style.cursor = inCube ? 'pointer' : this.pickAt(e.clientX, e.clientY) ? 'pointer' : 'default';
      // Coordenadas bajo el cursor para la barra de estado.
      const pt = this.groundPoint(e.clientX, e.clientY);
      this.onHover?.(pt);
    });

    el.addEventListener('pointerleave', () => this.onHover?.(null));

    el.addEventListener('pointerup', (e) => {
      const v = this.cubeHit(e.clientX, e.clientY);
      if (v) {
        this.setCubeView(v);
        return;
      }
      if (this.down.moved) return;
      const pick = this.pickAt(e.clientX, e.clientY);
      this.select(pick ? (pick.userData.pick.id as string) : null);
      this.onPick?.(pick ? (pick.userData.pick as PickInfo) : null);
    });
  }

  /** Devuelve la cara del ViewCube bajo el cursor, o null. */
  private cubeHit(clientX: number, clientY: number): CubeView | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const pad = 8;
    const inX = localX >= rect.width - pad - this.cubeSize && localX <= rect.width - pad;
    const inY = localY >= pad && localY <= pad + this.cubeSize;
    if (!inX || !inY) return null;
    const u = ((localX - (rect.width - pad - this.cubeSize)) / this.cubeSize) * 2 - 1;
    const v = -(((localY - pad) / this.cubeSize) * 2 - 1);
    this.cubeRay.setFromCamera(new THREE.Vector2(u, v), this.cubeCamera);
    const hits = this.cubeRay.intersectObjects(this.cubeRoot.children, false);
    for (const h of hits) {
      if (h.object.userData.cubeView) return h.object.userData.cubeView as CubeView;
    }
    return null;
  }

  /** Punto del plano de trabajo bajo el cursor, para leer coordenadas. */
  private groundPoint(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.active as THREE.PerspectiveCamera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const out = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(plane, out);
    return hit ? out : null;
  }

  private pickAt(clientX: number, clientY: number): THREE.Object3D | null {
    if (!this.modelGroup) return null;
    this.groundPoint(clientX, clientY);
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
      this.setHighlight(o, o.userData.pick.id === id);
    });
  }

  getSelected(): string | null {
    return this.selectedId;
  }

  clearSelection() {
    this.select(null);
    this.onPick?.(null);
  }

  private setHighlight(meshObj: any, on: boolean) {
    const mats: any[] = Array.isArray(meshObj.material) ? meshObj.material : [meshObj.material];
    mats.forEach((m) => {
      if (!m.emissive) return;
      if (on) {
        if (!m.userData) m.userData = {};
        if (m.userData._baseEmissive === undefined) {
          m.userData._baseEmissive = m.emissive.getHex();
          m.userData._baseEmissiveI = m.emissiveIntensity;
        }
        m.emissive.set(CAD.selEmissive);
        m.emissiveIntensity = 0.85;
      } else if (m.userData && m.userData._baseEmissive !== undefined) {
        m.emissive.setHex(m.userData._baseEmissive);
        m.emissiveIntensity = m.userData._baseEmissiveI;
        m.userData._baseEmissive = undefined;
      }
      m.needsUpdate = true;
    });
    const existing = meshObj.getObjectByName('__sel_outline');
    if (on && !existing) {
      const edges = new THREE.EdgesGeometry(meshObj.geometry, 25);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: CAD.selOutline, depthTest: false, transparent: true })
      );
      line.name = '__sel_outline';
      line.userData.nonPick = true;
      line.renderOrder = 998;
      meshObj.add(line);
    } else if (!on && existing) {
      existing.geometry.dispose();
      (existing.material as THREE.Material).dispose();
      meshObj.remove(existing);
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
    // El modelo nuevo arranca siempre con el mapa de esfuerzo apagado.
    this.stressMapOn = false;
    if (this.stressBtn) {
      this.stressBtn.style.color = '#1f2d3d';
      this.stressBtn.style.borderColor = '#9fb3c8';
    }
    this.applyDimsVisibility();
    this.applyViewMode();
  }

  setViewMode(mode: ViewMode) {
    this.viewMode = mode;
    this.active = mode === 'orthographic' ? this.orthoCamera : this.perspCamera;
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

  /** Desplaza el plano de corte a lo largo de Z, en unidades de escena. */
  setSectionOffset(mm: number) {
    this.clipPlane.constant = mm;
    this.applyViewMode();
  }

  getSectionOffset(): number {
    return this.clipPlane.constant;
  }

  /** Orienta la cámara a una vista del ViewCube. */
  setCubeView(v: CubeView) {
    this.cubeView = v;
    const dir = CUBE_DIR[v].clone().normalize();
    const r = this.radius;
    const target = this.controls.target;
    this.perspCamera.position.copy(target.clone().add(dir.multiplyScalar(r * 2.2)));
    this.orthoCamera.position.copy(this.perspCamera.position);
    this.orthoCamera.lookAt(target);
    this.perspCamera.lookAt(target);
    this.controls.update();
    this.onCubeView?.(v);
  }

  private radius = 90;

  frameCamera(radius: number, center: THREE.Vector3) {
    this.radius = radius;
    this.controls.target.copy(center);
    const dir = CUBE_DIR.iso.clone().normalize();
    this.perspCamera.position.copy(center.clone().add(dir.multiplyScalar(radius * 1.5)));
    this.orthoCamera.position.copy(this.perspCamera.position);
    const aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    const fs = radius * 1.25;
    this.orthoCamera.left = -fs * aspect;
    this.orthoCamera.right = fs * aspect;
    this.orthoCamera.top = fs;
    this.orthoCamera.bottom = -fs;
    this.orthoCamera.lookAt(center);
    this.orthoCamera.updateProjectionMatrix();
    this.controls.update();
  }

  resetView() {
    this.setCubeView('iso');
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

    // Tríada de ejes, esquina inferior izquierda
    const s = 88;
    const m = 8;
    this.renderer.setViewport(m, m, s, s);
    this.renderer.setScissor(m, m, s, s);
    this.renderer.setScissorTest(true);
    this.renderer.clearDepth();
    this.axisGroup.quaternion.copy(this.active.quaternion).invert();
    this.renderer.render(this.axisScene, this.axisCamera);

    // ViewCube, esquina superior derecha
    this.renderer.setViewport(w - m - this.cubeSize, h - m - this.cubeSize, this.cubeSize, this.cubeSize);
    this.renderer.setScissor(w - m - this.cubeSize, h - m - this.cubeSize, this.cubeSize, this.cubeSize);
    this.renderer.clearDepth();
    this.cubeRoot.quaternion.copy(this.active.quaternion).invert();
    this.renderer.render(this.cubeScene, this.cubeCamera);
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
    this.envRT?.dispose();
    this.stressBtn?.remove();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

/** Fondo en degradado vertical, estilo hoja CAD. */
function gradientTexture(top: string, bottom: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 2;
  cv.height = 256;
  const ctx = cv.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, cv.height);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cv.width, cv.height);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Contorno de aristas (estilo técnico) como hijo de una malla. */
export function addEdges(meshObj: THREE.Mesh, color: string = CAD.edge, threshold = 30) {
  const edges = new THREE.EdgesGeometry(meshObj.geometry, threshold);
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color }));
  line.userData.nonPick = true;
  line.renderOrder = 1;
  meshObj.add(line);
  return line;
}

/** Cota entre dos puntos: línea con topes, flechas y etiqueta al centro. */
export function makeDimension(p1: THREE.Vector3, p2: THREE.Vector3, text: string): THREE.Group {
  const g = new THREE.Group();
  g.userData.dim = true;
  const mat = new THREE.LineBasicMaterial({ color: CAD.dimLine, depthTest: false, transparent: true });
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p1, p2]), mat);
  line.renderOrder = 995;
  line.userData.nonPick = true;
  g.add(line);

  const dir = p2.clone().sub(p1).normalize();
  const perp = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const tick = perp.clone().multiplyScalar(2.6);
  [p1, p2].forEach((p) => {
    const tg = new THREE.BufferGeometry().setFromPoints([p.clone().add(tick), p.clone().sub(tick)]);
    const tl = new THREE.Line(tg, mat);
    tl.renderOrder = 995;
    tl.userData.nonPick = true;
    g.add(tl);
  });

  // Extensión de la cota: une el punto medido con la línea de cota.
  const mid = p1.clone().add(p2).multiplyScalar(0.5).add(perp.clone().multiplyScalar(5));
  const spr = textSprite(text, {
    color: CAD.dimText,
    size: 32,
    bg: true,
    bgColor: CAD.dimChip,
    border: CAD.dimChipBorder,
  });
  spr.position.copy(mid);
  spr.renderOrder = 1000;
  g.add(spr);
  return g;
}
