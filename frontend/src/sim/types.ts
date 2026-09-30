/** Tipos de entradas y resultados de las simulaciones (todo en unidades SI). */

/**
 * Únicas entradas del usuario. Ya no se pasan materiales ni geometría: ambos
 * salen del modelo de referencia (core/referenceModel.ts).
 */
export interface TileInputs {
  /** Fuerza pico del pisada F_max [N]. */
  Fmax: number;
  /** Cadencia de pisado [pasos/min]. */
  cadence: number;
}

export interface BeamInputs {
  /** Aceleración de base a0 [m/s²]. */
  a0: number;
  /** Frecuencia de excitación [Hz]. */
  fExc: number;
}

/** Trama temporal devuelta por una simulación. */
export interface Series {
  t: number[];
  F: number[];
  Vp: number[];
  Vcs: number[];
  I: number[];
  P: number[];
  Estored: number[];
}

/** Alerta de seguridad activa (C8). */
export interface SafetyAlert {
  code: 'sigma' | 'voltage';
  message: string;
  value: number;
  limit: number;
  unit: string;
}

export interface TileResult {
  /** Capacidad total de los 4 stacks [F]. */
  Cp: number;
  /** Capacidad de un stack [F]. */
  CpStack: number;
  /** Carga generada en el pico [C]. */
  Q: number;
  /** Voltaje en circuito abierto en el pico [V]. */
  Voc: number;
  /** Energía ideal por pisada ½·C·V_oc² [J]. */
  energyIdeal: number;
  /** Energía eléctrica total del elemento por pisada (U_el) [J]. */
  U_el: number;
  /** Energía cosechada por pisada en régimen estacionario [J]. */
  E_harvested: number;
  /** Energía entregada al LED por pisada [J]. */
  E_LED: number;
  /** Cadena de energía de un pisada en régimen estacionario (verificación C11). */
  chain: import('../core/energy').EnergyChain;
  /** Esfuerzo por stack en el pico [Pa]. */
  stress: number;
  /** Deformación uniaxial en el pico (S) [-]. */
  strain: number;
  /** Aplastamiento del stack en el pico [m]. */
  compression: number;
  /** k2_ef = E_ideal/U_el, acoplamiento del elemento [-]. */
  k2Elemento: number;
  /** η_cerámica = E_cosechada/U_el [-]. */
  etaCeramic: number;
  /** η_módulo = E_cosechada/∫(F dδ) [-]. */
  etaModulo: number;
  /** Contexto (no eficiencia): E_cosechada/(F·5 mm) [-]. */
  contexto5mm: number;
  /**
   * Tensión del condensador en régimen estacionario [V]. Es el PICO del
   * rizado: al final de cada pisada Cs se descarga hasta justo Vf (donde
   * I_LED = 0), así que el valor al final del paso siempre vale 1.8 V.
   */
  VcSteady: number;
  /** Rizado de Vc dentro del pisada estacionario [V]: mínimo, máximo y media. */
  VcRipple: { min: number; max: number; avg: number };
  /** Corriente pico del LED en régimen estacionario [A]. */
  ILedPeak: number;
  /** Número de pasos necesarios para alcanzar el régimen estacionario. */
  stepsToSteady: number;
  /** Variación relativa de la energía por paso entre los dos últimos pasos. */
  steadyRelVariation: number;
  /** Potencia media entregada al LED [W]. */
  avgPowerLED: number;
  /** Barrido de energía frente a nº de capas a altura constante (C7). */
  energyVsLayers: { n: number[]; E: number[]; Voc: number[]; C: number[] };
  /** Factor de exageración del render (fijo y visible, C8). */
  renderExaggeration: number;
  /** Alertas de seguridad activas (C8). */
  alerts: SafetyAlert[];
  series: Series;
}

export interface BeamResult {
  neutralAxis: number;
  EI: number;
  mLinear: number;
  totalThickness: number;
  modes: { freq: number; omega: number; lambda: number }[];
  keq: number;
  meq: number;
  fnSDOF: number;
  /** Masa modal efectiva del modo 1, γ₁², calculada desde la forma modal [kg]. */
  modalMass1: number;
  Cp: number;
  Ropt: number;
  /** Potencia del modelo a R_opt y resonancia [W]. */
  pModel: number;
  /** Cota de Williams & Yates con ζ mecánico fijo [W]. */
  pBound: number;
  /** Razón modelo/cota [-]. */
  pRatio: number;
  peakFreq: number;
  frf: { f: number[]; P: number[]; V: number[] };
  pVsR: { R: number[]; P: number[] };
  /** FRF frente a integración temporal en resonancia (P9). */
  frfVsTime: { pFrf: number; pTime: number; relDiff: number };
  timeSeries: { t: number[]; v: number[]; P: number[]; tip: number[] };
  modeShapes: { x: number[]; y: number[] }[];
}

export type SolverRequest =
  | { id: number; kind: 'tile'; inputs: TileInputs }
  | { id: number; kind: 'beam'; inputs: BeamInputs };

export type SolverResponse =
  | { id: number; kind: 'tile'; result: TileResult }
  | { id: number; kind: 'beam'; result: BeamResult };
