/** Orquestación de la Simulación 1: baldosa piezoeléctrica de pisada (modo 33). */
import { Material } from '../core/materials';
import {
  discArea,
  capacitance,
  charge,
  openCircuitVoltage,
  energyPerCycle,
  stepForce,
  stepForceDot,
  peakStrainEnergy,
  absolutePermittivity,
} from '../core/tile';
import { makeCircuitDeriv, CircuitParams } from '../core/circuit';
import { integrateAdaptive } from '../core/rk4';
import { TileParams, TileResult, Series } from './types';
import { RANGES } from './defaults';

function trapz(x: number[], y: number[]): number {
  let s = 0;
  for (let i = 1; i < x.length; i++) s += 0.5 * (y[i] + y[i - 1]) * (x[i] - x[i - 1]);
  return s;
}

export function runTile(p: TileParams, piezo: Material): TileResult {
  const A = discArea(p.diameter);
  const n = p.nLayers;
  const Cp = capacitance(n, piezo.epsR, A, p.thickness);
  // Q y V_oc de referencia se calculan a fuerza pico F_max.
  const Q = charge(n, piezo.d33, p.Fmax);
  const Voc = openCircuitVoltage(piezo.d33, p.thickness, piezo.epsR, A, p.Fmax);
  const ePerCycle = energyPerCycle(Cp, Voc);
  const uMech = peakStrainEnergy(p.Fmax, n, p.thickness, piezo.youngs, A);
  const stress = p.Fmax / A;

  const freq = p.walkMode ? p.walkFreq : 1 / p.T;
  const nSteps = p.walkMode ? p.walkSteps : 1;
  const spacing = 1 / freq;
  const tEnd = p.walkMode ? (nSteps - 1) * spacing + p.T : p.T;

  const sourceCurrent = (t: number): number => {
    let dF = 0;
    for (let k = 0; k < nSteps; k++) {
      dF += stepForceDot(t - k * spacing, p.Fmax, p.T);
    }
    return n * piezo.d33 * dF;
  };
  const forceAt = (t: number): number => {
    let F = 0;
    for (let k = 0; k < nSteps; k++) F += stepForce(t - k * spacing, p.Fmax, p.T);
    return F;
  };

  const circuit: CircuitParams = {
    Cp,
    Cs: p.Cs,
    Rload: p.Rload,
    Vdiode: p.Vdiode,
    nDiodes: p.nDiodes,
    sourceCurrent,
  };
  const deriv = makeCircuitDeriv(circuit);
  const samples = integrateAdaptive(deriv, [0, 0], 0, tEnd, {
    sampleEvery: tEnd / 600,
    relTol: 1e-4,
  });

  const series: Series = { t: [], F: [], Vp: [], Vcs: [], I: [], P: [], Estored: [] };
  for (const s of samples) {
    const Vp = s.y[0];
    const Vcs = s.y[1];
    const I = Vcs / p.Rload;
    const P = (Vcs * Vcs) / p.Rload;
    series.t.push(s.t);
    series.F.push(forceAt(s.t));
    series.Vp.push(Vp);
    series.Vcs.push(Vcs);
    series.I.push(I);
    series.P.push(P);
    series.Estored.push(0.5 * p.Cs * Vcs * Vcs);
  }

  const energyToLoad = trapz(series.t, series.P);
  const energyStoredFinal = series.Estored[series.Estored.length - 1] ?? 0;
  const energyHarvested = energyToLoad + energyStoredFinal;
  const avgPower = energyHarvested / tEnd;

  const uMechTotal = uMech * nSteps;
  const etaTheoretical = (ePerCycle * nSteps) / uMechTotal;
  const etaRealistic = energyHarvested / uMechTotal;

  const maxN = RANGES.tile.nLayers.max;
  const nArr: number[] = [];
  const eArr: number[] = [];
  for (let k = 1; k <= maxN; k++) {
    const CpK = capacitance(k, piezo.epsR, A, p.thickness);
    nArr.push(k);
    eArr.push(energyPerCycle(CpK, Voc));
  }

  return {
    Cp,
    Q,
    Voc,
    energyPerCycle: ePerCycle,
    peakStrainEnergy: uMech,
    stress,
    etaTheoretical,
    etaRealistic,
    maxCoupling: (piezo.d33 * piezo.d33 * piezo.youngs) / absolutePermittivity(piezo.epsR),
    energyToLoad,
    energyStoredFinal,
    energyHarvested,
    avgPower,
    series,
    energyVsLayers: { n: nArr, E: eArr },
  };
}
