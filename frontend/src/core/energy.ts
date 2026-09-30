/**
 * Cadena de energía y verificación de conservación (C1, C11).
 *
 * La cadena de un pisada, del mayor al menor, es:
 *   U_el  →  E_ideal  →  E_extracted  →  E_stored  →  E_LED
 *
 * Invariante exigido (C11): cada eslabón debe ser menor o igual que el anterior
 * y E_cosechada ≤ U_el. Si se viola, se lanza un error visible en lugar de
 * devolver un número sin sentido.
 */
import { EnergyLink } from './referenceModel';

export interface EnergyChain {
  /** Energía eléctrica total entregada por el piezo en el pisada [J]. */
  U_el: number;
  /** Energía ideal en circuito abierto: ½·C_total·V_oc² [J]. */
  E_ideal: number;
  /** Energía realmente transferida al circuito (suma sobre el régimen estacionario) [J]. */
  E_extracted: number;
  /** Energía almacenada en el condensador al final de la corrida [J]. */
  E_stored: number;
  /** Energía consumida por el LED [J]. */
  E_LED: number;
}

export const CHAIN_ORDER: readonly EnergyLink[] = [
  'U_el',
  'E_ideal',
  'E_extracted',
  'E_stored',
  'E_LED',
] as const;

/** Tolerancia relativa admitida al comparar eslabones consecutivos. */
export const CHAIN_TOLERANCE = 1e-6;

export class ConservationError extends Error {
  readonly chain: EnergyChain;
  readonly violatedLink: string;
  constructor(message: string, chain: EnergyChain, violatedLink: string) {
    super(message);
    this.name = 'ConservationError';
    this.chain = chain;
    this.violatedLink = violatedLink;
  }
}

/**
 * Verifica la monótonía de la cadena de energía (C11).
 * Lanza `ConservationError` con un mensaje visible si algún eslabón excede al
 * anterior o si la energía cosechada supera U_el.
 */
export function assertEnergyConservation(chain: EnergyChain, tol: number = CHAIN_TOLERANCE): void {
  for (let i = 1; i < CHAIN_ORDER.length; i++) {
    const prev = chain[CHAIN_ORDER[i - 1]];
    const cur = chain[CHAIN_ORDER[i]];
    // Sólo es físicamente exigible que E_stored ≤ E_extracted y E_LED ≤ E_stored.
    // U_el ≥ E_ideal es la definición del acoplamiento; E_ideal ≥ E_extracted
    // es lo que el circuito puede Violar si el LED devuelve energía, y se
    // comprueba igualmente porque el modelo no debe generarla.
    if (cur > prev * (1 + tol) + 1e-18) {
      throw new ConservationError(
        `viola conservación: ${CHAIN_ORDER[i]} = ${cur.toExponential(6)} J supera a ` +
          `${CHAIN_ORDER[i - 1]} = ${prev.toExponential(6)} J`,
        chain,
        CHAIN_ORDER[i]
      );
    }
  }
}

/**
 * Definiciones de eficiencia (C1).
 *
 * Se renombra la antigua "eficiencia teórica" a `k2Elemento` porque lo que
 * calculaba era el factor de acoplamiento del elemento, k2_ef = E_ideal/U_el
 * (= k33² = 0.494), NO una eficiencia del proceso.
 */
export interface Efficiencies {
  /** k2_ef = E_ideal / U_el: acoplamiento del ELEMENTO. Debe dar 0.494. */
  k2Elemento: number;
  /** η_cerámica = E_cosechada / U_el: fracción eléctrica realmente cosechada. */
  etaCeramic: number;
  /** η_módulo = E_cosechada / ∫(F·dδ_módulo): eficiencia del módulo completo. */
  etaModulo: number;
  /**
   * E_cosechada / (F·δ) con δ = 5 mm, que es lo que mostraba antes la
   * aplicación. NO es una eficiencia: se conserva solo como contexto y
   * aparece etiquetado como tal en la interfaz.
   */
  contexto5mm: number;
}

/**
 * Calcula las eficiencias con sus denominadores correctos (C1).
 *
 * @param E_cosechada energía cosechada por pisada en régimen estacionario [J]
 * @param E_ideal     energía ideal en circuito abierto por pisada ½·C·V_oc² [J]
 * @param U_el        energía eléctrica total del elemento por pisada [J]
 * @param dDelta      desplazamiento del módulo bajo el perfil de fuerza [m]
 * @param Fmax        fuerza pico [N]
 */
export function computeEfficiencies(
  E_cosechada: number,
  E_ideal: number,
  U_el: number,
  dDelta: number,
  Fmax: number
): Efficiencies {
  // ∫ F dδ del módulo: δ es proporcional a F, así que para el perfil sin² la
  // energía mecánica es U_mec = S_max·F_max·Tp·3/8 (ver tile.elasticEnergyPerStep).
  // Aquí se usa la relación directa F·δ para que el denominador sea el
  // desplazamiento real medido por el solver.
  const E_mecanica = Fmax * dDelta;
  return {
    k2Elemento: E_ideal / U_el,
    etaCeramic: E_cosechada / U_el,
    etaModulo: E_cosechada / E_mecanica,
    contexto5mm: E_cosechada / (Fmax * 5e-3),
  };
}
