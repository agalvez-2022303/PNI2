/**
 * Modelo 3D de la baldosa piezoeléctrica de pisada.
 *
 * C9: los discos del stack se dibujan PEGADOS, sin huecos, para que la altura
 * renderizada sea exactamente T = 30 mm y no T + (n−1)·gap. Los electrodos se
 * dibujan como LÍNEAS en las Interfaces entre discos, no como láminas que
 * engordan el stack.
 *
 * C8: el color de cada disco sale del esfuerzo REAL σ = F/(4A) en el instante,
 * no de una normalización ad hoc, y el factor de exageración es fijo y lo
 * fija el solver (RENDER_EXAGGERATION).
 */
import * as THREE from 'three';
import { STACK, ALERTS } from '../core/referenceModel';
import { stackStress, stackCompression } from '../core/tile';

const MM = 1000; // metros → milímetros (unidades de escena)

export interface TileMesh {
  group: THREE.Group;
  radius: number;
  center: THREE.Vector3;
  /** f [N] real, no normalizado: el color y la compresión salen de σ. */
  update: (Fmax: number, exaggeration: number) => void;
}

function springCurve(height: number, coils: number, r: number): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  const seg = coils * 16;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * coils * Math.PI * 2;
    const y = (i / seg) * height;
    pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  return new THREE.CatmullRomCurve3(pts);
}

/** Color por esfuerzo real: azul (0) → rojo (límite de 100 MPa). */
export function stressColor(sigma: number): THREE.Color {
  const f = Math.max(0, Math.min(1, sigma / ALERTS.sigmaLimit));
  return new THREE.Color().setHSL((1 - f) * 0.6, 0.85, 0.28 + 0.22 * f);
}

export function buildTileModel(): TileMesh {
  const group = new THREE.Group();
  const D = STACK.diameter * MM;
  const t = STACK.layerThickness * MM;
  const n = STACK.nLayers;
  const plateSize = Math.max(D * 2.2, 40);
  const plateH = 4;
  // C9: sin hueco entre discos. stackH es exactamente T en milímetros.
  const stackH = n * t;
  const baseY = plateH;

  // Placa base
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x2b3442, metalness: 0.6, roughness: 0.45 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(plateSize, plateH, plateSize), baseMat);
  base.position.y = plateH / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Discos piezoeléctricos, contiguos
  const discs: THREE.Mesh[] = [];
  const discGroup = new THREE.Group();
  discGroup.position.y = baseY;
  for (let i = 0; i < n; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x39e1c6,
      metalness: 0.35,
      roughness: 0.3,
      emissive: 0x0a2b28,
      emissiveIntensity: 0.6,
    });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(D / 2, D / 2, t, 48), mat);
    disc.position.y = i * t + t / 2;
    disc.castShadow = true;
    disc.receiveShadow = true;
    discs.push(disc);
    discGroup.add(disc);
  }
  group.add(discGroup);

  // C9: electrodos como LÍNEAS (anillos) en las n+1 interfaces. No son
  // cilindros: no añaden espesor, sólo marcan dónde está el electrodo.
  const electrodeMat = new THREE.LineBasicMaterial({ color: 0xffcf6b, transparent: true, opacity: 0.95 });
  const electrodes = new THREE.Group();
  electrodes.position.y = baseY;
  for (let i = 0; i <= n; i++) {
    const ring: THREE.Vector3[] = [];
    const seg = 64;
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      ring.push(new THREE.Vector3(Math.cos(a) * (D / 2 + 0.25), i * t, Math.sin(a) * (D / 2 + 0.25)));
    }
    electrodes.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), electrodeMat));
  }
  group.add(electrodes);

  // Placa superior
  const topMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, metalness: 0.7, roughness: 0.35 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(plateSize, plateH, plateSize), topMat);
  const topRestY = baseY + stackH + plateH / 2;
  top.position.y = topRestY;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  // Resortes de retorno en las 4 esquinas
  const springs: THREE.Mesh[] = [];
  const off = plateSize / 2 - 5;
  const corners = [
    [off, off],
    [-off, off],
    [off, -off],
    [-off, -off],
  ];
  const springMat = new THREE.MeshStandardMaterial({ color: 0x8892a3, metalness: 0.85, roughness: 0.3 });
  for (const [cx, cz] of corners) {
    const curve = springCurve(stackH, Math.max(3, Math.round(stackH / 6)), 2.4);
    const geo = new THREE.TubeGeometry(curve, 200, 0.7, 8, false);
    const spring = new THREE.Mesh(geo, springMat);
    spring.position.set(cx, baseY, cz);
    spring.castShadow = true;
    springs.push(spring);
    group.add(spring);
  }

  const center = new THREE.Vector3(0, topRestY / 2, 0);
  const radius = Math.max(plateSize, topRestY);

  const update = (Fmax: number, exaggeration: number) => {
    // C8: compresión proporcional al aplastamiento REAL δ, exagerada por el
    // factor fijo del solver. δ_max = s33·σ·T.
    const sigma = stackStress(Math.max(0, Fmax));
    const delta = stackCompression(Math.max(0, Fmax), STACK.totalThickness);
    // El aplastamiento visual es un porcentaje de la altura del stack, acotado
    // para que la escena siga siendo legible.
    const compVis = Math.min(0.35, (delta * exaggeration) / STACK.totalThickness);
    discGroup.scale.y = 1 - compVis;
    top.position.y = baseY + stackH * (1 - compVis) + plateH / 2;
    for (const s of springs) s.scale.y = 1 - compVis;
    electrodes.scale.y = 1 - compVis;
    // Color por esfuerzo real en MPa.
    const col = stressColor(sigma);
    for (const d of discs) {
      const m = d.material as THREE.MeshStandardMaterial;
      m.color.copy(col);
      m.emissive.copy(col).multiplyScalar(0.35);
    }
  };

  update(0, 1);
  return { group, radius, center, update };
}

/** Factor de exageración por defecto si el solver aún no ha corrido. */
export const DEFAULT_EXAGGERATION = 5000;
