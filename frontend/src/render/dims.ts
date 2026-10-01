/**
 * Globos numerados y cotas del ensamble.
 *
 *  · Los globos 1..9 se clavan en la pieza correspondiente y siguen a la vista
 *    desplegada, con su línea guía.
 *  · Las cotas se expresan siempre en mm: diámetro de disco, altura de stack,
 *    separación entre centros y alto del marco.
 *
 * Se deconstruyen al regenerar el modelo para no filtrar geometrías.
 */
import * as THREE from 'three';
import { balloonSprite, leaderLine, textSprite } from './labels';
import { makeDimension } from './viewer';
import { TILE_GEOM, STACK_HEIGHT_MM, DISC_DIAMETER_MM } from './assembly';
import { PartId } from '../bom/bom';

/** Piezas con globo: id, número de pieza y posición del ancla. */
export const BALLOON_PARTS: { id: PartId; n: number }[] = [
  { id: 'placa', n: 1 },
  { id: 'resortes', n: 2 },
  { id: 'stacks', n: 3 },
  { id: 'marco', n: 4 },
  { id: 'pcb', n: 5 },
  { id: 'puente', n: 6 },
  { id: 'cs', n: 7 },
  { id: 'resistencia', n: 8 },
  { id: 'led', n: 9 },
];

/** Radius de la esfera de distribución de los globos, en mm. */
const R = 46;

export interface BalloonLayer {
  group: THREE.Group;
  /** Recoloca globo y línea guía; `pos` es la posición de la pieza. */
  update: (pos: (id: PartId) => THREE.Vector3) => void;
  dispose: () => void;
}

/** Construye la capa de globos sobre el ensamble. */
export function buildBalloons(anchorOf: (id: PartId) => THREE.Vector3): BalloonLayer {
  const group = new THREE.Group();
  group.userData.dim = true; // se oculta con las cotas

  type Entry = { n: number; spr: THREE.Sprite; line: THREE.Line; dir: THREE.Vector3 };
  const entries: Entry[] = [];

  // Dirección de reparto: en espiral, para que las guías no se solapen.
  const dirs: THREE.Vector3[] = [
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(1, 0.35, 0.6),
    new THREE.Vector3(-1, 0.35, 0.6),
    new THREE.Vector3(1, 0.35, -0.6),
    new THREE.Vector3(-1, 0.35, -0.6),
    new THREE.Vector3(0.2, 0.5, 1),
    new THREE.Vector3(-0.2, 0.5, -1),
    new THREE.Vector3(1, 0.8, 0.2),
    new THREE.Vector3(-1, 0.8, -0.2),
  ];

  BALLOON_PARTS.forEach((b, i) => {
    const spr = balloonSprite(b.n);
    const line = leaderLine(new THREE.Vector3(), new THREE.Vector3());
    group.add(spr, line);
    entries.push({ n: b.n, spr, line, dir: dirs[i % dirs.length].clone().normalize() });
  });

  const update = (pos: (id: PartId) => THREE.Vector3) => {
    const tmp = new THREE.Vector3();
    entries.forEach((e, i) => {
      const b = BALLOON_PARTS[i];
      const base = pos(b.id);
      const target = tmp.copy(base).add(e.dir.clone().multiplyScalar(R)).clone();
      e.spr.position.copy(target);
      e.line.geometry.setFromPoints([base, target]);
      // El material punteado necesita recalcular las distancias de línea en
      // cada recolocación; si no, el guion deja de verse.
      e.line.computeLineDistances();
    });
  };

  const dispose = () => {
    group.traverse((o: any) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m: any) => m.dispose && m.dispose());
      }
    });
  };

  return { group, update, dispose };
}

/** Cotas lineales de la figura `Intento2`, en mm. */
export function buildDimensions(): THREE.Group {
  const g = new THREE.Group();
  g.userData.dim = true;
  const G = TILE_GEOM;
  const half = G.plateSize / 2 + 14;

  // Diámetro del disco, a media altura del stack, al frente.
  const yMid = G.baseY + G.stackH / 2;
  g.add(
    makeDimension(
      new THREE.Vector3(-G.D / 2, yMid, G.plateSize / 2 + 6),
      new THREE.Vector3(G.D / 2, yMid, G.plateSize / 2 + 6),
      `ø ${DISC_DIAMETER_MM} mm`
    )
  );

  // Altura visual del stack (60 discos de 0.5 mm + electrodos): 34.4 mm.
  const xStack = -G.D / 2 - 7;
  g.add(
    makeDimension(
      new THREE.Vector3(xStack, G.baseY, 0),
      new THREE.Vector3(xStack, G.baseY + G.stackH, 0),
      `${G.stackH.toFixed(1)} mm`
    )
  );

  // Ancho de la placa (plateSize = max(2.2·ø, 40)).
  g.add(
    makeDimension(
      new THREE.Vector3(-G.plateSize / 2, G.plateH / 2, -half),
      new THREE.Vector3(G.plateSize / 2, G.plateH / 2, -half),
      `${G.plateSize} mm`
    )
  );

  // Alto de la placa base.
  const xb = G.plateSize / 2 + 7;
  g.add(
    makeDimension(
      new THREE.Vector3(xb, 0, G.plateSize / 2),
      new THREE.Vector3(xb, G.plateH, G.plateSize / 2),
      `${G.plateH} mm`
    )
  );

  // Diámetro exterior del resorte helicoidal (2·(2.4 + 0.7)).
  const ySpr = G.baseY + G.stackH + 5;
  const rOut = 2.4 + 0.7;
  g.add(
    makeDimension(
      new THREE.Vector3(G.springOff - rOut, ySpr, G.springOff),
      new THREE.Vector3(G.springOff + rOut, ySpr, G.springOff),
      `ø ${(2 * rOut).toFixed(1)} mm`
    )
  );

  return g;
}

/** Etiqueta flotante de la cota principal del stack (60 × 0.5 mm). */
export function stackDetailLabel(n: number, t: number): THREE.Sprite {
  const spr = textSprite(`${n} × ${t} mm = ${(n * t).toFixed(1)} mm`, {
    color: '#1f2d3d',
    size: 32,
    bg: true,
    bgColor: '#f8fafc',
    border: '#9fb3c8',
  });
  spr.position.set(0, 62, 0);
  spr.userData.dim = true;
  spr.renderOrder = 1002;
  return spr;
}
