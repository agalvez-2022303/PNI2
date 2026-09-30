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
import { FRAME, STACK_HEIGHT_MM, DISC_DIAMETER_MM } from './assembly';
import { PartId } from '../bom/bom';
import { T } from '../ui/cad/theme';

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
const R = 62;

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
    const spr = balloonSprite(b.n, T.accent);
    const line = leaderLine(new THREE.Vector3(), new THREE.Vector3(), T.accent);
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

/** Cotas lineales del ensamble, en mm. */
export function buildDimensions(): THREE.Group {
  const g = new THREE.Group();
  g.userData.dim = true;
  const half = FRAME.outer / 2 + 16;

  // Diámetro de un disco, en planta y a la altura de un stack.
  g.add(
    makeDimension(
      new THREE.Vector3(0, 2, 0),
      new THREE.Vector3(DISC_DIAMETER_MM, 2, 0),
      `ø ${DISC_DIAMETER_MM} mm`
    )
  );

  // Altura del stack: 60 × 0.5 mm = 30 mm exactos.
  const x = FRAME.stackPitch / 2;
  g.add(
    makeDimension(
      new THREE.Vector3(x, 4, 0),
      new THREE.Vector3(x, 4 + STACK_HEIGHT_MM, 0),
      `${STACK_HEIGHT_MM} mm`
    )
  );

  // Separación entre centros de stacks vecinos.
  const p = FRAME.stackPitch;
  g.add(
    makeDimension(
      new THREE.Vector3(-p / 2, 0.5, p / 2),
      new THREE.Vector3(p / 2, 0.5, p / 2),
      `${p} mm`
    )
  );

  // Alto exterior del marco.
  g.add(
    makeDimension(
      new THREE.Vector3(-half, 0, 0),
      new THREE.Vector3(-half, FRAME.height, 0),
      `${FRAME.height} mm`
    )
  );

  // Ancho exterior del marco.
  g.add(
    makeDimension(
      new THREE.Vector3(-FRAME.outer / 2, 0.5, -half),
      new THREE.Vector3(FRAME.outer / 2, 0.5, -half),
      `${FRAME.outer} mm`
    )
  );

  return g;
}

/** Etiqueta flotante de la cota principal del stack (60 × 0.5 mm). */
export function stackDetailLabel(n: number, t: number): THREE.Sprite {
  const spr = textSprite(`${n} × ${t} mm = ${(n * t).toFixed(1)} mm`, {
    color: T.text,
    size: 32,
    bg: true,
    bgColor: T.surface,
    border: T.line,
  });
  spr.position.set(0, 62, 0);
  spr.userData.dim = true;
  spr.renderOrder = 1002;
  return spr;
}
