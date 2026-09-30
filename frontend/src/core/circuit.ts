/**
 * Circuito de cosecha para la baldosa: fuente de corriente piezo en paralelo con C_p,
 * puente rectificador (caída de nDiodos·Vd) hacia un condensador de almacenamiento C_s
 * con resistencia de carga R_load.
 *
 * Modelo reducido de conducción (estándar en energy harvesting): durante la conducción
 * el piezo queda "fijado" a V_cs + V_umbral y la carga fluye a C_s; fuera de conducción
 * el piezo carga su propio C_p mientras C_s se descarga por R_load.
 * Estado y = [Vp, Vcs]. Fuente i_s(t) = n·d33·dF/dt.
 */
import { Deriv } from './rk4';

export interface CircuitParams {
  Cp: number;
  Cs: number;
  Rload: number;
  Vdiode: number;
  nDiodes: number;
  /** i_s(t): corriente de la fuente piezo [A]. */
  sourceCurrent: (t: number) => number;
}

export function makeCircuitDeriv(p: CircuitParams): Deriv {
  const Vth = p.nDiodes * p.Vdiode;
  return (t: number, y: number[]): number[] => {
    const Vp = y[0];
    const Vcs = y[1];
    const is = p.sourceCurrent(t);
    const threshold = Vcs + Vth;
    const conducting = Math.abs(Vp) >= threshold && Math.sign(Vp) * is > 0;
    if (conducting) {
      const dVcs = (Math.abs(is) - Vcs / p.Rload) / (p.Cs + p.Cp);
      const dVp = Math.sign(Vp) * dVcs;
      return [dVp, dVcs];
    }
    const dVp = is / p.Cp;
    const dVcs = -Vcs / (p.Rload * p.Cs);
    return [dVp, dVcs];
  };
}

/** Corriente entregada al almacenamiento en el instante dado (para trazas). */
export function rectifierCurrent(p: CircuitParams, t: number, Vp: number, Vcs: number): number {
  const Vth = p.nDiodes * p.Vdiode;
  const is = p.sourceCurrent(t);
  const conducting = Math.abs(Vp) >= Vcs + Vth && Math.sign(Vp) * is > 0;
  if (!conducting) return 0;
  const dVcs = (Math.abs(is) - Vcs / p.Rload) / (p.Cs + p.Cp);
  return Math.max(0, Math.abs(is) - p.Cp * Math.abs(dVcs));
}
