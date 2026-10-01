/**
 * Modelo 3D del ensamble completo del módulo de grada (C8, C9).
 *
 * La FIGURA 3D es literalmente el `tileModel.ts` de `Intento2` (copiado como
 * `render/tileModel.ts`): placa base `0x2b3442`, stack central de discos
 * teal `0x39e1c6` con electrodos dorados `0xffcf6b`, placa superior `0x4a5568`
 * y cuatro resortes helicoidales `0x8892a3` en las esquinas. Su `update()`
 * (compresión + mapa de calor `heatColor`) ES la animación del latido.
 *
 * Sobre esa figura este módulo añade únicamente la lógica de trabajo CAD, sin
 * alterar geometría ni materiales:
 *  · Cada parte se agrupa con el `userData.pick.id` del BOM/árbol, para que
 *    selección, visibilidad y globos sigan funcionando.
 *  · El conjunto eléctrico (pcb, puente, Cs, R, led) vive bajo la placa base
 *    (marco hermético: ensamblado no se ve; la vista desplegada lo saca).
 *  · El factor de explosión CAD recorre las mallas en vertical, con sus
 *    líneas guía punteadas.
 *  · El botón «mapa de esfuerzo» sustituye el heatColor por la escala de
 *    datos σ (MPa reales); apagado, la animación es la de `Intento2`.
 *
 * Unidades de escena: milímetros.
 */
import * as THREE from 'three';
import { STACK, ALERTS } from '../core/referenceModel';
import { stackStress } from '../core/tile';
import { PartId } from '../bom/bom';
import { stressColorHex } from '../ui/cad/theme';
import { buildTileModel, TILE } from './tileModel';

const MM = 1000;

/** Colores del conjunto eléctrico (la figura base viene de `tileModel`). */
export const COLORS = {
  pcb: 0x1f8a4c,
  diodos: 0x1a1a1a,
  capacitor: 0x2f5fd0,
  resistencia: 0xd6a56b,
  led: 0xb3261e,
  pata: 0xb8c2cc,
} as const;

/** Rango PBR del conjunto eléctrico: metalness ≤ 0.3, roughness 0.4–0.6. */
const PBR = { metalness: 0.3, roughness: 0.5 } as const;

/** Cotas de la figura `Intento2` con el modelo de referencia congelado. */
export const TILE_GEOM: TILE = (() => {
  const D = STACK.diameter * MM;
  const t = STACK.layerThickness * MM;
  const n = STACK.nLayers;
  const plateSize = Math.max(D * 2.2, 40);
  const plateH = 4;
  const gap = t * 0.15;
  const stackH = n * t + (n - 1) * gap;
  const baseY = plateH;
  return {
    D,
    t,
    n,
    gap,
    plateSize,
    plateH,
    stackH,
    baseY,
    topRestY: baseY + stackH + plateH / 2,
    springOff: plateSize / 2 - 5,
  };
})();

/** Altura del stack que mide el solver (30 mm de cerámica pura). */
export const STACK_HEIGHT_MM = STACK.totalThicknessMm;

/** Diámetro del disco en mm. */
export const DISC_DIAMETER_MM = STACK.diameterMm;

/** castShadow/receiveShadow en todas las mallas de un subárbol. */
function shadows(o: THREE.Object3D, cast = true, receive = true): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = cast;
      m.receiveShadow = receive;
    }
  });
}

export interface AssemblyState {
  /** Fuerza pico actual [N]: el mapa de σ y el corte salen de ella. */
  Fmax: number;
  /**
   * Fuerza normalizada 0..1 (F / F_pico): drive del `update(forceNorm)` de
   * `Intento2` — compresión + latido heatColor.
   */
  forceNorm: number;
  /** Factor de exageración de la deformación (lo fija el solver). */
  exaggeration: number;
  /** Corriente del LED [A]: el led se ilumina en proporción. */
  ILed: number;
  /** Corriente de referencia para normalizar la iluminación del led. */
  ILedRef: number;
  /** 0 = ensamblado (placa apoyada en el stack), 1 = vista desplegada. */
  explode: number;
}

