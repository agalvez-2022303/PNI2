/**
 * MODELO DE REFERENCIA — constantes físicas congeladas.
 *
 * Este archivo es la ÚNICA fuente de verdad del modelo. Las simulaciones
 * (sim/*.ts) leen de aquí; ya no se pasan materiales ni geometría como
 * parámetros editables. Cualquier valor marcado [SUPUESTO] no procede de una
 * fuente publicada ni del enunciado: es una decisión de modelado explícita.
 *
 * Unidades SI en todo el archivo salvo indicación contraria en el comentario.
 *
 * Fuentes:
 *  - IEEE Std 176-1987, "IEEE Standard on Piezoelectricity".
 *  - APC / PI Technical Note: PZT-5A material properties.
 *  - Williams & Yates (1996), J. Sound & Vibration 176(4): "Analysis of a
 *    piezoelectric cantilever beam for energy harvesting".
 *  - Erturk & Inman (2011), "Piezoelectric Energy Harvesting", Wiley.
 */

/* ------------------------------------------------------------------ */
/* Constantes universales                                              */
/* ------------------------------------------------------------------ */

/** Permitividad del vacío ε0 [F/m]. Valor fijo por definición del SI. */
export const EPS0 = 8.854e-12;

/** Aceleración de la gravedad estándar g [m/s²]. */
export const G = 9.80665;

/* ------------------------------------------------------------------ */
/* Cerámico piezoeléctrico: PZT-5A                                    */
/* ------------------------------------------------------------------ */

/**
 * PZT-5A. Valores de catálogo (APC/PI; coherentes con IEEE Std 176-1987).
 * d33, d31 [C/N]; s33E, s11E [m²/N]; eps33T/eps0 [-]; densidad [kg/m³].
 */
export const PZT5A = Object.freeze({
  /** Coeficiente de carga longitudinal (modo 33) d33 = 374e-12 [C/N]. */
  d33: 374e-12,
  /** Coeficiente de carga transversal (modo 31) d31 = -171e-12 [C/N]. */
  d31: -171e-12,
  /** Complianza elástica a campo eléctrico constante, modo 33 s33^E = 18.8e-12 [m²/N]. */
  s33E: 18.8e-12,
  /** Complianza elástica a campo eléctrico constante, modo 31 s11^E = 16.4e-12 [m²/N]. */
  s11E: 16.4e-12,
  /** Permitividad relativa a esfuerzo constante ε33^T/ε0 = 1700 [-]. */
  eps33TOverEps0: 1700,
  /** Densidad ρ = 7750 [kg/m³]. */
  density: 7750,
} as const);

/**
 * Constantes derivadas del PZT-5A.
 *
 * Módulo de Young: el modo 33 usa Y33 = 1/s33E (campo en la dirección de la
 * polarización) y el modo 31 usa Y11 = 1/s11E (campo transversal). Ver
 * corrección C3: usar el módulo correcto en cada modo.
 */
export const PZT5A_DERIVED = Object.freeze({
  /** Módulo de Young longitudinal Y33 = 1/s33E = 53.19e9 [Pa] (enunciado: 53.2 GPa). */
  Y33: 1 / PZT5A.s33E,
  /** Módulo de Young transversal Y11 = 1/s11E = 60.98e9 [Pa] (enunciado: 61.0 GPa). */
  Y11: 1 / PZT5A.s11E,
  /** Permitividad absoluta a esfuerzo constante ε33^T = 1700·ε0 = 1.50518e-8 [F/m]. */
  eps33T: PZT5A.eps33TOverEps0 * EPS0,
  /**
   * Factor de acoplamiento electromecánico del modo 33:
   *   k33² = d33² / (s33E · ε33^T) = 0.4943 [-]
   * CALCULADO, no tabulado. Corrección C6: k31 se deriva igual, nunca se
   * estima como fracción de k33.
   */
  k33Sq: (PZT5A.d33 * PZT5A.d33) / (PZT5A.s33E * PZT5A.eps33TOverEps0 * EPS0),
  /**
   * Factor de acoplamiento electromecánico del modo 31:
   *   k31² = d31² / (s11E · ε33^T) = 0.11846 [-]
   * CALCULADO, no tabulado.
   */
  k31Sq: (PZT5A.d31 * PZT5A.d31) / (PZT5A.s11E * PZT5A.eps33TOverEps0 * EPS0),
  /** k33 = √k33² = 0.7031 [-], para mostrar en la interfaz. */
  k33: Math.sqrt(
    (PZT5A.d33 * PZT5A.d33) / (PZT5A.s33E * PZT5A.eps33TOverEps0 * EPS0)
  ),
  /** k31 = √k31² = 0.3442 [-], para mostrar en la interfaz. */
  k31: Math.sqrt((PZT5A.d31 * PZT5A.d31) / (PZT5A.s11E * PZT5A.eps33TOverEps0 * EPS0)),
  /** ε33^T/ε0 = 1700 [-], recordatorio para la interfaz. */
  eps33TRel: PZT5A.eps33TOverEps0,
  /**
   * ε33^S/ε0 = 1504.4 [-] (modo 31). Derivado: ε^S = ε^T (1 − k31²).
   */
  eps33SRel:
    PZT5A.eps33TOverEps0 *
    (1 - (PZT5A.d31 * PZT5A.d31) / (PZT5A.s11E * PZT5A.eps33TOverEps0 * EPS0)),
});

