/**
 * Modelo 3D del ensamble completo del módulo de grada (C8, C9).
 *
 * Reglas de la fase 2:
 *  · 4 stacks de 60 capas dibujados PEGADOS: la altura renderizada es
 *    exactamente T = 30 mm, no T + (n−1)·gap.
 *  · Los electrodos son LÍNEAS en las interfaces entre capas, no láminas: no
 *    engordan el stack ni falsean la cota de 30 mm.
 *  · La deformación sale del solver (S = σ·s33E, δ = S·T) multiplicada por un
 *    factor de exageración FIJO que se muestra siempre en pantalla.
 *  · El color es el esfuerzo REAL σ en MPa. Es una escala de datos.
 *  · Cada pieza lleva `userData.pick.id`, el mismo id que el árbol y el BOM,
 *    para que la selección sea bidireccional.
 *
 * Unidades de escena: milímetros.
 */
import * as THREE from 'three';
import { STACK, ALERTS } from '../core/referenceModel';
import { stackStress, stackCompression } from '../core/tile';
import { PartId } from '../bom/bom';
import { stressColorHex } from '../ui/cad/theme';

const MM = 1000;

/** Cotas del marco, en mm. */
export const FRAME = {
  outer: 96,
  wall: 4,
  height: 40,
  plateThickness: 3,
  pcbThickness: 1.6,
  /** Separación en X/Z entre centros de stack. */
  stackPitch: 22,
} as const;

export interface AssemblyState {
  /** Fuerza pico actual [N]: el color y la deformación salen de ella. */
  Fmax: number;
  /** Factor de exageración de la deformación (fijo, lo fija el solver). */
  exaggeration: number;
  /** Corriente del LED [A]: el led se ilumina en proporción. */
  ILed: number;
  /** Corriente de referencia para normalizar la iluminación del led. */
  ILedRef: number;
  /** 0 = ensamblado, 1 = vista desplegada. */
  explode: number;
}

export interface AssemblyModel {
  group: THREE.Group;
  center: THREE.Vector3;
  radius: number;
  /** Aplica un estado completo (deformación, color, led, separación). */
  apply: (s: AssemblyState) => void;
  /** Fija la visibilidad de una pieza por id. */
  setVisible: (id: PartId, visible: boolean) => void;
  /** Posición de referencia de una pieza, para el punto del globo. */
  anchorOf: (id: PartId) => THREE.Vector3;
  /** Posición de la pieza desplazada por la vista desplegada. */
  explodedAnchorOf: (id: PartId) => THREE.Vector3;
  /** Desplazamiento de la vista desplegada de cada pieza [mm]. */
  explodeOffsetOf: (id: PartId) => THREE.Vector3;
  dispose: () => void;
}

/** Envuelve un objeto con su id de selección. */
function tag(obj: THREE.Object3D, id: PartId): THREE.Object3D {
  obj.userData.pick = { id, partKind: id, name: id };
  return obj;
}

function mesh(
  geo: THREE.BufferGeometry,
  color: number,
  opts: { metalness?: number; roughness?: number; emissive?: number; ei?: number } = {}
): THREE.Mesh {
  return new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color,
      metalness: opts.metalness ?? 0.5,
      roughness: opts.roughness ?? 0.55,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.ei ?? 1,
    })
  );
}

/** Curva de un resorte helicoidal. */
function springCurve(height: number, coils: number, r: number): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  const seg = coils * 20;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * coils * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, (i / seg) * height, Math.sin(a) * r));
  }
  return new THREE.CatmullRomCurve3(pts);
}

/**
 * Construye el ensamble completo.
 *
 * Capas de abajo arriba: marco base, resortes, stacks, placa de pisada.
 * El conjunto eléctrico (pcb, puente, Cs, R, led) se coloca en una bahía
 * lateral dentro del marco, que es donde en una implementación real iría.
 */
