/** Importación (STL/glTF como carcasa decorativa) y exportación (STL) de geometría. */
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

/** Carga un STL o glTF/GLB desde un File y devuelve un Object3D semitransparente (carcasa). */
export async function importShell(file: File): Promise<THREE.Object3D> {
  const ext = file.name.toLowerCase().split('.').pop() || '';
  const buffer = await file.arrayBuffer();
  if (ext === 'stl') {
    const geo = new STLLoader().parse(buffer);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x5b6b7f,
      metalness: 0.4,
      roughness: 0.6,
      transparent: true,
      opacity: 0.35,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'carcasa-importada';
    return mesh;
  }
  if (ext === 'gltf' || ext === 'glb') {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.parse(
        buffer,
        '',
        (gltf) => {
          gltf.scene.traverse((o: any) => {
            if (o.isMesh && o.material) {
              o.material.transparent = true;
              o.material.opacity = 0.4;
            }
          });
          gltf.scene.name = 'carcasa-importada';
          resolve(gltf.scene);
        },
        (err) => reject(err)
      );
    });
  }
  throw new Error('Formato no soportado (usa STL, glTF o GLB)');
}

/** Exporta un Object3D a STL (ASCII) y dispara la descarga. */
export function exportSTL(object: THREE.Object3D, filename: string) {
  const exporter = new STLExporter();
  const stl = exporter.parse(object);
  const blob = new Blob([stl], { type: 'model/stl' });
  triggerDownload(blob, filename);
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
