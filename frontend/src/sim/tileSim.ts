/** Orquestación de la Simulación 1: stack piezoeléctrico de grada (modo 33). */
import {
  stackCapacitance,
  totalCapacitance,
  openCircuitVoltage,
  energyPerCycle,
  stepForce,
  stepForceDot,
  elasticEnergyPerStep,
  stackStress,
  axialStrain,
  stackCompression,
  energyVsLayersAtConstantHeight,
} from '../core/tile';
import { makeCircuitDeriv, ledCurrent, stackSourceCurrent, CircuitParams } from '../core/circuit';
import { assertEnergyConservation, computeEfficiencies, EnergyChain } from '../core/energy';
import { ALERTS, CIRCUIT, PULSE, PZT5A, STACK } from '../core/referenceModel';
import { TileInputs, TileResult, Series, SafetyAlert } from './types';

/** Variación máxima de la energía por paso para considerar régimen estacionario. */
export const STEADY_REL_TOL = 0.01;

/** Factor de exageración del render, fijo y visible (C8). */
export const RENDER_EXAGGERATION = 5000;

function trapz(x: number[], y: number[]): number {
  let s = 0;
  for (let i = 1; i < x.length; i++) s += 0.5 * (y[i] + y[i - 1]) * (x[i] - x[i - 1]);
  return s;
}

/** Perfil de fuerza del pisado en el instante t, repetido cada `period` segundos. */
export function forceAt(t: number, Fmax: number, period: number): number {
  const k = Math.floor(t / period);
  return stepForce(t - k * period, Fmax, PULSE.Tp);
}

/** dF/dt del pisado en el instante t, repetido cada `period` segundos. */
export function dForceAt(t: number, Fmax: number, period: number): number {
  const k = Math.floor(t / period);
  return stepForceDot(t - k * period, Fmax, PULSE.Tp);
}

function circuitFor(Fmax: number, period: number, Cs = CIRCUIT.Cs): CircuitParams {
  return {
    Cp: totalCapacitance(STACK.nLayers),
    Cs,
    Rload: CIRCUIT.Rload,
    Vdiode: CIRCUIT.Vdiode,
    nDiodes: CIRCUIT.nDiodes,
    Vf: CIRCUIT.Vf,
    sourceCurrent: (t: number) => stackSourceCurrent(dForceAt(t, Fmax, period)),
  };
}

