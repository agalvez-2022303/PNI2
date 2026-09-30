/** Modelo 3D de la viga bimorfa en voladizo (sustrato central, piezo arriba/abajo, electrodos, masa de punta). */
import * as THREE from 'three';
import { BeamParams, BeamResult } from '../sim/types';

const MM = 1000;

export interface BeamMesh {
  group: THREE.Group;
  radius: number;
  center: THREE.Vector3;
  setShape: (shape: { x: number[]; y: number[] }) => void;
  update: (amp: number, phase: number, scaleFactor: number) => void;
}

interface Layer {
  mesh: THREE.Mesh;
  base: Float32Array;
  yOffset: number;
}

function makeLayer(L: number, thickness: number, width: number, yOffset: number, mat: THREE.Material): Layer {
  const seg = 80;
  const geo = new THREE.BoxGeometry(L, thickness, width, seg, 1, 1);
  geo.translate(L / 2, yOffset, 0); // origen en el empotramiento
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const base = new Float32Array(pos.array.length);
  base.set(pos.array as Float32Array);
  return { mesh, base, yOffset };
}

export function buildBeamModel3D(p: BeamParams, result: BeamResult): BeamMesh {
  const group = new THREE.Group();
  const L = p.length * MM;
  const b = p.width * MM;
  const tS = p.tSub * MM;
  const tP = p.tPiezo * MM;

  const subMat = new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 0.85, roughness: 0.35 });
  const piezoMat = () =>
    new THREE.MeshStandardMaterial({ color: 0x39e1c6, metalness: 0.3, roughness: 0.35, emissive: 0x0a2b28, emissiveIntensity: 0.5 });
  const elecMat = new THREE.MeshStandardMaterial({ color: 0xffcf6b, metalness: 0.95, roughness: 0.2 });

  const layers: Layer[] = [];
  layers.push(makeLayer(L, tS, b, 0, subMat));
  layers.push(makeLayer(L, tP, b, tS / 2 + tP / 2, piezoMat()));
  layers.push(makeLayer(L, tP, b, -(tS / 2 + tP / 2), piezoMat()));
  layers.push(makeLayer(L, tP * 0.12, b * 1.01, tS / 2 + tP + tP * 0.06, elecMat));
  layers.push(makeLayer(L, tP * 0.12, b * 1.01, -(tS / 2 + tP + tP * 0.06), elecMat));
  for (const l of layers) group.add(l.mesh);

  // Empotramiento
  const clampMat = new THREE.MeshStandardMaterial({ color: 0x1c2430, metalness: 0.7, roughness: 0.5 });
  const clampW = Math.max(tS + 2 * tP + 8, 12);
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(8, clampW * 1.6, b * 1.6), clampMat);
  clamp.position.set(-4, 0, 0);
  clamp.castShadow = true;
  clamp.receiveShadow = true;
  group.add(clamp);

  // Masa de punta
  const tipSize = Math.max(6, Math.cbrt(Math.max(p.tipMass, 1e-4) / 8000) * MM);
  const tipMat = new THREE.MeshStandardMaterial({ color: 0xff6b6b, metalness: 0.6, roughness: 0.4 });
  const tip = new THREE.Mesh(new THREE.BoxGeometry(tipSize, tipSize, Math.min(b, tipSize * 1.5)), tipMat);
  tip.castShadow = true;
  group.add(tip);

  group.position.y = 40;

  let shapeX: number[] = result.modeShapes[0]?.x ?? [0, 1];
  let shapeY: number[] = result.modeShapes[0]?.y ?? [0, 0];

  const sampleShape = (xNorm: number): number => {
    const x = Math.max(0, Math.min(1, xNorm));
    const idx = x * (shapeX.length - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(shapeX.length - 1, i0 + 1);
    const f = idx - i0;
    return shapeY[i0] * (1 - f) + shapeY[i1] * f;
  };

  const center = new THREE.Vector3(L / 2, 40, 0);
  const radius = Math.max(L, 60);

  const setShape = (shape: { x: number[]; y: number[] }) => {
    shapeX = shape.x;
    shapeY = shape.y;
  };

  const update = (amp: number, phase: number, scaleFactor: number) => {
    const tipDisp = (L * 0.16) * (scaleFactor / 1500);
    const a = amp * tipDisp * Math.sin(phase);
    for (const l of layers) {
      const pos = l.mesh.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = l.base[i];
        const dy = sampleShape(x / L) * a;
        arr[i + 1] = l.base[i + 1] + dy;
      }
      pos.needsUpdate = true;
      l.mesh.geometry.computeVertexNormals();
    }
    const tipY = sampleShape(1) * a;
    tip.position.set(L + tipSize / 2, tipY, 0);
  };

  update(0, 0, p.scaleFactor);
  return { group, radius, center, setShape, update };
}
