/** Modelo 3D de la baldosa piezoeléctrica de pisada (placa superior, stack de discos, base, resortes). */
import * as THREE from 'three';
import { heatColor } from './viewer';

const MM = 1000; // metros → milímetros (unidades de escena)

/** Parámetros del modelo (longitudes en METROS, como las maneja el solver). */
export interface TileParams {
  diameter: number;
  thickness: number;
  nLayers: number;
  scaleFactor: number;
}

export interface TileParts {
  base: THREE.Mesh;
  discGroup: THREE.Group;
  top: THREE.Mesh;
  springs: THREE.Mesh[];
  discs: THREE.Mesh[];
}

export interface TileMesh {
  group: THREE.Group;
  radius: number;
  center: THREE.Vector3;
  /** Partes individuales, para agruparlas por pieza en el ensamble CAD. */
  parts: TileParts;
  /** Cotas geométricas en mm, para cotas/globos/ventanas de explosión. */
  dims: TILE;
  /** Devuelve la compresión visible aplicada (0..0.45). */
  update: (forceNorm: number, scaleFactor: number) => number;
}

/** Cotas de la figura, en milímetros de escena. */
export interface TILE {
  D: number;
  t: number;
  n: number;
  gap: number;
  plateSize: number;
  plateH: number;
  stackH: number;
  baseY: number;
  topRestY: number;
  springOff: number;
}

// Genera la curva helicoidal de un resorte (coils = nº de espiras, r = radio)
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

export function buildTileModel(p: TileParams): TileMesh {
  const group = new THREE.Group();
  const D = p.diameter * MM;
  const t = p.thickness * MM;
  const n = p.nLayers;
  const plateSize = Math.max(D * 2.2, 40);
  const plateH = 4;
  const gap = t * 0.15;
  const stackH = n * t + (n - 1) * gap;
  const baseY = plateH;

  // ---- Placa base ----
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x2b3442, metalness: 0.6, roughness: 0.45 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(plateSize, plateH, plateSize), baseMat);
  base.position.y = plateH / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // ---- Discos piezoeléctricos (cilindros apilados) ----
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
    disc.position.y = i * (t + gap) + t / 2;
    disc.castShadow = true;
    disc.receiveShadow = true;
    // electrodos (finas láminas doradas sobre cada disco)
    const elec = new THREE.Mesh(
      new THREE.CylinderGeometry(D / 2 + 0.15, D / 2 + 0.15, t * 0.08, 48),
      new THREE.MeshStandardMaterial({ color: 0xffcf6b, metalness: 0.9, roughness: 0.25 })
    );
    elec.position.y = t / 2;
    disc.add(elec);
    discs.push(disc);
    discGroup.add(disc);
  }
  group.add(discGroup);

  // ---- Placa superior ----
  const topMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, metalness: 0.7, roughness: 0.35 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(plateSize, plateH, plateSize), topMat);
  const topRestY = baseY + stackH + plateH / 2;
  top.position.y = topRestY;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  // ---- Resortes de retorno en las 4 esquinas (tubos sobre la hélice) ----
  const springs: THREE.Mesh[] = [];
  const off = plateSize / 2 - 5;
  const corners = [[off, off], [-off, off], [off, -off], [-off, -off]];
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

  const centerY = topRestY / 2;
  const center = new THREE.Vector3(0, centerY, 0);
  const radius = Math.max(plateSize, topRestY);

  const dims: TILE = { D, t, n, gap, plateSize, plateH, stackH, baseY, topRestY, springOff: off };

  // ---- Animación: compresión del stack + mapa de calor de esfuerzo ----
  const update = (forceNorm: number, scaleFactor: number): number => {
    const f = Math.max(0, Math.min(1, forceNorm));
    const maxComp = Math.min(0.45, (scaleFactor / 100) * 0.35);
    const comp = f * maxComp;
    discGroup.scale.y = 1 - comp;                              // el stack se comprime
    top.position.y = baseY + stackH * (1 - comp) + plateH / 2; // la placa baja
    for (const s of springs) s.scale.y = 1 - comp;             // los resortes siguen
    const col = heatColor(f);                                  // azul → rojo según esfuerzo
    for (const d of discs) {
      const m = d.material as THREE.MeshStandardMaterial;
      m.color.copy(col);
      m.emissive.copy(col).multiplyScalar(0.35);
    }
    return comp;
  };

  update(0, p.scaleFactor);
  return { group, radius, center, parts: { base, discGroup, top, springs, discs }, dims, update };
}
