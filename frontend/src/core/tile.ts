/**
 * Física del stack piezoeléctrico de la grada (modo 33, extensión longitudinal).
 *
 * Geometría y material vienen SIEMPRE del modelo de referencia
 * (core/referenceModel.ts): este módulo no acepta materiales ni geometría como
 * parámetros. La única entrada variable es la fuerza pico F_max y la cadencia.
 *
 * Disposición (enunciado): 4 stacks por módulo, cada uno de Ø8 mm, altura total
 * T = 30 mm, 60 capas de 0.5 mm en paralelo eléctrico. La fuerza se reparte por
 * igual entre los 4 stacks: cada stack soporta F/4.
 *
 * Correcciones implementadas aquí:
 *  - C3: el módulo de Young del modo 33 es Y33 = 1/s33E (no Y11).
 *  - C7: las capas se varian a altura total constante, de modo que E resulta
 *        independiente de n (V_oc ∝ 1/n y C ∝ n², pero el producto se fija).
 *  - C8: la deformación sale del solver, no de un factor ad hoc.
 */
import { PZT5A, PZT5A_DERIVED, STACK, STACK_AREA, REFERENCE_DISC } from './referenceModel';

/** Área de un disco de diámetro dado [m²]. Solo para los discos de referencia. */
export function discArea(diameter: number): number {
  const r = diameter / 2;
  return Math.PI * r * r;
}

/** Permitividad absoluta ε33^T del PZT-5A [F/m]. */
export function absolutePermittivity(): number {
  return PZT5A_DERIVED.eps33T;
}

/**
 * Capacidad de un disco de referencia: C_p = ε33^T · A / t [F].
 * Se usa en la prueba P1 (Ø20 mm × 1 mm) y en la comparación de la C8.
 */
export function discCapacitance(diameter: number, thickness: number): number {
  return (PZT5A_DERIVED.eps33T * discArea(diameter)) / thickness;
}

/**
 * Capacidad de UN stack con n capas de espesor t en paralelo eléctrico:
 *   C_stack = n · ε33^T · A / t  [F]
 * con A = π(D/2)² del stack de referencia.
 */
export function stackCapacitance(nLayers: number): number {
  return (nLayers * PZT5A_DERIVED.eps33T * STACK_AREA) / STACK.layerThickness;
}

/** Capacidad total de los 4 stacks en paralelo: C_total = 4 · C_stack [F]. */
export function totalCapacitance(nLayers: number): number {
  return STACK.nStacks * stackCapacitance(nLayers);
}

/**
 * Carga generada por un disco en modo 33: Q = d33 · F [C].
 * Para un stack de n capas en paralelo, las cargas se suman con la misma
 * tensión, de modo que Q_total = n · d33 · F_aplicado_al_stack.
 */
export function charge(d33: number, force: number): number {
  return d33 * force;
}

/**
 * Esfuerzo en un stack: σ = F_module / (n_stacks · A) [Pa].
 * Corrección C8: la fuerza se reparte por igual entre los 4 stacks.
 */
export function stackStress(Fmax: number): number {
  return Fmax / (STACK.nStacks * STACK_AREA);
}

/**
 * Deformación uniaxial en modo 33: S = σ · s33E [-].
 * Corrección C3: se usa s33E (comprensión del modo 33), no s11E.
 */
export function axialStrain(Fmax: number): number {
  return stackStress(Fmax) * PZT5A.s33E;
}

/**
 * Aplastamiento de un stack: δ = S · T [m], con T la altura total del stack.
 * Corrección C8: la deformación es una salida del solver.
 */
export function stackCompression(Fmax: number, totalThickness: number): number {
  return axialStrain(Fmax) * totalThickness;
}

/**
 * Voltaje en circuito abierto del MÓDULO (4 stacks en paralelo, 60 capas en
 * paralelo eléctrico dentro de cada stack).
 *
 * Todas las capas comparten tensión porque están en paralelo, y cada una ve el
 * esfuerzo total del stack (F/4 repartido entre los 4 stacks):
 *   σ     = F / (4·A)                                   [Pa]
 *   V_oc  = d33 · σ · t_layer / ε33^T                  [V]
 *         = d33 · t_layer · F / (4 · ε33^T · A)
 *
 * Con t_layer = 0.5 mm y F = 700 N resulta V_oc = 43.25 V, y la energía ideal
 * ½·C_total·V_oc² = 0.3397 mJ coincide con k33²·U_el del enunciado.
 *
 * El espesor que aparece es el de UNA CAPA, no la altura total: la altura
 * T = 30 mm interviene solo en el aplastamiento δ = S·T.
 */
export function openCircuitVoltage(Fmax: number, layerThickness: number): number {
  return (PZT5A.d33 * layerThickness * Fmax) / (STACK.nStacks * PZT5A_DERIVED.eps33T * STACK_AREA);
}

/** Energía eléctrica por ciclo en circuito abierto: E = ½ · C_total · V_oc² [J]. */
export function energyPerCycle(Cp: number, Voc: number): number {
  return 0.5 * Cp * Voc * Voc;
}

