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

/** Colores propios por pieza (acabado de catálogo, no color de datos). */
export const COLORS = {
  placa: 0xb8c2cc,
  stacks: 0xd4a017,
  resortes: 0x8fa0b0,
  marco: 0x6b7785,
  junta: 0x2a333d,
  pcb: 0x1f8a4c,
  diodos: 0x1a1a1a,
  capacitor: 0x2f5fd0,
  resistencia: 0xd6a56b,
  led: 0xb3261e,
  electrodo: 0x8fa3b8,
  pata: 0xb8c2cc,
} as const;

/** Rango PBR exigido: metalness ≤ 0.3, roughness 0.4–0.6. */
const PBR = { metalness: 0.3, roughness: 0.5 } as const;

/** Cotas del marco, en mm. */
export const FRAME = {
  outer: 96,
  wall: 4,
  /** Altura total histórica (referencia de cotas); la bandeja real mide `tray`. */
  height: 40,
  /** Alto de las paredes de la bandeja: los stacks y los resortes quedan a la vista. */
  tray: 8,
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
  /** 0 = reposo (bandeja abierta), 1 = vista desplegada del todo. */
  explode: number;
}

/**
 * Despliegue por defecto: con `explode` a 0 la placa queda separada a 0.35,
 * de forma que se ven placa, resortes, stacks, PCB y bandeja a la vez.
 */
export const EXPLODE_REST = 0.35;

export interface AssemblyModel {
  group: THREE.Group;
  center: THREE.Vector3;
  radius: number;
  /** Aplica un estado completo (deformación, color, led, separación). */
  apply: (s: AssemblyState) => void;
  /** Enciende/apaga el mapa de esfuerzo en los stacks (por defecto, apagado). */
  setStressMap: (on: boolean) => void;
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
      metalness: Math.min(opts.metalness ?? PBR.metalness, 0.3),
      roughness: Math.min(Math.max(opts.roughness ?? PBR.roughness, 0.4), 0.6),
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

  // Altura de referencia: la bandeja va de y=0 a y=FRAME.tray (paredes bajas).
  const yFloor = 2;
  const yStackBase = yFloor + 2; // los stacks arrancan sobre el fondo de la bandeja
  const yPlate = yStackBase + stackH + 12; // la placa flota sobre los resortes
  const yBay = yFloor + 8; // bahía eléctrica