/** Un paso RK4 de tamaño fijo sobre el estado [Vp, Vc]. */
function rk4StepCircuit(
  d: (t: number, y: number[]) => number[],
  t: number,
  y: [number, number],
  h: number
): [number, number] {
  const k1 = d(t, y);
  const k2 = d(t + h / 2, [y[0] + (h / 2) * k1[0], y[1] + (h / 2) * k1[1]]);
  const k3 = d(t + h / 2, [y[0] + (h / 2) * k2[0], y[1] + (h / 2) * k2[1]]);
  const k4 = d(t + h, [y[0] + h * k3[0], y[1] + h * k3[1]]);
  return [
    y[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    y[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
  ];
}

/**
 * Corrida del stack en régimen estacionario (C2).
 *
 * Encadena pisados integrando el estado del circuito [Vp, Vc] hasta que la
 * energía por paso varía menos del 1 % entre los dos últimos. El primer paso,
 * con Cs descargado, es transitorio y no se reporta como resultado.
 */
export function runTile(p: TileInputs): TileResult {
  const Fmax = p.Fmax;
  const period = 60 / p.cadence; // segundos entre pisadas
  const CpStack = stackCapacitance(STACK.nLayers);
  const Cp = totalCapacitance(STACK.nLayers);
  const Voc = openCircuitVoltage(Fmax, STACK.layerThickness);
  const energyIdeal = energyPerCycle(Cp, Voc);
  const U_el = elasticEnergyPerStep(Fmax, STACK.totalThickness);

  const params = circuitFor(Fmax, period);
  const deriv = makeCircuitDeriv(params);

  const subSteps = 200;
  const dt = period / subSteps;
  const maxSteps = 2000;

  let Vp = 0;
  let Vc = 0;
  let t = 0;
  let eLastStep = Number.NaN;
  let ePrevStep = Number.NaN;
  let stepsToSteady = 0;
  let steadyRelVariation = Number.POSITIVE_INFINITY;
  let E_LED = 0;
  let E_R = 0;
  let E_bridgeLoss = 0;
  let E_stored = 0;
  let ILedPeak = 0;
  let E_LED_step = 0;
  let E_R_step = 0;
  let E_bridgeLoss_step = 0;
  let VcPeak = 0;
  let VcMin = 0;
  let VcAvg = 0;

  for (let step = 1; step <= maxSteps; step++) {
    let eLedStep = 0;
    let eRStep = 0;
    let eBridgeLossStep = 0;
    let iLedStep = 0;
    let vcPeakStep = 0;
    let vcSumStep = 0;
    let vcMinStep = Number.POSITIVE_INFINITY;
    for (let k = 0; k < subSteps; k++) {
      const tk = t + k * dt;
      const ILedBefore = ledCurrent(Vc, CIRCUIT.Rload, CIRCUIT.Vf);
      const iSrc = stackSourceCurrent(dForceAt(tk, Fmax, period));
      const VpBefore = Vp;
      const [vp, vc] = rk4StepCircuit(deriv, tk, [Vp, Vc], dt);
      Vp = vp;
      Vc = vc;
      const ILedAfter = ledCurrent(Vc, CIRCUIT.Rload, CIRCUIT.Vf);
      // P_LED = Vf·I_LED y P_R = I_LED²·R, integradas por punto medio.
      eLedStep += 0.5 * (ILedBefore + ILedAfter) * CIRCUIT.Vf * dt;
      const iMid = 0.5 * (ILedBefore + ILedAfter);
      eRStep += iMid * iMid * CIRCUIT.Rload * dt;
      iLedStep = Math.max(iLedStep, ILedAfter);
      // Pérdida en el puente: durante la conducción circula |i| y los 2 diodos
      // en serie disipan 2·Vd por culata. Es el término que separa
      // E_extracted de E_stored en la cadena de conservación (C11).
      const conducting =
        Math.abs(VpBefore) >= Vc + 2 * CIRCUIT.Vdiode && Math.sign(VpBefore) * iSrc > 0;
      if (conducting) {
        eBridgeLossStep += Math.abs(iSrc) * 2 * CIRCUIT.Vdiode * dt;
      }
      vcPeakStep = Math.max(vcPeakStep, vc);
      vcMinStep = Math.min(vcMinStep, vc);
      vcSumStep += vc;
    }
    t += period;
    E_LED += eLedStep;
    E_R += eRStep;
    E_bridgeLoss += eBridgeLossStep;
    ILedPeak = Math.max(ILedPeak, iLedStep);

    const eStep = eLedStep + eRStep;
    ePrevStep = eLastStep;
    eLastStep = eStep;
    stepsToSteady = step;
    // C2: los resultados se reportan sobre el ÚLTIMO pisada completo, que ya
    // es estacionario. Promediar sobre todos los pasos (incluido el transitorio
    // con Cs descargado) mezclaría dos regímenes distintos.
    E_LED_step = eLedStep;
    E_R_step = eRStep;
    E_bridgeLoss_step = eBridgeLossStep;
    VcPeak = vcPeakStep;
    VcMin = vcMinStep;
    VcAvg = vcSumStep / subSteps;
    if (step > 1) {
      const denom = Math.abs(eStep) > 0 ? Math.abs(eStep) : 1;
      steadyRelVariation = Math.abs(eStep - ePrevStep) / denom;
      if (steadyRelVariation < STEADY_REL_TOL) break;
    }
  }

  // Energía que sale del terminal del piezo: la que llega al nodo de
  // almacenamiento más la que se pierde en los dos diodos del puente.
  const E_harvested = E_LED_step + E_R_step;
  // Vc de régimen estacionario: se reporta el PICO del rizado, no el valor al
  // final del pisada. Al final de cada pisada Cs se ha descargado hasta justo
  // Vf (donde I_LED = 0), así que el valor final es siempre 1.8 V y no
  // caracterizaría el punto de operación.
  const VcSteady = VcPeak;

  // Trama de un pisada en el estado estacionario, para la interfaz.
  const series: Series = { t: [], F: [], Vp: [], Vcs: [], I: [], P: [], Estored: [] };
  {
    let VpT = Vp;
    let VcT = Vc;
    const n = 300;
    const h = period / n;
    for (let k = 0; k <= n; k++) {
      const tk = k * h;
      const IL = ledCurrent(VcT, CIRCUIT.Rload, CIRCUIT.Vf);
      series.t.push(tk);
      series.F.push(forceAt(tk, Fmax, period));
      series.Vp.push(VpT);
      series.Vcs.push(VcT);
      series.I.push(IL);
      series.P.push(IL * CIRCUIT.Vf);
      series.Estored.push(0.5 * CIRCUIT.Cs * VcT * VcT);
      if (k < n) [VpT, VcT] = rk4StepCircuit(deriv, tk, [VpT, VcT], h);
    }
  }

  const stress = stackStress(Fmax);
  const strain = axialStrain(Fmax);
  const compression = stackCompression(Fmax, STACK.totalThickness);
  const eff = computeEfficiencies(E_harvested, energyIdeal, U_el, compression, Fmax);

  // C11: cadena de energía de UN pisada en régimen estacionario:
  //   U_el  ≥  E_ideal  ≥  E_extraída  ≥  E_almacenada  ≥  E_LED
  // E_extracted: energía que sale del terminal del piezo hacia el puente.
  // E_stored: la parte de esa energía que llega al nodo Cs + R + LED.
  // E_LED: la parte de E_stored que se consume en el diodo LED. El contenido
  // instantáneo del condensador (½·Cs·Vc²) NO interviene: es un estado, no un
  // flujo, y por eso no puede compararse con energías por pisada.
  const E_storedStep = E_LED_step + E_R_step;
  const E_extractedStep = E_storedStep + E_bridgeLoss_step;
  const chain: EnergyChain = {
    U_el,
    E_ideal: energyIdeal,
    E_extracted: E_extractedStep,
    E_stored: E_storedStep,
    E_LED: E_LED_step,
  };
  assertEnergyConservation(chain);

  const alerts: SafetyAlert[] = [];
  if (stress > ALERTS.sigmaLimit) {
    alerts.push({
      code: 'sigma',
      message: `Esfuerzo ${(stress / 1e6).toFixed(1)} MPa por encima del límite conservador de 100 MPa: riesgo de grieta en el cerámico.`,
      value: stress,
      limit: ALERTS.sigmaLimit,
      unit: 'Pa',
    });
  }
  if (Voc > ALERTS.voltageLimit) {
    alerts.push({
      code: 'voltage',
      message: `V_oc ${Voc.toFixed(1)} V supera la tensión nominal de 100 V de los diodos del puente y del condensador.`,
      value: Voc,
      limit: ALERTS.voltageLimit,
      unit: 'V',
    });
  }

  return {
    Cp,
    CpStack,
    Q: STACK.nLayers * PZT5A.d33 * Fmax,
    Voc,
    energyIdeal,
    U_el,
    E_harvested,
    E_LED: E_LED_step,
    chain,
    stress,
    strain,
    compression,
    k2Elemento: eff.k2Elemento,
    etaCeramic: eff.etaCeramic,
    etaModulo: eff.etaModulo,
    contexto5mm: eff.contexto5mm,
    VcSteady,
    VcRipple: { min: VcMin, max: VcPeak, avg: VcAvg },
    ILedPeak,
    stepsToSteady,
    steadyRelVariation,
    avgPowerLED: E_LED_step / period,
    energyVsLayers: energyVsLayersAtConstantHeight(Fmax),
    renderExaggeration: RENDER_EXAGGERATION,
    alerts,
    series,
  };
}

/**
 * Energía por pisada con V_c fijado y C_s muy grande (P5). Sirve para trazar el
 * rendimiento del puente frente a la tensión de pre-carga, y para comprobar
 * que existe un máximo (no monotonía) alrededor de 15 V.
 */
export function energyVsFixedVc(
  VcFixed: number,
  Fmax: number,
  Vd: number = CIRCUIT.Vdiode,
  nD: number = CIRCUIT.nDiodes
): number {
  const period = PULSE.Tp;
  const n = 20000;
  const dt = period / n;
  const Cp = totalCapacitance(STACK.nLayers);
  let Vp = 0;
  let E = 0;
  const Vth = nD * Vd;
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) * dt;
    const i = stackSourceCurrent(dForceAt(t, Fmax, period));
    const cond = Math.abs(Vp) >= VcFixed + Vth && Math.sign(Vp) * i > 0;
    if (cond) {
      E += VcFixed * Math.abs(i) * dt;
      Vp = Math.sign(Vp) * (VcFixed + Vth);
    } else {
      Vp += (i / Cp) * dt;
    }
  }
  return E;
}
