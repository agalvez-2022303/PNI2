/**
 * Lista de materiales (BOM) del módulo de grada y árbol del ensamble.
 *
 * Es la fuente de verdad de las piezas: el visor 3D, el árbol lateral, la tabla
 * del BOM y el esquema eléctrico se identifican con el MISMO `id`, de modo que
 * la selección es bidireccional entre las tres vistas.
 */

export type PartId =
  | 'ensamble'
  | 'placa'
  | 'resortes'
  | 'stacks'
  | 'marco'
  | 'pcb'
  | 'puente'
  | 'cs'
  | 'resistencia'
  | 'led';

export interface BomRow {
  /** Identificador compartido con el visor 3D y el esquema. */
  id: PartId;
  /** Número de globo, como aparece en la interfaz. */
  balloon: number;
  /** Descripción de la pieza. */
  desc: string;
  /** Especificación de fabrication / modelo. */
  spec: string;
  /** Cantidad en el ensamble. */
  qty: number;
  /** Unidad de la cantidad. */
  unit: string;
  /** Grupo del árbol. */
  group: 'mecanico' | 'electrico';
}

/** Filas de la BOM, en el orden de numeración de los globos. */
export const BOM: readonly BomRow[] = Object.freeze([
  {
    id: 'placa',
    balloon: 1,
    desc: 'placa de pisada',
    spec: 'acero inoxidable AISI 304, 3 mm',
    qty: 1,
    unit: 'ud',
    group: 'mecanico',
  },
  {
    id: 'resortes',
    balloon: 2,
    desc: 'resortes de retorno',
    spec: 'acero al carbono, carga 250 N, altura libre 30 mm',
    qty: 4,
    unit: 'ud',
    group: 'mecanico',
  },
  {
    id: 'stacks',
    balloon: 3,
    desc: 'stack piezoeléctrico',
    spec: 'PZT-5A, Ø8 × 0.5 mm, 60 capas, T = 30 mm',
    qty: 4,
    unit: 'ud',
    group: 'mecanico',
  },
  {
    id: 'marco',
    balloon: 4,
    desc: 'marco base sellado',
    spec: 'policarbonato, IP65, 96 × 96 × 40 mm',
    qty: 1,
    unit: 'ud',
    group: 'mecanico',
  },
  {
    id: 'pcb',
    balloon: 5,
    desc: 'placa de circuito',
    spec: 'FR-4, 1.6 mm, 2 capas',
    qty: 1,
    unit: 'ud',
    group: 'electrico',
  },
  {
    id: 'puente',
    balloon: 6,
    desc: 'puente rectificador',
    spec: '4 × 1N4007, VRRM 1000 V, IF 1 A',
    qty: 1,
    unit: 'conj',
    group: 'electrico',
  },
  {
    id: 'cs',
    balloon: 7,
    desc: 'condensador de almacenamiento',
    spec: '10 µF, 100 V, electrolítico radial',
    qty: 1,
    unit: 'ud',
    group: 'electrico',
  },
  {
    id: 'resistencia',
    balloon: 8,
    desc: 'resistencia de carga',
    spec: '470 Ω, 1/4 W, 1 %',
    qty: 1,
    unit: 'ud',
    group: 'electrico',
  },
  {
    id: 'led',
    balloon: 9,
    desc: 'led indicador',
    spec: 'rojo 5 mm, Vf 1.8 V, If 20 mA',
    qty: 1,
    unit: 'ud',
    group: 'electrico',
  },
]);

/** Fila del BOM a la que pertenece un id. */
export function bomOf(id: PartId): BomRow | undefined {
  return BOM.find((b) => b.id === id);
}

/** Piezas del grupo mecánico, para el árbol. */
export const MECH_PARTS = BOM.filter((b) => b.group === 'mecanico');
/** Piezas del grupo eléctrico, para el árbol. */
export const ELEC_PARTS = BOM.filter((b) => b.group === 'electrico');

/** Identificadores de todas las piezas, en orden de globo. */
export const PART_IDS: readonly PartId[] = BOM.map((b) => b.id);

/** Groupings del árbol lateral. */
export const TREE_GROUPS = [
  { id: 'mecanico', label: 'conjunto mecánico' },
  { id: 'electrico', label: 'conjunto eléctrico' },
] as const;