/**
 * Permitividad absoluta a esfuerzo constante para el modo 31:
 *   ε33^S = ε33^T · (1 - k31²) = 1.32686e-8 [F/m]
 * Corrección C5: la capacidad de la viga se calcula con ε^S, no con ε^T.
 */
export const EPS33_S = PZT5A_DERIVED.eps33T * (1 - PZT5A_DERIVED.k31Sq);

/* ------------------------------------------------------------------ */
/* Sustrato estructural                                                */
/* ------------------------------------------------------------------ */

export const BRASS = Object.freeze({
  /** Módulo de Young del latón E = 100e9 [Pa]. */
  Y: 100e9,
  /** Densidad del latón ρ = 8500 [kg/m³]. */
  density: 8500,
} as const);

/* ------------------------------------------------------------------ */
/* Stack piezoeléctrico de la grada (modo 33)                          */
/* ------------------------------------------------------------------ */

export const STACK = Object.freeze({
  /** Número de stacks por módulo de grada [-]. La fuerza se reparte F/4 por stack. */
  nStacks: 4,
  /** Diámetro de cada disco Ø8 mm [m]. */
  diameter: 8e-3,
  /** Espesor de cada capa 0.5 mm [m]. */
  layerThickness: 0.5e-3,
  /** Número de capas por stack [-], en paralelo eléctrico. */
  nLayers: 60,
  /** Altura total del stack T = 60 × 0.5 mm = 30 mm [m]. */
  totalThickness: 30e-3,
  /** Ø8 mm, en milímetros, para la interfaz. */
  diameterMm: 8,
  /** 0.5 mm, en milímetros, para la interfaz. */
  layerThicknessMm: 0.5,
  /** 30 mm, en milímetros, para la interfaz. */
  totalThicknessMm: 30,
} as const);

/** Área de la sección circular de un disco Ø8 mm: A = π(D/2)² = 50.27 mm² [m²]. */
export const STACK_AREA = Object.freeze(Math.PI * Math.pow(STACK.diameter / 2, 2));

/**
 * Discos de referencia del caso de verificación P1 (Ø20 mm × 1 mm).
 * NO forma parte del modelo de la grada: existe solo para las pruebas.
 */
export const REFERENCE_DISC = Object.freeze({
  /** Diámetro Ø20 mm [m]. */
  diameter: 20e-3,
  /** Espesor 1 mm [m]. */
  thickness: 1e-3,
  /** Fuerza de la prueba P1 [N]. */
  force: 100,
} as const);

/* ------------------------------------------------------------------ */
/* Circuito de cosecha (5 materiales: piezo + puente + Cs + R + LED)   */
/* ------------------------------------------------------------------ */

export const CIRCUIT = Object.freeze({
  /**
   * Tipo de diodo del puente. La caída se modela como constante porque a
   * ~1.8 V (corriente del orden de 0.1 mA) el 1N4007 está en su meseta
   * aproximada de 0.6 V.
   */
  diodeModel: '1N4007',
  /** Caída constante por diodo en conducción Vd = 0.6 [V]. */
  Vdiode: 0.6,
  /**
   * Diodos en conducción durante el rectifiedado: 2 (puente de 4 diodos,
   * dos en serie en cada semiciclo). La tension de umbral del puente es
   * por tanto 2·Vd = 1.2 V.
   */
  nDiodes: 2,
  /** Condensador de almacenamiento Cs = 10 [µF]. */
  Cs: 10e-6,
  /** Resistencia de carga R = 470 [Ω]. */
  Rload: 470,
  /** Umbral de conducción del LED Vf = 1.8 [V]. */
  Vf: 1.8,
} as const);

/* ------------------------------------------------------------------ */
/* Excitación: pisada                                                  */
/* ------------------------------------------------------------------ */

export const PULSE = Object.freeze({
  /** Duración del pisada Tp = 0.3 [s]. F(t) = F_max·sin²(π t / Tp). */
  Tp: 0.3,
} as const);

/* ------------------------------------------------------------------ */
/* Viga bimorfa en voladizo (modo 31)                                  */
/* ------------------------------------------------------------------ */

