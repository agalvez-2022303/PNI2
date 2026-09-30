/**
 * Física de la baldosa piezoeléctrica de pisada (modo 33).
 * Modelo de stack de N discos: mecánicamente en serie, eléctricamente en paralelo.
 * Fuentes: IEEE Std 176-1987; Roundy & Wright (2004).
 */
import { PHYS } from './config';

/** Área de un disco: A = π (D/2)²  [m²]. */
export function discArea(diameter: number): number {
  const r = diameter / 2;
  return Math.PI * r * r;
}

/** Permitividad absoluta: ε33^T = ε_r · ε0  [F/m]. */
export function absolutePermittivity(epsR: number): number {
  return epsR * PHYS.EPS0;
}

/** Capacitancia del stack: C_p = n · ε33^T · A / t  [F]  (condensadores en paralelo). */
export function capacitance(n: number, epsR: number, area: number, thickness: number): number {
  return (n * absolutePermittivity(epsR) * area) / thickness;
}

/** Carga generada (modo 33): Q = n · d33 · F  [C]. */
export function charge(n: number, d33: number, F: number): number {
  return n * d33 * F;
}

/** Voltaje en circuito abierto: V_oc = Q / C_p = d33 · t · F / (ε33^T · A)  [V]. */
export function openCircuitVoltage(
  d33: number,
  thickness: number,
  epsR: number,
  area: number,
  F: number
): number {
  return (d33 * thickness * F) / (absolutePermittivity(epsR) * area);
}

/** Energía eléctrica por ciclo (circuito abierto): E = ½ · C_p · V_oc²  [J]. */
export function energyPerCycle(Cp: number, Voc: number): number {
  return 0.5 * Cp * Voc * Voc;
}

/** Fuerza de pisada: F(t) = F_max · sin²(π t / T) para 0 ≤ t ≤ T  [N]. */
export function stepForce(t: number, Fmax: number, T: number): number {
  if (t < 0 || t > T) return 0;
  const s = Math.sin((Math.PI * t) / T);
  return Fmax * s * s;
}

/** Derivada temporal de la fuerza: dF/dt = F_max · (π/T) · sin(2π t / T)  [N/s]. */
export function stepForceDot(t: number, Fmax: number, T: number): number {
  if (t < 0 || t > T) return 0;
  return Fmax * (Math.PI / T) * Math.sin((2 * Math.PI * t) / T);
}

/**
 * Energía de deformación elástica pico del stack (entrada mecánica de referencia):
 * U = ½ · F_max² · n · t / (Y · A)  [J].
 * Se usa como denominador honesto de la eficiencia.
 */
export function peakStrainEnergy(
  Fmax: number,
  n: number,
  thickness: number,
  youngs: number,
  area: number
): number {
  return (0.5 * Fmax * Fmax * n * thickness) / (youngs * area);
}

/** Cota superior teórica de conversión por acoplamiento: η_max = k33²  [-]. */
export function maxCouplingEfficiency(k33: number): number {
  return k33 * k33;
}
