/**
 * Base de datos de materiales (editable en la UI).
 * Piezoeléctricos con propiedades del modo 33/31 y sustratos estructurales.
 * Fuentes: hojas de datos APC/PI y Erturk & Inman (2011).
 */
export type MaterialKind = 'piezo' | 'substrate';

export interface Material {
  id: string;
  name: string;
  kind: MaterialKind;
  /** Coeficiente de carga d33 [C/N] (modo longitudinal). */
  d33: number;
  /** Coeficiente de carga d31 [C/N] (modo transversal). */
  d31: number;
  /** Permitividad relativa ε_r = ε33^T / ε0 [-]. */
  epsR: number;
  /** Factor de acoplamiento electromecánico k33 [-]. */
  k33: number;
  /** Módulo de Young Y [Pa]. */
  youngs: number;
  /** Densidad ρ [kg/m³]. */
  density: number;
  /** Coeficiente de Poisson ν [-]. */
  poisson: number;
  /** Razón de amortiguamiento modal ζ [-]. */
  damping: number;
}

export const DEFAULT_MATERIALS: Material[] = [
  { id: 'pzt5a', name: 'PZT-5A', kind: 'piezo', d33: 374e-12, d31: -171e-12, epsR: 1700, k33: 0.71, youngs: 61e9, density: 7750, poisson: 0.31, damping: 0.02 },
  { id: 'pzt5h', name: 'PZT-5H', kind: 'piezo', d33: 593e-12, d31: -274e-12, epsR: 3400, k33: 0.75, youngs: 50e9, density: 7500, poisson: 0.31, damping: 0.02 },
  { id: 'pzt4', name: 'PZT-4', kind: 'piezo', d33: 289e-12, d31: -123e-12, epsR: 1300, k33: 0.70, youngs: 81e9, density: 7500, poisson: 0.30, damping: 0.015 },
  { id: 'pvdf', name: 'PVDF', kind: 'piezo', d33: -33e-12, d31: 23e-12, epsR: 12, k33: 0.15, youngs: 3e9, density: 1780, poisson: 0.34, damping: 0.05 },
  { id: 'laton', name: 'Latón', kind: 'substrate', d33: 0, d31: 0, epsR: 0, k33: 0, youngs: 100e9, density: 8500, poisson: 0.34, damping: 0.01 },
  { id: 'acero', name: 'Acero', kind: 'substrate', d33: 0, d31: 0, epsR: 0, k33: 0, youngs: 200e9, density: 7850, poisson: 0.30, damping: 0.008 },
  { id: 'kapton', name: 'Kapton', kind: 'substrate', d33: 0, d31: 0, epsR: 0, k33: 0, youngs: 2.5e9, density: 1420, poisson: 0.34, damping: 0.02 },
];

export function findMaterial(list: Material[], id: string): Material {
  const m = list.find((x) => x.id === id);
  if (!m) return list[0];
  return m;
}