export function buildAssembly(): AssemblyModel {
  const group = new THREE.Group();
  const D = STACK.diameter * MM; // 8 mm
  const t = STACK.layerThickness * MM; // 0.5 mm
  const n = STACK.nLayers; // 60
  const stackH = n * t; // 30 mm exactos
  const pitch = FRAME.stackPitch;
  const wall = FRAME.wall;
  const outer = FRAME.outer;
  const inner = outer - 2 * wall;
  const plateT = FRAME.plateThickness;
  const pcbT = FRAME.pcbThickness;

  // Altura de referencia: el marco va de y=0 a y=FRAME.height.
  const yFloor = 2;
  const yStackBase = yFloor + 2; // los stacks arrancan sobre el fondo del marco
  const yPlate = yStackBase + stackH + 6; // la placa va sobre los resortes
  const yBay = yFloor + 8; // bahía eléctrica

  // ---------------------------------------------------------------- stacks
  const stackGroup = new THREE.Group();
  const discs: THREE.Mesh[] = [];
  const stackNodes: THREE.Group[] = [];
  const offsets: [number, number][] = [
    [pitch / 2, pitch / 2],
    [-pitch / 2, pitch / 2],
    [pitch / 2, -pitch / 2],
    [-pitch / 2, -pitch / 2],
  ];
  for (const [ox, oz] of offsets) {
    const node = new THREE.Group();
    node.position.set(ox, yStackBase, oz);
    for (let i = 0; i < n; i++) {
      // 60 cilindros por stack: 240 en total. Sin hueco entre capas.
      const d = mesh(new THREE.CylinderGeometry(D / 2, D / 2, t, 40), 0x38bdf8, {
        metalness: 0.2,
        roughness: 0.45,
        emissive: 0x0b2a38,
        ei: 0.7,
      });
      d.position.y = i * t + t / 2;
      d.castShadow = false;
      d.receiveShadow = false;
      discs.push(d);
      node.add(d);
    }
    // Electrodos: líneas en las n+1 interfaces. No son láminas.
    const elMat = new THREE.LineBasicMaterial({ color: 0xf5a524, transparent: true, opacity: 0.8 });
    for (let i = 0; i <= n; i++) {
      const ring: THREE.Vector3[] = [];
      const seg = 56;
      for (let k = 0; k <= seg; k++) {
        const a = (k / seg) * Math.PI * 2;
        ring.push(new THREE.Vector3(Math.cos(a) * (D / 2 + 0.3), i * t, Math.sin(a) * (D / 2 + 0.3)));
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), elMat);
      line.userData.nonPick = true;
      node.add(line);
    }
    stackNodes.push(node);
    stackGroup.add(node);
  }
  group.add(tag(stackGroup, 'stacks'));

  // ------------------------------------------------------------- resortes x4
  const springGroup = new THREE.Group();
  const springs: THREE.Mesh[] = [];
  const springH = yPlate - plateT / 2 - (yStackBase + stackH);
  const springOff = inner / 2 - 6;
  for (const [ox, oz] of offsets) {
    for (const s of [1, -1]) {
      const curve = springCurve(springH, Math.max(4, Math.round(springH / 5)), 2.6);
      const sp = mesh(new THREE.TubeGeometry(curve, 220, 0.75, 8, false), 0x9aa7b4, {
        metalness: 0.85,
        roughness: 0.3,
      });
      sp.position.set(ox + s * springOff, yStackBase + stackH, oz);
      springs.push(sp);
      springGroup.add(sp);
    }
  }
  group.add(tag(springGroup, 'resortes'));

  // ------------------------------------------------------- placa de pisada
  const plateGroup = new THREE.Group();
  const plate = mesh(new THREE.BoxGeometry(inner, plateT, inner), 0xb9c4cf, {
    metalness: 0.9,
    roughness: 0.28,
  });
  plate.position.y = yPlate - plateT / 2;
  plateGroup.add(plate);
  // Nervios de rigidez, también de acero y parte de la misma pieza.
  for (const s of [-1, 1]) {
    const rib = mesh(new THREE.BoxGeometry(inner, 1.2, 3), 0xaab5c0, { metalness: 0.9, roughness: 0.3 });
    rib.position.set(0, yPlate - plateT - 0.6, (s * inner) / 4);
    plateGroup.add(rib);
  }
  group.add(tag(plateGroup, 'placa'));

  // ------------------------------------------------------------ marco base
  const frameGroup = new THREE.Group();
  const frameMat = { metalness: 0.15, roughness: 0.75 };
  const mkWall = (w: number, d: number, x: number, z: number) => {
    const m = mesh(new THREE.BoxGeometry(w, FRAME.height, d), 0x2b3a4a, frameMat);
    m.position.set(x, yFloor + FRAME.height / 2, z);
    frameGroup.add(m);
  };
  mkWall(outer, wall, 0, -inner / 2 - wall / 2);
  mkWall(outer, wall, 0, inner / 2 + wall / 2);
  mkWall(wall, inner, -inner / 2 - wall / 2, 0);
  mkWall(wall, inner, inner / 2 + wall / 2, 0);
  // Fondo
  const floor = mesh(new THREE.BoxGeometry(inner, wall, inner), 0x24313f, frameMat);
  floor.position.y = yFloor - wall / 2;
  frameGroup.add(floor);
  // Tapa trasera con junta: dos rebates que sugieren el sellado IP65
  const gasket = mesh(new THREE.BoxGeometry(inner, 1.4, inner), 0x1a2430, {
    metalness: 0,
    roughness: 0.9,
  });
  gasket.position.y = yFloor + FRAME.height - 1.4;
  frameGroup.add(gasket);
  group.add(tag(frameGroup, 'marco'));

  // ------------------------------------------------------------------- pcb
  const pcbGroup = new THREE.Group();
  const pcb = mesh(new THREE.BoxGeometry(30, pcbT, 22), 0x1f6b3a, {
    metalness: 0.1,
    roughness: 0.8,
  });
  pcb.position.set(0, yBay, -inner / 2 + 12);
  pcbGroup.add(pcb);
  // Pistas del circuito, como líneas sobre la placa
  const traceMat = new THREE.LineBasicMaterial({ color: 0x3ddc97, transparent: true, opacity: 0.75 });
  for (let i = 0; i < 7; i++) {
    const y = yBay + pcbT / 2 + 0.05;
    const z0 = -inner / 2 + 3 + i * 3;
    const pts = [
      new THREE.Vector3(-13, y, z0),
      new THREE.Vector3(-4, y, z0),
      new THREE.Vector3(4, y, z0 + 1.2),
      new THREE.Vector3(13, y, z0 + 1.2),
    ];
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), traceMat);
    l.userData.nonPick = true;
    pcbGroup.add(l);
  }
  group.add(tag(pcbGroup, 'pcb'));

  // ---------------------------------------------------------------- puente
  const bridgeGroup = new THREE.Group();
  const bridgePos = new THREE.Vector3(-9, yBay + pcbT / 2 + 2.6, -inner / 2 + 7);
  const b1 = mesh(new THREE.BoxGeometry(9, 5.2, 4.4), 0x11151b, { metalness: 0.2, roughness: 0.6 });
  b1.position.copy(bridgePos);
  bridgeGroup.add(b1);
  for (let i = 0; i < 4; i++) {
    const d = mesh(new THREE.BoxGeometry(1.1, 1.6, 0.5), 0x9aa7b4, { metalness: 0.9, roughness: 0.25 });
    d.position.set(
      bridgePos.x - 3 + (i % 2) * 6,
      bridgePos.y + 1.2,
      bridgePos.z - 2.3 + Math.floor(i / 2) * 4.6
    );
    bridgeGroup.add(d);
  }
  group.add(tag(bridgeGroup, 'puente'));

  // -------------------------------------------------------------------- cs
  const csGroup = new THREE.Group();
  const csPos = new THREE.Vector3(1, yBay + pcbT / 2 + 4, -inner / 2 + 6);
  const can = mesh(new THREE.CylinderGeometry(3.2, 3.2, 8, 28), 0x2b3a4a, {
    metalness: 0.4,
    roughness: 0.5,
  });
  can.position.copy(csPos);
  csGroup.add(can);
  const cap = mesh(new THREE.CylinderGeometry(3.3, 3.3, 0.6, 28), 0xc8d3df, {
    metalness: 0.7,
    roughness: 0.35,
  });
  cap.position.set(csPos.x, csPos.y + 4.2, csPos.z);
  csGroup.add(cap);
  // Tira de la polaridad
  const stripe = mesh(new THREE.BoxGeometry(1.2, 8.1, 6.5), 0x38bdf8, { metalness: 0, roughness: 0.9 });
  stripe.position.copy(csPos);
  csGroup.add(stripe);
  group.add(tag(csGroup, 'cs'));

  // ------------------------------------------------------------ resistencia
  const rGroup = new THREE.Group();
  const rPos = new THREE.Vector3(10, yBay + pcbT / 2 + 2.2, -inner / 2 + 5.5);
  const body = mesh(new THREE.CylinderGeometry(1.9, 1.9, 6.4, 20), 0xd8c39a, {
    metalness: 0.1,
    roughness: 0.7,
  });
  body.rotation.z = Math.PI / 2;
  body.position.copy(rPos);
  rGroup.add(body);
  for (const s of [-1, 1]) {
    const lead = mesh(new THREE.CylinderGeometry(0.35, 0.35, 3, 10), 0xc8d3df, { metalness: 0.95, roughness: 0.2 });
    lead.rotation.z = Math.PI / 2;
    lead.position.set(rPos.x + s * 4.4, rPos.y, rPos.z);
    rGroup.add(lead);
  }
  group.add(tag(rGroup, 'resistencia'));

  // ------------------------------------------------------------------- led
  const ledGroup = new THREE.Group();
  const ledPos = new THREE.Vector3(10, yBay + pcbT / 2 + 2.6, -inner / 2 + 13);
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x7a1512,
    metalness: 0.1,
    roughness: 0.35,
    emissive: 0xef5350,
    emissiveIntensity: 0,
    transparent: true,
    opacity: 0.92,
  });
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 4.4, 24), ledMat);
  lens.position.copy(ledPos);
  ledGroup.add(lens);
  const flange = mesh(new THREE.CylinderGeometry(2.7, 2.7, 1.1, 24), 0xc8d3df, {
    metalness: 0.7,
    roughness: 0.3,
  });
  flange.position.set(ledPos.x, ledPos.y - 2.4, ledPos.z);
  ledGroup.add(flange);
  group.add(tag(ledGroup, 'led'));

  // ------------------------------------------------- offsets de la explosion
  const explode: Record<PartId, THREE.Vector3> = {
    ensamble: new THREE.Vector3(0, 0, 0),
    placa: new THREE.Vector3(0, 42, 0),
    resortes: new THREE.Vector3(0, 21, 0),
    stacks: new THREE.Vector3(0, 0, 0),
    marco: new THREE.Vector3(0, 0, 0),
    pcb: new THREE.Vector3(-52, 6, 0),
    puente: new THREE.Vector3(-52, 0, 26),
    cs: new THREE.Vector3(-52, 0, 0),
    resistencia: new THREE.Vector3(-52, 0, -26),
    led: new THREE.Vector3(-52, 0, -52),
  };

  //AGRUPACIÓN por id para aplicar offsets
  const byId: Record<string, THREE.Group> = {};
  group.children.forEach((c) => {
    const id = c.userData?.pick?.id as PartId | undefined;
    if (id) byId[id] = c as THREE.Group;
  });

  const anchorOf = (id: PartId): THREE.Vector3 => {
    switch (id) {
      case 'placa':
        return new THREE.Vector3(0, yPlate, 0);
      case 'resortes':
        return new THREE.Vector3(pitch / 2 + springOff, yStackBase + stackH + springH / 2, pitch / 2);
      case 'stacks':
        return new THREE.Vector3(pitch / 2, yStackBase + stackH / 2, pitch / 2);
      case 'marco':
        return new THREE.Vector3(-outer / 2, yFloor + FRAME.height / 2, 0);
      case 'pcb':
        return new THREE.Vector3(0, yBay, -inner / 2 + 12);
      case 'puente':
        return bridgePos.clone().add(new THREE.Vector3(0, 3, 0));
      case 'cs':
        return csPos.clone().add(new THREE.Vector3(0, 4, 0));
      case 'resistencia':
        return rPos.clone();
      case 'led':
        return ledPos.clone().add(new THREE.Vector3(0, 3, 0));
      default:
        return new THREE.Vector3(0, yStackBase + stackH / 2, 0);
    }
  };

  const state: AssemblyState = {
    Fmax: 0,
    exaggeration: 1,
    ILed: 0,
    ILedRef: 1e-3,
    explode: 0,
  };

  const apply = (s: AssemblyState) => {
    Object.assign(state, s);

    // --- deformación: δ = S·T sale del solver, exagerada por factor fijo
    const F = Math.max(0, s.Fmax);
    const sigma = stackStress(F);
    const delta = stackCompression(F, STACK.totalThickness);
    const compVis = Math.max(0, Math.min(0.4, (delta * s.exaggeration) / STACK.totalThickness));

    // --- color por esfuerzo REAL en MPa
    const col = new THREE.Color(stressColorHex(sigma / 1e6));
    for (const d of discs) {
      const m = d.material as THREE.MeshStandardMaterial;
      m.color.copy(col);
      m.emissive.copy(col).multiplyScalar(0.4);
    }

    // --- posición de la placa según la compresión
    const plateDrop = stackH * compVis;
    plateGroup.position.y = -plateDrop;
    for (const sp of springs) sp.scale.y = 1 - compVis;
    for (const node of stackNodes) node.scale.y = 1 - compVis;

    // --- el led se ilumina en proporción a I_LED
    const frac = Math.max(0, Math.min(1, s.ILed / (s.ILedRef || 1e-12)));
    ledMat.emissiveIntensity = frac * 3.2;
    ledMat.color.setRGB(0.48 + frac * 0.5, 0.08 + frac * 0.12, 0.07 + frac * 0.1);

    // --- separación de la vista desplegada
    const e = state.explode;
    for (const id of Object.keys(explode) as PartId[]) {
      const g = byId[id];
      if (!g) continue;
      const off = explode[id];
      g.position.set(off.x * e, off.y * e, off.z * e);
    }
  };

  const setVisible = (id: PartId, visible: boolean) => {
    const g = byId[id];
    if (g) g.visible = visible;
  };

  const center = new THREE.Vector3(0, yFloor + FRAME.height / 2, 0);
  const radius = outer * 1.5;

  apply(state);

  const dispose = () => {
    group.traverse((o) => {
      const any = o as any;
      if (any.geometry) any.geometry.dispose();
      if (any.material) {
        const mats = Array.isArray(any.material) ? any.material : [any.material];
        mats.forEach((m: any) => m.dispose && m.dispose());
      }
    });
  };

  return {
    group,
    center,
    radius,
    apply,
    setVisible,
    anchorOf,
    explodedAnchorOf: (id) => anchorOf(id).add(explode[id]),
    explodeOffsetOf: (id) => explode[id],
    dispose,
  };
}

/** Límite de alerta de esfuerzo, en MPa, para las_barras de la interfaz. */
export const SIGMA_LIMIT_MPA = ALERTS.sigmaLimit / 1e6;

/** Altura total del stack en mm, para las cotas. */
export const STACK_HEIGHT_MM = STACK.totalThicknessMm;

/** Diámetro del disco en mm, para las cotas. */
export const DISC_DIAMETER_MM = STACK.diameterMm;
