/** Tipos de parámetros y resultados de las simulaciones (todo en unidades SI). */

export interface TileParams {
  piezoId: string;
  diameter: number; // m
  thickness: number; // m
  nLayers: number;
  Fmax: number; // N
  T: number; // s (periodo de pisada)
  Cs: number; // F
  Rload: number; // Ω
  Vdiode: number; // V
  nDiodes: number;
  scaleFactor: number; // visual
  walkMode: boolean;
  walkFreq: number; // Hz
  walkSteps: number;
}

export interface Series {
  t: number[];
  F: number[];
  Vp: number[];
  Vcs: number[];
  I: number[];
  P: number[];
  Estored: number[];
}

export interface TileResult {
  Cp: number;
  Q: number;
  Voc: number;
  energyPerCycle: number;
  peakStrainEnergy: number;
  stress: number; // Pa por disco
  etaTheoretical: number;
  etaRealistic: number;
  maxCoupling: number;
  energyToLoad: number;
  energyStoredFinal: number;
  energyHarvested: number;
  avgPower: number;
  series: Series;
  energyVsLayers: { n: number[]; E: number[] };
}

export interface BeamParams {
  piezoId: string;
  substrateId: string;
  length: number; // m
  width: number; // m
  tSub: number; // m
  tPiezo: number; // m (cada capa)
  tipMass: number; // kg
  a0: number; // m/s²
  zetaT: number; // amortiguamiento total
  lossFactor: number; // factor de pérdidas realista (0-1)
  Rload: number; // Ω
  freqMin: number; // Hz
  freqMax: number; // Hz
  scaleFactor: number;
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
  Cp: number;
  Ropt: number;
  pMaxWilliamsYates: number;
  pRealistic: number;
  pModelPeak: number;
  peakFreq: number;
  frf: { f: number[]; P: number[]; V: number[] };
  pVsR: { R: number[]; P: number[] };
  pVsMass: { m: number[]; P: number[] };
  timeSeries: { t: number[]; v: number[]; P: number[]; tip: number[] };
  modeShapes: { x: number[]; y: number[] }[];
}

export type SolverRequest =
  | { id: number; kind: 'tile'; params: TileParams; piezo: import('../core/materials').Material }
  | {
      id: number;
      kind: 'beam';
      params: BeamParams;
      piezo: import('../core/materials').Material;
      substrate: import('../core/materials').Material;
    };

export type SolverResponse =
  | { id: number; kind: 'tile'; result: TileResult }
  | { id: number; kind: 'beam'; result: BeamResult };