export const BEAM = Object.freeze({
  /** Longitud L = 60 mm [m]. */
  length: 60e-3,
  /** Anchura b = 20 mm [m]. */
  width: 20e-3,
  /** Espesor del sustrato de latón t_s = 0.5 mm [m]. */
  tSub: 0.5e-3,
  /** Espesor de cada capa piezoeléctrica t_p = 0.25 mm [m] (una arriba y otra abajo). */
  tPiezo: 0.25e-3,
  /** Masa de punta M_t = 5 g [kg]. */
  tipMass: 5e-3,
  /**
   * Razón de amortiguamiento mecánico ζ_mec = 0.02 [-].
   * [SUPUESTO] No procede de una fuente publicada: es un valor de
   * modelado asumido por el enunciado y así queda marcado.
   */
  zetaMec: 0.02,
  /** Resistencia de carga de la viga R_load = 68 [kΩ]. */
  Rload: 68e3,
} as const);

/* ------------------------------------------------------------------ */
/* Entradas permitidas al usuario (únicos parámetros editables)        */
/* ------------------------------------------------------------------ */

export const INPUTS = Object.freeze({
  /** Fuerza pico del pisada F_max [N]. */
  Fmax: Object.freeze({ min: 300, max: 1000, step: 10, def: 700, unit: 'N' }),
  /** Cadencia de pisado [pasos/min]. */
  cadence: Object.freeze({ min: 60, max: 120, step: 1, def: 100, unit: 'pasos/min' }),
  /** Aceleración de base a0 [m/s²] (solo viga). */
  a0: Object.freeze({ min: 0.5, max: 5, step: 0.1, def: 2, unit: 'm/s²' }),
  /** Frecuencia de excitación [Hz] (solo viga). */
  fExc: Object.freeze({ min: 40, max: 110, step: 1, def: 75, unit: 'Hz' }),
} as const);

/* ------------------------------------------------------------------ */
/* Umbrales de alerta (C8)                                             */
/* ------------------------------------------------------------------ */

export const ALERTS = Object.freeze({
  /**
   * Límite conservador de esfuerzo en el cerámico [Pa]. Por encima se avisa:
   * depende del mecanismo de grieta y de la calidad del sinterizado, que no
   * se modelan aquí. [SUPUESTO] Criterio conservador, no un límite de catálogo.
   */
  sigmaLimit: 100e6,
  /**
   * Tensión nominal de los diodos del puente y del condensador [V].
   * El 1N4007 tiene VRRM = 1000 V, pero el encapsulado del Cs y la tensión
   * de trabajo especificada limitan la referencia a 100 V.
   */
  voltageLimit: 100,
} as const);

/* ------------------------------------------------------------------ */
/* Cadena energética (C1, C11)                                        */
/* ------------------------------------------------------------------ */

/** Definición de los eslabones de la cadena de energía, del mayor al menor. */
export const ENERGY_CHAIN = Object.freeze([
  'U_el', // energía eléctrica total entregada por el piezo
  'E_ideal', // ½·C_total·V_oc², con k33² = E_ideal/U_el
  'E_extracted', // energía realmente transferida al circuito
  'E_stored', // energía almacenada en Cs
  'E_LED', // energía consumida por el LED
] as const);

export type EnergyLink = (typeof ENERGY_CHAIN)[number];

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

/**
 * Comprobación de integridad del modelo. Se ejecuta al cargar el módulo para
 * que una constante editada a mano de forma incoherente falle de inmediato.
 */
export function assertReferenceModelConsistency(): void {
  const problems: string[] = [];
  if (Math.abs(PZT5A_DERIVED.Y33 - 53.2e9) / 53.2e9 > 0.01) {
    problems.push(`Y33 = ${PZT5A_DERIVED.Y33} Pa, se esperaba ~53.2 GPa`);
  }
  if (Math.abs(PZT5A_DERIVED.Y11 - 61.0e9) / 61e9 > 0.01) {
    problems.push(`Y11 = ${PZT5A_DERIVED.Y11} Pa, se esperaba ~61.0 GPa`);
  }
  if (Math.abs(PZT5A_DERIVED.k33Sq - 0.494) / 0.494 > 0.01) {
    problems.push(`k33² = ${PZT5A_DERIVED.k33Sq}, se esperaba 0.494`);
  }
  if (Math.abs(PZT5A_DERIVED.k31Sq - 0.1185) / 0.1185 > 0.01) {
    problems.push(`k31² = ${PZT5A_DERIVED.k31Sq}, se esperaba 0.1185`);
  }
  if (STACK.nLayers * STACK.layerThickness !== STACK.totalThickness) {
    problems.push('nLayers·layerThickness ≠ totalThickness en STACK');
  }
  if (problems.length > 0) {
    throw new Error('referenceModel inconsistente:\n  - ' + problems.join('\n  - '));
  }
}

assertReferenceModelConsistency();