/** Fuerza de pisada: F(t) = F_max · sin²(π t / Tp) para 0 ≤ t ≤ Tp [N]. */
export function stepForce(t: number, Fmax: number, Tp: number): number {
  if (t < 0 || t > Tp) return 0;
  const s = Math.sin((Math.PI * t) / Tp);
  return Fmax * s * s;
}

/** Derivada temporal de la fuerza: dF/dt = F_max · (π/Tp) · sin(2π t / Tp) [N/s]. */
export function stepForceDot(t: number, Fmax: number, Tp: number): number {
  if (t < 0 || t > Tp) return 0;
  return (Fmax * Math.PI * Math.sin((2 * Math.PI * t) / Tp)) / Tp;
}

/**
 * Energía eléctrica total entregada por el elemento en un pisada, U_el [J].
 *
 * U_el = ½ · F_max · δ_max,  con δ_max = S_max · T y S_max = σ_max · s33E.
 *
 * Es la energía elástica almacenada en el PEAK de la carga, es decir la
 * referencia de rampa monótona: el mejor caso para el harvesteo, cuando toda la
 * deformación recuperada se devuelve al circuito. Es el denominador honesto del
 * acoplamiento k33² y el que fija el enunciado (0.687 mJ a 700 N).
 *
 * El perfil temporal real F(t) = F_max·sin²(πt/Tp) NO cambia este número: sólo
 * fija la potencia instantánea y la duración. La energía efectivamente
 * recuperada sí depende del perfil y la calcula el circuito, no esta fórmula.
 */
export function elasticEnergyPerStep(Fmax: number, totalThickness: number): number {
  const S = axialStrain(Fmax);
  const delta = S * totalThickness;
  return 0.5 * Fmax * delta;
}

/**
 * Capacidad total de los 4 stacks cuando el número de capas varía MANTENIENDO
 * la altura total T = 30 mm. Cada capa pasa a tener espesor t = T/n:
 *   C_total(n) = 4 · n · ε33^T · A / (T/n) = 4·n²·ε33^T·A/T   ⇒  C ∝ n²
 */
export function totalCapacitanceAtConstantHeight(nLayers: number, totalThickness: number): number {
  const tLayer = totalThickness / nLayers;
  return (STACK.nStacks * nLayers * PZT5A_DERIVED.eps33T * STACK_AREA) / tLayer;
}

/**
 * V_oc del módulo con n capas repartidas en la altura total T:
 *   V_oc = d33 · t · F / (4 · ε33^T · A),  con t = T/n  ⇒  V_oc ∝ 1/n
 */
export function openCircuitVoltageAtConstantHeight(
  Fmax: number,
  nLayers: number,
  totalThickness: number
): number {
  const tLayer = totalThickness / nLayers;
  return (PZT5A.d33 * tLayer * Fmax) / (STACK.nStacks * PZT5A_DERIVED.eps33T * STACK_AREA);
}

/**
 * Barrido de energía frente al número de capas a ALTURA TOTAL CONSTANTE
 * (corrección C7).
 *
 * Al mantener T = 30 mm y dividirlo en n capas cada vez más finas:
 *   C(n) ∝ n²  y  V_oc(n) ∝ 1/n,  de modo que
 *   E(n) = ½·C(n)·V_oc(n)² = constante.
 *
 * Éste es el resultado que C7 exige mostrar: dividir la misma altura en más
 * capas NO produce más energía, sólo reparte la misma energía entre más
 * capacidad y menos tensión.
 */
export function energyVsLayersAtConstantHeight(
  Fmax: number,
  maxLayers = 60
): { n: number[]; E: number[]; Voc: number[]; C: number[] } {
  const n: number[] = [];
  const E: number[] = [];
  const Voc: number[] = [];
  const C: number[] = [];
  for (let k = 1; k <= maxLayers; k++) {
    const c = totalCapacitanceAtConstantHeight(k, STACK.totalThickness);
    const v = openCircuitVoltageAtConstantHeight(Fmax, k, STACK.totalThickness);
    n.push(k);
    C.push(c);
    Voc.push(v);
    E.push(energyPerCycle(c, v));
  }
  return { n, E, Voc, C };
}

/** Cota superior teórica de conversión por acoplamiento: k33² [-]. */
export function maxCouplingEfficiency(): number {
  return PZT5A_DERIVED.k33Sq;
}

/** Datos del disco de referencia de la prueba P1. */
export function referenceDisc(): { Cp: number; Q: number; Voc: number; E: number } {
  const Cp = discCapacitance(REFERENCE_DISC.diameter, REFERENCE_DISC.thickness);
  const Q = charge(PZT5A.d33, REFERENCE_DISC.force);
  const Voc = openCircuitVoltageFromDisc(REFERENCE_DISC.force, REFERENCE_DISC.diameter, REFERENCE_DISC.thickness);
  const E = energyPerCycle(Cp, Voc);
  return { Cp, Q, Voc, E };
}

/** V_oc de un disco suelto: V_oc = d33·t·F / (ε33^T·A) [V]. */
export function openCircuitVoltageFromDisc(F: number, diameter: number, thickness: number): number {
  return (PZT5A.d33 * thickness * F) / (PZT5A_DERIVED.eps33T * discArea(diameter));
}
