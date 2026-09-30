/**
 * Circuito de cosecha del stack piezoeléctrico (5 materiales: piezo, puente
 * rectificador de 4 diodos, condensador Cs, resistencia R y LED).
 *
 * Correcciones implementadas:
 *  - C11: la conducción del puente se evalúa en AMBAS polaridades; el umbral es
 *         |Vp| ≥ Vc + 2·Vd y la condición de signo es sign(Vp)·i > 0.
 *         La fuente de corriente es i(t) = 60·d33·dF/dt, con los 4 stacks en
 *         paralelo y F la fuerza total del módulo.
 *  - C2: la integración encadena pasos hasta régimen estacionario; el primer
 *         paso con Cs vacío no se reporta como resultado principal.
 *
 * Estado integrado y = [Vp, Vc].
 */
import { Deriv } from './rk4';
import { CIRCUIT, PZT5A, STACK } from './referenceModel';

export interface CircuitParams {
  /** Capacidad del piezo (4 stacks en paralelo) Cp [F]. */
  Cp: number;
  /** Condensador de almacenamiento Cs [F]. */
  Cs: number;
  /** Resistencia de carga R [Ω]. */
  Rload: number;
  /** Caída por diodo en conducción Vd [V]. */
  Vdiode: number;
  /** Diodos en serie durante la conducción (2 en un puente de 4) [-]. */
  nDiodes: number;
  /** Umbral de conducción del LED Vf [V]. */
  Vf: number;
  /** i_s(t): corriente de la fuente piezo [A]. */
  sourceCurrent: (t: number) => number;
}

/** Umbral de tensión del puente: 2·Vd = 1.2 V [V]. */
export function bridgeThreshold(nDiodes: number = CIRCUIT.nDiodes, Vdiode: number = CIRCUIT.Vdiode): number {
  return nDiodes * Vdiode;
}

/** Corriente que circula por el LED: I_LED = (Vc - Vf)/R si Vc > Vf, si no 0 [A]. */
export function ledCurrent(Vc: number, Rload: number = CIRCUIT.Rload, Vf: number = CIRCUIT.Vf): number {
  return Vc > Vf ? (Vc - Vf) / Rload : 0;
}

/**
 * Derivada del estado del circuito (C11).
 *
 * Conduce si |Vp| ≥ Vc + 2·Vd y sign(Vp)·i > 0 (ambas polaridades):
 *   dVc/dt = (|i| - I_LED) / (Cs + Cp),   Vp sigue a Vc (dVp = dVc con el signo de Vp).
 * Si no conduce:
 *   dVp/dt = i / Cp,   dVc/dt = -I_LED / Cs.
 */
export function makeCircuitDeriv(p: CircuitParams): Deriv {
  const Vth = bridgeThreshold(p.nDiodes, p.Vdiode);
  return (t: number, y: number[]): number[] => {
    const Vp = y[0];
    const Vc = y[1];
    const i = p.sourceCurrent(t);
    const ILed = ledCurrent(Vc, p.Rload, p.Vf);
    const sVp = Math.sign(Vp);
    const conducting = Math.abs(Vp) >= Vc + Vth && sVp * i > 0;
    if (conducting) {
      const dVc = (Math.abs(i) - ILed) / (p.Cs + p.Cp);
      return [sVp * dVc, dVc];
    }
    const dVp = i / p.Cp;
    const dVc = -ILed / p.Cs;
    return [dVp, dVc];
  };
}

/**
 * Corriente que entra al almacenamiento en el instante dado [A].
 * Positiva sólo cuando el puente conduce.
 */
export function rectifierCurrent(p: CircuitParams, t: number, Vp: number, Vc: number): number {
  const Vth = bridgeThreshold(p.nDiodes, p.Vdiode);
  const i = p.sourceCurrent(t);
  const sVp = Math.sign(Vp);
  if (!(Math.abs(Vp) >= Vc + Vth && sVp * i > 0)) return 0;
  const dVc = (Math.abs(i) - ledCurrent(Vc, p.Rload, p.Vf)) / (p.Cs + p.Cp);
  return Math.max(0, Math.abs(i) - p.Cp * Math.abs(dVc));
}

/**
 * Fuente de corriente del stack completo, C11:
 *   i(t) = 60 · d33 · dF/dt   [A]
 * con 60 = número de capas en paralelo eléctrico y F la fuerza TOTAL del
 * módulo (los 4 stacks en paralelo suma n_capas·d33·dF/dt cada uno).
 */
export function stackSourceCurrent(dFdt: number, nLayers: number = STACK.nLayers): number {
  return nLayers * PZT5A.d33 * dFdt;
}