export interface AssemblyModel {
  group: THREE.Group;
  center: THREE.Vector3;
  radius: number;
  apply: (s: AssemblyState) => void;
  setStressMap: (on: boolean) => void;
  setVisible: (id: PartId, visible: boolean) => void;
  anchorOf: (id: PartId) => THREE.Vector3;
  explodedAnchorOf: (id: PartId) => THREE.Vector3;
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

/**
 * Construye el ensamble: la figura de `Intento2` + conjunto eléctrico bajo la
 * placa base + lógica CAD (explosión vertical con guías punteadas).
 */
export function buildAssembly(): AssemblyModel {
  const tile = buildTileModel({
    diameter: STACK.diameter,
    thickness: STACK.layerThickness,
    nLayers: STACK.nLayers,
    scaleFactor: 100,
  });
  const g = tile.dims;
  const group = new THREE.Group();

  // ------------------------------------------------ partes de la figura base
  const frameGroup = new THREE.Group();
  frameGroup.add(tile.parts.base);
  const stackGroup = new THREE.Group();
  stackGroup.add(tile.parts.discGroup);
  const plateGroup = new THREE.Group();
  plateGroup.add(tile.parts.top);
  const springGroup = new THREE.Group();
  for (const s of tile.parts.springs) springGroup.add(s);

  group.add(tag(frameGroup, 'marco'));
  group.add(tag(stackGroup, 'stacks'));
  group.add(tag(plateGroup, 'placa'));
  group.add(tag(springGroup, 'resortes'));

  // --------------------------------------- conjunto eléctrico SOBRE el piso
  // La electrónica va montada EN LA CARA SUPERIOR de la placa base (el piso
  // de la bandeja), en la banda posterior. Con factor 0 % de explosión el
  // conjunto está OCULTO: sólo aparece al comenzar a desplegar, y cada pieza
  // sale a su propio espacio (laterales y fondo), sin amontonarse.
  const yPcb = g.baseY + 1; // PCB apoyado sobre el piso (base top = 4)
  const pcbTop = yPcb + 0.8;
  const pcbZ = -10;

  const pcbGroup = new THREE.Group();
  const pcb = mesh(new THREE.BoxGeometry(24, 1.6, 12), COLORS.pcb);
  pcb.position.set(0, yPcb, pcbZ);
  pcbGroup.add(pcb);
  const traceMat = new THREE.LineBasicMaterial({ color: 0x3ddc97, transparent: true, opacity: 0.75 });
  for (let i = 0; i < 5; i++) {
    const y = pcbTop + 0.05;
    const z0 = pcbZ - 5 + i * 2.5;
    const pts = [
      new THREE.Vector3(-10, y, z0),
      new THREE.Vector3(-3, y, z0),
      new THREE.Vector3(3, y, z0 + 1),
      new THREE.Vector3(10, y, z0 + 1),
    ];
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), traceMat);
    l.userData.nonPick = true;
    pcbGroup.add(l);
  }
  shadows(pcbGroup);
  group.add(tag(pcbGroup, 'pcb'));

  const bridgeGroup = new THREE.Group();
  const bridgePos = new THREE.Vector3(-7.5, pcbTop + 2, pcbZ - 1);
  const b1 = mesh(new THREE.BoxGeometry(7, 4, 3.5), COLORS.diodos);
  b1.position.copy(bridgePos);
  bridgeGroup.add(b1);
  for (let i = 0; i < 4; i++) {
    const d = mesh(new THREE.BoxGeometry(0.9, 1.2, 0.4), COLORS.pata);
    d.position.set(
      bridgePos.x - 2.5 + (i % 2) * 5,
      bridgePos.y + 1.8,
      bridgePos.z - 1.7 + Math.floor(i / 2) * 3.4
    );
    bridgeGroup.add(d);
  }
  shadows(bridgeGroup);
  group.add(tag(bridgeGroup, 'puente'));

  const csGroup = new THREE.Group();
  const csPos = new THREE.Vector3(0.5, pcbTop + 3, pcbZ - 1.5);
  const can = mesh(new THREE.CylinderGeometry(2.2, 2.2, 6, 28), COLORS.capacitor);
  can.position.copy(csPos);
  csGroup.add(can);
  const capTop = mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.5, 28), COLORS.pata);
  capTop.position.set(csPos.x, csPos.y + 3.1, csPos.z);
  csGroup.add(capTop);
  const stripe = mesh(new THREE.BoxGeometry(0.9, 6.1, 4.5), 0x8fb0e8);
  stripe.position.copy(csPos);
  csGroup.add(stripe);
  shadows(csGroup);
  group.add(tag(csGroup, 'cs'));

  const rGroup = new THREE.Group();
  const rPos = new THREE.Vector3(7, pcbTop + 1.4, pcbZ - 2.5);
  const body = mesh(new THREE.CylinderGeometry(1.4, 1.4, 5, 20), COLORS.resistencia);
  body.rotation.z = Math.PI / 2;
  body.position.copy(rPos);
  rGroup.add(body);
  for (const s of [-1, 1]) {
    const lead = mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.2, 10), COLORS.pata);
    lead.rotation.z = Math.PI / 2;
    lead.position.set(rPos.x + s * 3.5, rPos.y, rPos.z);
    rGroup.add(lead);
  }
  shadows(rGroup);
  group.add(tag(rGroup, 'resistencia'));

  const ledGroup = new THREE.Group();
  const ledPos = new THREE.Vector3(7, pcbTop + 2, pcbZ + 2.5);
  const ledMat = new THREE.MeshStandardMaterial({
    color: COLORS.led,
    metalness: 0.1,
    roughness: 0.45,
    emissive: 0xef5350,
    emissiveIntensity: 0,
    transparent: true,
    opacity: 0.92,
  });
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 4, 24), ledMat);
  lens.position.copy(ledPos);
  ledGroup.add(lens);
  const flange = mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.9, 24), COLORS.pata);
  flange.position.set(ledPos.x, ledPos.y - 1.9, ledPos.z);
  ledGroup.add(flange);
  shadows(ledGroup);
  group.add(tag(ledGroup, 'led'));

  // ------------------------------------------------ offsets de la explosión
  // Cada pieza recorre SU PROPIO ESPACIO: la mecánica se separa en vertical
  // (placa arriba, stack y resortes en su eje) y el conjunto eléctrico sale
  // ABANICADO A LOS LADOS y al fondo, nunca apilado.
  const explode: Record<PartId, THREE.Vector3> = {
    ensamble: new THREE.Vector3(0, 0, 0),
    placa: new THREE.Vector3(0, 40, 0),
    resortes: new THREE.Vector3(0, 22, 0),
    stacks: new THREE.Vector3(0, 10, 0),
    marco: new THREE.Vector3(0, 0, 0),
    pcb: new THREE.Vector3(0, 10, -20),
    puente: new THREE.Vector3(-28, 16, -6),
    cs: new THREE.Vector3(-10, 22, -16),
    resistencia: new THREE.Vector3(10, 20, -16),
    led: new THREE.Vector3(28, 16, -6),
  };

  /** Piezas eléctricas: ocultas ensambladas, aparecen sólo al desplegar. */
  const ELECTRIC: PartId[] = ['pcb', 'puente', 'cs', 'resistencia', 'led'];

  const byId: Record<string, THREE.Group> = {};
  group.children.forEach((c) => {
    const id = c.userData?.pick?.id as PartId | undefined;
    if (id) byId[id] = c as THREE.Group;
  });

  const anchorOf = (id: PartId): THREE.Vector3 => {
    switch (id) {
      case 'placa':
        return new THREE.Vector3(0, g.topRestY, 0);
      case 'resortes':
        return new THREE.Vector3(g.springOff, g.baseY + g.stackH / 2, g.springOff);
      case 'stacks':
        return new THREE.Vector3(0, g.baseY + g.stackH / 2, 0);
      case 'marco':
        return new THREE.Vector3(-g.plateSize / 2, g.plateH / 2, 0);
      case 'pcb':
        return new THREE.Vector3(0, yPcb, pcbZ);
      case 'puente':
        return bridgePos.clone().add(new THREE.Vector3(0, 2.5, 0));
      case 'cs':
        return csPos.clone().add(new THREE.Vector3(0, 3.5, 0));
      case 'resistencia':
        return rPos.clone();
      case 'led':
        return ledPos.clone().add(new THREE.Vector3(0, 2.5, 0));
      default:
        return new THREE.Vector3(0, g.baseY + g.stackH / 2, 0);
    }
  };

  // Guías del despliegue CAD: línea punteada por pieza móvil, de su posición
  // montada a la desplegada del 100 %. Aparecen al superar el 5 %.
  const guideMat = new THREE.LineDashedMaterial({
    color: 0x42576e,
    dashSize: 2,
    gapSize: 1.6,
    transparent: true,
    opacity: 0.6,
    depthTest: false,
  });
  const guidePts: THREE.Vector3[] = [];
  for (const id of Object.keys(explode) as PartId[]) {
    const off = explode[id];
    if (off.lengthSq() < 1e-6) continue;
    const a = anchorOf(id);
    guidePts.push(a, a.clone().add(off));
  }
  const guides = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(guidePts), guideMat);
  guides.computeLineDistances();
  guides.userData.nonPick = true;
  guides.renderOrder = 990;
  group.add(guides);

  const state: AssemblyState = {
    Fmax: 0,
    forceNorm: 0,
    exaggeration: 100,
    ILed: 0,
    ILedRef: 1e-3,
    explode: 0,
  };

  let explodeAmt = 0;
  /** Mapa de esfuerzo ON: la escala de datos σ sustituye al heatColor. */
  let stressMap = false;

  const apply = (s: AssemblyState) => {
    Object.assign(state, s);

    // --- animación EXACTA de `Intento2`: compresión + latido heatColor.
    //     El rebote se limita a ~11 % del alto del stack: suficiente para
    //     leer la pisada sin el efecto "gelatina" de los 35 % originales
    //     (en `Intento2` el factor era regulable; aquí se fija sobrio).
    tile.update(
      Math.max(0, Math.min(1, s.forceNorm)),
      Math.max(1, Math.min(32, s.exaggeration))
    );

    // --- mapa de esfuerzo opcional (escala de datos σ, con leyenda)
    if (stressMap) {
      const sigma = stackStress(Math.max(0, s.Fmax));
      const col = new THREE.Color(stressColorHex(sigma / 1e6));
      for (const d of tile.parts.discs) {
        const m = d.material as THREE.MeshStandardMaterial;
        m.color.copy(col);
        m.emissive.copy(col).multiplyScalar(0.4);
      }
    }

    // --- el led se ilumina en proporción a I_LED
    const frac = Math.max(0, Math.min(1, s.ILed / (s.ILedRef || 1e-12)));
    ledMat.emissiveIntensity = frac * 3.2;
    ledMat.color.setRGB(0.48 + frac * 0.5, 0.08 + frac * 0.12, 0.07 + frac * 0.1);

    // --- factor de explosión CAD: cada pieza recorre su propio espacio
    const e = Math.max(0, Math.min(1, state.explode));
    explodeAmt = e;
    for (const id of Object.keys(explode) as PartId[]) {
      const gm = byId[id];
      if (!gm) continue;
      const off = explode[id];
      gm.position.set(off.x * e, off.y * e, off.z * e);
    }
    // Conjunto eléctrico: SOLO existe a la vista cuando el usuario aumenta
    // el despliegue; ensamblado está oculto (aparece fundido desde el 3 %).
    const circuitShown = e > 0.03;
    for (const id of ELECTRIC) {
      const gm = byId[id];
      if (gm) gm.visible = circuitShown && userVisible[id] !== false;
    }
    // Los resortes ya siguen la compresión en `tile.update` (como en
    // `Intento2`); desplegados, su grupo simplemente se separa en vertical.
    guides.visible = e > 0.05;
  };

  /** Visibilidad elegida por el usuario (árbol/BOM); se respeta siempre. */
  const userVisible: Partial<Record<PartId, boolean>> = {};

  const setVisible = (id: PartId, visible: boolean) => {
    userVisible[id] = visible;
    const gm = byId[id];
    if (gm) gm.visible = visible;
  };

  const center = new THREE.Vector3(0, g.topRestY / 2 + 6, 0);
  const radius = 70;

  // --- aristas en TODAS las piezas: líneas de 1 px, umbral 25° -------------
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

  // --- hook del botón «mapa de esfuerzo» del visor
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

/** Límite de alerta de esfuerzo, en MPa, para las barras de la interfaz. */
export const SIGMA_LIMIT_MPA = ALERTS.sigmaLimit / 1e6;
