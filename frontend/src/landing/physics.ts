/**
 * Cifras de la landing calculadas con las mismas funciones del simulador.
 *
 * Todo sale de `core/tile.ts` y `core/referenceModel.ts`: la landing no
 * guarda ninguna constante física propia.
 */
import { G, INPUTS, PULSE, STACK } from '../core/referenceModel';
import {
  energyPerCycle,
  openCircuitVoltage,
  stackCompression,
  stackStress,
  stepForce,
  totalCapacitance,
} from '../core/tile';

/** Factor dinámico de talón que usa el banco de trabajo para pasar de N a kg. */
const K_DYN = 1.3;

export interface OpenCircuitFigures {
  /** Voltaje en circuito abierto del módulo [V]. */
  voc: number;
  /** Energía ideal por pisada, ½·C_total·V_oc² [J]. */
  energy: number;
  /** Esfuerzo axial en cada stack [Pa]. */
  stress: number;
  /** Aplastamiento de un stack [m]. */
  compression: number;
  /** Masa de persona equivalente con k_din = 1,3 [kg]. */
  massKg: number;
}

const C_TOTAL = totalCapacitance(STACK.nLayers);

export function openCircuitFigures(Fmax: number): OpenCircuitFigures {
  const voc = openCircuitVoltage(Fmax, STACK.layerThickness);
  return {
    voc,
    energy: energyPerCycle(C_TOTAL, voc),
    stress: stackStress(Fmax),
    compression: stackCompression(Fmax, STACK.totalThickness),
    massKg: Fmax / (G * K_DYN),
  };
}

/** Muestras de F(t) = F_max·sin²(πt/T_p) sobre una ventana de 1,5·T_p. */
export function forceSamples(Fmax: number, n: number): number[] {
  const span = PULSE.Tp * 1.5;
  const t0 = -PULSE.Tp * 0.25;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = t0 + (span * i) / (n - 1);
    out.push(stepForce(t, Fmax, PULSE.Tp));
  }
  return out;
}

export const FMAX = INPUTS.Fmax;
export const CADENCE = INPUTS.cadence;
export const TP = PULSE.Tp;
export const TOTAL_CAPACITANCE = C_TOTAL;

const nf = (digits: number) =>
  // es-ES: coma decimal, igual que las cifras escritas a mano en la landing.
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function fmt(value: number, digits = 2): string {
  return nf(digits).format(value);
}