  // ---------------------------------------------------------------- stacks
  const stackGroup = new THREE.Group();
  const stackNodes: THREE.Group[] = [];
  /** Mapa de esfuerzo: conmutado desde el visor; OFF = color propio dorado. */
  let stressMap = false;
  const baseDiscColor = new THREE.Color(COLORS.stacks);
  const offsets: [number, number][] = [
    [pitch / 2, pitch / 2],
    [-pitch / 2, pitch / 2],
    [pitch / 2, -pitch / 2],
    [-pitch / 2, -pitch / 2],
  ];
  // Geometría y material compartidos por las 240 capas: los 4 stacks pintan
  // siempre con el mismo color (el del mapa o el dorado), así que un único
  // material basta y la escena pesa mucho menos.
  const discGeo = new THREE.CylinderGeometry(D / 2, D / 2, t, 40);
  const discMat = new THREE.MeshStandardMaterial({
    color: COLORS.stacks,
    metalness: 0.25,
    roughness: 0.45,
    emissive: 0x1c1302,
    emissiveIntensity: 0.6,
  });
  for (const [ox, oz] of offsets) {
    const node = new THREE.Group();
    node.position.set(ox, yStackBase, oz);
    for (let i = 0; i < n; i++) {
      // 60 cilindros por stack: 240 en total. Sin hueco entre capas.
      const d = new THREE.Mesh(discGeo, discMat);
      d.position.y = i * t + t / 2;
      d.castShadow = false;
      d.receiveShadow = false;
      node.add(d);
    }
    // Electrodos: líneas en las n+1 interfaces. No son láminas.
    const elMat = new THREE.LineBasicMaterial({ color: COLORS.stacks, transparent: true, opacity: 0.8 });
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
  // Cuatro resortes en las esquinas de la huella interior: el centro de cada
  // resorte está a `springOff` y su radio exterior (2.6 + 0.75) no alcanza la
  // pared interior (inner/2), de modo que los cuatro quedan DENTRO del marco.
  const springGroup = new THREE.Group();
  const springs: THREE.Mesh[] = [];
  const springH = yPlate - plateT / 2 - (yStackBase + stackH);
  const springOff = inner / 2 - 6; // 38 mm < inner/2 (44 mm)
  const springPos: [number, number][] = [
    [springOff, springOff],
    [-springOff, springOff],
    [springOff, -springOff],
    [-springOff, -springOff],
  ];
  for (const [sx, sz] of springPos) {
    const curve = springCurve(springH, Math.max(4, Math.round(springH / 3)), 2.6);
    const sp = mesh(new THREE.TubeGeometry(curve, 220, 0.75, 16, false), COLORS.resortes, {
      metalness: 0.3,
      roughness: 0.4,
    });
    sp.position.set(sx, yStackBase + stackH, sz);
    springs.push(sp);
    springGroup.add(sp);
  }
  group.add(tag(springGroup, 'resortes'));

  // ------------------------------------------------------- placa de pisada
  const plateGroup = new THREE.Group();
  const plate = mesh(new THREE.BoxGeometry(inner, plateT, inner), COLORS.placa, {
    metalness: 0.3,
    roughness: 0.4,
  });
  // Translúcida por defecto (0.15): deja ver los 4 stacks, los resortes y el
  // interior; con 0.3 se leía como una tapa gris.
  const plateMat = plate.material as THREE.MeshStandardMaterial;
  plateMat.transparent = true;
  plateMat.opacity = 0.15;
  plateMat.depthWrite = false;
  plate.position.y = yPlate - plateT / 2;
  plateGroup.add(plate);
  // Nervios de rigidez, también de acero y parte de la misma pieza.
  for (const s of [-1, 1]) {
    const rib = mesh(new THREE.BoxGeometry(inner, 1.2, 3), COLORS.placa, { metalness: 0.3, roughness: 0.45 });
    rib.position.set(0, yPlate - plateT - 0.6, (s * inner) / 4);
    plateGroup.add(rib);
  }
  group.add(tag(plateGroup, 'placa'));

  // ------------------------------------------------------------- bandeja baja
  // Bandeja (no marco alto): paredes de FRAME.tray = 8 mm como máximo, de modo
  // que los stacks (30 mm) y los resortes quedan visibles por encima.
  const frameGroup = new THREE.Group();
  const frameMat = { metalness: 0.2, roughness: 0.55 };
  const tray = FRAME.tray;
  const mkWall = (w: number, d: number, x: number, z: number) => {
    const m = mesh(new THREE.BoxGeometry(w, tray, d), COLORS.marco, frameMat);
    m.position.set(x, yFloor + tray / 2, z);
    frameGroup.add(m);
  };
  mkWall(outer, wall, 0, -inner / 2 - wall / 2);
  mkWall(outer, wall, 0, inner / 2 + wall / 2);
  mkWall(wall, inner, -inner / 2 - wall / 2, 0);
  mkWall(wall, inner, inner / 2 + wall / 2, 0);
  // Fondo
  const floor = mesh(new THREE.BoxGeometry(inner, wall, inner), COLORS.marco, frameMat);
  floor.position.y = yFloor - wall / 2;
  frameGroup.add(floor);
  // Junta: cuatro rebates sobre el borde de la bandeja (sellado IP65). Se
  // conserva como anillo, no como losa, para no cegar el interior de la bandeja.
  const mkGasket = (w: number, d: number, x: number, z: number) => {
    const g = mesh(new THREE.BoxGeometry(w, 1.4, d), COLORS.junta, {
      metalness: 0.1,
      roughness: 0.6,
    });
    g.position.set(x, yFloor + tray - 0.7, z);
    frameGroup.add(g);
  };
  mkGasket(outer + 0.8, wall + 0.8, 0, -inner / 2 - wall / 2);
  mkGasket(outer + 0.8, wall + 0.8, 0, inner / 2 + wall / 2);
  mkGasket(wall + 0.8, inner + 0.8, -inner / 2 - wall / 2, 0);
  mkGasket(wall + 0.8, inner + 0.8, inner / 2 + wall / 2, 0);
  group.add(tag(frameGroup, 'marco'));

  // ------------------------------------------------------------------- pcb
  const pcbGroup = new THREE.Group();
  const pcb = mesh(new THREE.BoxGeometry(30, pcbT, 22), COLORS.pcb, {
    metalness: 0.1,
    roughness: 0.55,
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
  const b1 = mesh(new THREE.BoxGeometry(9, 5.2, 4.4), COLORS.diodos, { metalness: 0.15, roughness: 0.5 });
  b1.position.copy(bridgePos);
  bridgeGroup.add(b1);
  for (let i = 0; i < 4; i++) {
    const d = mesh(new THREE.BoxGeometry(1.1, 1.6, 0.5), COLORS.pata, { metalness: 0.3, roughness: 0.45 });
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
  const can = mesh(new THREE.CylinderGeometry(3.2, 3.2, 8, 28), COLORS.capacitor, {
    metalness: 0.25,
    roughness: 0.45,
  });
  can.position.copy(csPos);
  csGroup.add(can);
  const cap = mesh(new THREE.CylinderGeometry(3.3, 3.3, 0.6, 28), COLORS.pata, {
    metalness: 0.3,
    roughness: 0.4,
  });
  cap.position.set(csPos.x, csPos.y + 4.2, csPos.z);
  csGroup.add(cap);
  // Tira de la polaridad
  const stripe = mesh(new THREE.BoxGeometry(1.2, 8.1, 6.5), 0x8fb0e8, { metalness: 0.1, roughness: 0.5 });
  stripe.position.copy(csPos);
  csGroup.add(stripe);
  group.add(tag(csGroup, 'cs'));

  // ------------------------------------------------------------ resistencia
  const rGroup = new THREE.Group();
  const rPos = new THREE.Vector3(10, yBay + pcbT / 2 + 2.2, -inner / 2 + 5.5);
  const body = mesh(new THREE.CylinderGeometry(1.9, 1.9, 6.4, 20), COLORS.resistencia, {
    metalness: 0.1,
    roughness: 0.55,
  });
  body.rotation.z = Math.PI / 2;
  body.position.copy(rPos);
  rGroup.add(body);
  for (const s of [-1, 1]) {
    const lead = mesh(new THREE.CylinderGeometry(0.35, 0.35, 3, 10), COLORS.pata, { metalness: 0.3, roughness: 0.45 });
    lead.rotation.z = Math.PI / 2;
    lead.position.set(rPos.x + s * 4.4, rPos.y, rPos.z);
    rGroup.add(lead);
  }
  group.add(tag(rGroup, 'resistencia'));

  // ------------------------------------------------------------------- led
  const ledGroup = new THREE.Group();
  const ledPos = new THREE.Vector3(10, yBay + pcbT / 2 + 2.6, -inner / 2 + 13);
  const ledMat = new THREE.MeshStandardMaterial({
    color: COLORS.led,
    metalness: 0.1,
    roughness: 0.45,
    emissive: 0xef5350,
    emissiveIntensity: 0,
    transparent: true,
    opacity: 0.92,
  });
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 4.4, 24), ledMat);
  lens.position.copy(ledPos);
  ledGroup.add(lens);
  const flange = mesh(new THREE.CylinderGeometry(2.7, 2.7, 1.1, 24), COLORS.pata, {
    metalness: 0.3,
    roughness: 0.45,
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
        return new THREE.Vector3(springOff, yStackBase + stackH + springH / 2, springOff);
      case 'stacks':
        return new THREE.Vector3(pitch / 2, yStackBase + stackH / 2, pitch / 2);
      case 'marco':
        return new THREE.Vector3(-outer / 2, yFloor + FRAME.tray / 2, 0);
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

  /** Despliegue efectivo aplicado en el último `apply`. */
  let explodeAmt = EXPLODE_REST;

  const apply = (s: AssemblyState) => {
    Object.assign(state, s);

    // --- deformación: δ = S·T sale del solver, exagerada por factor fijo
    const F = Math.max(0, s.Fmax);
    const sigma = stackStress(F);
    const delta = stackCompression(F, STACK.totalThickness);
    const compVis = Math.max(0, Math.min(0.4, (delta * s.exaggeration) / STACK.totalThickness));

    // --- color de los stacks: mapa de esfuerzo SOLO si está activado;
    //     apagado, vuelven a su color dorado propio.
    const col = new THREE.Color(stressColorHex(sigma / 1e6));
    if (stressMap) {
      discMat.color.copy(col);
      discMat.emissive.copy(col).multiplyScalar(0.4);
    } else {
      discMat.color.copy(baseDiscColor);
      discMat.emissive.setHex(0x1c1302);
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

    // --- separación de la vista desplegada: el reposo (explode = 0) ya es
    //     una vista abierta al 0.35; el botón desplegar la lleva al 1.0.
    const e = EXPLODE_REST + (1 - EXPLODE_REST) * Math.max(0, Math.min(1, state.explode));
    explodeAmt = e;
    for (const id of Object.keys(explode) as PartId[]) {
      const g = byId[id];
      if (!g) continue;
      const off = explode[id];
      g.position.set(off.x * e, off.y * e, off.z * e);
    }

    // --- la placa es translúcida en reposo (0.15) y vuelve a ser opaca al
    //     desplegar del todo, para poder leer la pieza sola.
    const op = 0.15 + 0.85 * Math.max(0, Math.min(1, state.explode));
    if (Math.abs(plateMat.opacity - op) > 0.01) {
      const wasTransparent = plateMat.transparent;
      plateMat.transparent = op < 0.99;
      plateMat.depthWrite = !plateMat.transparent;
      plateMat.opacity = op;
      if (wasTransparent !== plateMat.transparent) plateMat.needsUpdate = true;
    }
  };

  const setVisible = (id: PartId, visible: boolean) => {
    const g = byId[id];
    if (g) g.visible = visible;
  };

  const center = new THREE.Vector3(0, yStackBase + stackH / 2, 0);
  const radius = outer * 1.5;

  // --- aristas en TODAS las piezas: líneas de 1 px, umbral 25° ------------
  // Material único compartido; la geometría de aristas se cachea por
  // geometría de malla (las 240 capas de disco comparten la suya).
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x1f2d3d,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const edgeGeoCache = new Map<THREE.BufferGeometry, THREE.EdgesGeometry>();
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    let eg = edgeGeoCache.get(m.geometry);
    if (!eg) {
      eg = new THREE.EdgesGeometry(m.geometry, 25);
      edgeGeoCache.set(m.geometry, eg);
    }
    const line = new THREE.LineSegments(eg, edgeMat);
    line.userData.nonPick = true;
    line.renderOrder = 2;
    m.add(line);
  });

  // --- API del visor: el botón «mapa de esfuerzo» vive en viewer.ts y llama
  //     aquí a través del userData del grupo. Desconocido = apagado.
  const setStressMap = (v: boolean) => {
    stressMap = v;
    apply(state);
  };
  group.userData.setStressMap = setStressMap;

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
    setStressMap,
    setVisible,
    anchorOf,
    explodedAnchorOf: (id) => anchorOf(id).add(explode[id].clone().multiplyScalar(explodeAmt)),
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
