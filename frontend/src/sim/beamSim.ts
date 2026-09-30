/** Orquestación de la Simulación 2: viga bimorfa en voladizo (modo 31, dinámica). */
import {
  buildBeamModel,
  referenceBeamGeom,
  BeamGeom,
  BeamModel,
  powerFRF,
  optimalResistance,
  williamsYatesPmax,
  modalEffectiveMass,
  mechanicalPowerFRF,
  mechanicalPowerTimeDomain,
} from '../core/beam';
import { integrateAdaptive } from '../core/rk4';
import { NUM } from '../core/config';
import { BEAM } from '../core/referenceModel';
import { BeamInputs, BeamResult } from './types';

function modeShape(model: BeamModel, idx: number, samples = 60): { x: number[]; y: number[] } {
  const m = model.modes[idx];
  const L = model.L;
  const sig = (Math.cosh(m.lambda) + Math.cos(m.lambda)) / (Math.sinh(m.lambda) + Math.sin(m.lambda));
  const raw = (x: number) => {
    const bx = m.beta * x;
    return Math.cosh(bx) - Math.cos(bx) - sig * (Math.sinh(bx) - Math.sin(bx));
  };
  const xs: number[] = [];
  const ys: number[] = [];
  let peak = 0;
  for (let i = 0; i <= samples; i++) {
    const x = (L * i) / samples;
    const y = raw(x);
    peak = Math.max(peak, Math.abs(y));
    xs.push(x / L);
    ys.push(y);
  }
  for (let i = 0; i < ys.length; i++) ys[i] /= peak || 1;
  return { x: xs, y: ys };
}

export function runBeam(p: BeamInputs): BeamResult {
  // Toda la geometría y el material vienen del modelo de referencia.
  const g: BeamGeom = referenceBeamGeom();
  const model = buildBeamModel(g, NUM.nModes);
  const omega1 = model.modes[0].omega;
  const Ropt = optimalResistance(omega1, model.Cp);

  // C4: cota de Williams & Yates con ζ mecánico FIJO, sin factor "realista".
  // La masa modal efectiva sale de la forma modal del modo 1, no de una
  // constante: modalEffectiveMass(model) = γ₁².
  const pBound = williamsYatesPmax(model, p.a0);

  // Excitación a la frecuencia indicada por el usuario, no en el pico de la FRF.
  const omegaExc = 2 * Math.PI * p.fExc;

  // Potencia del modelo a R_opt, medida en la excitación pedida.
  const pModel = powerFRF(model, omegaExc, p.a0, Ropt, BEAM.zetaMec);
  const pRatio = pBound > 0 ? pModel / pBound : Number.NaN;

  // Barrido de frecuencia alrededor de la excitación para la interfaz.
  const fArr: number[] = [];
  const pArr: number[] = [];
  const vArr: number[] = [];
  let pModelPeak = 0;
  let peakFreq = model.modes[0].freq;
  const fMin = Math.max(5, p.fExc - 60);
  const fMax = p.fExc + 60;
  for (let i = 0; i < NUM.frfPoints; i++) {
    const f = fMin + ((fMax - fMin) * i) / (NUM.frfPoints - 1);
    const omega = 2 * Math.PI * f;
    const P = powerFRF(model, omega, p.a0, Ropt, BEAM.zetaMec);
    const V = Math.sqrt(2 * P * Ropt);
    fArr.push(f);
    pArr.push(P);
    vArr.push(V);
    if (P > pModelPeak) {
      pModelPeak = P;
      peakFreq = f;
    }
  }

  // Potencia vs R_load a la frecuencia de excitación.
  const rR: number[] = [];
  const rP: number[] = [];
  for (let i = 0; i < NUM.rSweepPoints; i++) {
    const frac = i / (NUM.rSweepPoints - 1);
    const R = Ropt * Math.pow(10, -2 + 4 * frac);
    rR.push(R);
    rP.push(powerFRF(model, omegaExc, p.a0, R, BEAM.zetaMec));
  }

  // P9: la potencia ELÉCTRICA entregada a R_load según la FRF analítica se
  // contrasta con el promedio en régimen de v²/R de la simulación temporal
  // acoplada. Deben coincidir dentro del 2 %.
  const coupled = coupledTimeDomain(model, omegaExc, Ropt, p.a0);
  const frfVsTime = {
    pFrf: pModel,
    pTime: coupled.pElec,
    relDiff: pModel > 0 ? Math.abs(coupled.pElec - pModel) / pModel : Number.NaN,
  };

  // P9b: la comprobación mecánica (disipación en el amortiguador) se mantiene
  // como contraste independiente FRF ↔ integración temporal.
  const pFrfMech = mechanicalPowerFRF(model, omega1, p.a0, BEAM.zetaMec);
  const tdMech = mechanicalPowerTimeDomain(model, omega1, p.a0, BEAM.zetaMec);
  const mechVsTime = {
    pFrf: pFrfMech,
    pTime: tdMech.meanPower,
    relDiff: pFrfMech > 0 ? Math.abs(tdMech.meanPower - pFrfMech) / pFrfMech : Number.NaN,
    qAmplitude: tdMech.qAmplitude,
  };

  // P9c: conservación de energía en régimen permanente.
  const powerBalance = {
    pInput: coupled.pInput,
    pMech: coupled.pMech,
    pElec: coupled.pElec,
    pSum: coupled.pMech + coupled.pElec,
    relDiff:
      coupled.pInput > 0 ? Math.abs(coupled.pMech + coupled.pElec - coupled.pInput) / coupled.pInput : Number.NaN,
  };

  const timeSeries = beamTimeResponse(model, omegaExc, Ropt, p.a0);
  const modeShapes = model.modes.map((_, i) => modeShape(model, i));

  return {
    neutralAxis: model.section.neutralAxis,
    EI: model.section.EI,
    mLinear: model.section.mLinear,
    totalThickness: model.section.totalThickness,
    modes: model.modes.map((m) => ({ freq: m.freq, omega: m.omega, lambda: m.lambda })),
    keq: model.keq,
    meq: model.meq,
    fnSDOF: model.fnSDOF,
    modalMass1: modalEffectiveMass(model, 0),
    Cp: model.Cp,
    Ropt,
    pModel,
    pBound,
    pRatio,
    peakFreq,
    frf: { f: fArr, P: pArr, V: vArr },
    pVsR: { R: rR, P: rP },
    frfVsTime,
    mechVsTime,
    powerBalance,
    timeSeries,
    modeShapes,
  };
}

/** Ecuación de estado del modo 1 acoplado electromecánicamente. y = [η, η̇, v]. */
function coupledDeriv(model: BeamModel, omega: number, a0: number, R: number, zeta: number) {
  const m = model.modes[0];
  const Cp = model.Cp;
  return (t: number, y: number[]): number[] => {
    const eta = y[0];
    const etaDot = y[1];
    const v = y[2];
    const a = a0 * Math.sin(omega * t);
    const etaDDot = -2 * zeta * m.omega * etaDot - m.omega * m.omega * eta + m.theta * v - m.gamma * a;
    const vDot = -(v / R + m.theta * etaDot) / Cp;
    return [etaDot, etaDDot, vDot];
  };
}

/** Un paso RK4 de tamaño fijo sobre y de 3 componentes. */
function rk4Step3(
  f: (t: number, y: number[]) => number[],
  t: number,
  y: number[],
  h: number
): number[] {
  const k1 = f(t, y);
  const k2 = f(t + h / 2, [y[0] + (h / 2) * k1[0], y[1] + (h / 2) * k1[1], y[2] + (h / 2) * k1[2]]);
  const k3 = f(t + h / 2, [y[0] + (h / 2) * k2[0], y[1] + (h / 2) * k2[1], y[2] + (h / 2) * k2[2]]);
  const k4 = f(t + h, [y[0] + h * k3[0], y[1] + h * k3[1], y[2] + h * k3[2]]);
  return [
    y[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    y[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    y[2] + (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
  ];
}

/**
 * Potencias medias en régimen permanente del sistema acoplado (RK4 de paso fijo).
 *
 * Integra el mismo sistema que `beamTimeResponse`, descarta el transitorio y
 * promedia sobre ciclos completos los tres términos de la ecuación de energía
 * multiplicada por η̇:
 *
 *   P_entrada   = -γ⟨a·η̇⟩   (trabajo de la excitación de base)
 *   P_mecánica  =  c·⟨η̇²⟩    (disipación viscosa, c = 2ζω₁)
 *   P_eléctrica =  ⟨v²/R⟩     (disipación en la carga)
 *
 * que deben satisfacer P_entrada = P_mecánica + P_eléctrica.
 *
 * El paso fijo con muestreo denso por ciclo evita el sesgo de promediar sobre
 * una ventana que no cubre un número entero de ciclos.
 */
export function coupledTimeDomain(
  model: BeamModel,
  omega: number,
  R: number,
  a0: number,
  nCyclesTransient: number = 80,
  nCyclesAverage: number = 20
): { pInput: number; pMech: number; pElec: number } {
  const m = model.modes[0];
  const zeta = BEAM.zetaMec;
  const f = omega / (2 * Math.PI);
  const deriv = coupledDeriv(model, omega, a0, R, zeta);
  const c = 2 * zeta * m.omega;

  const stepsPerCycle = 2000;
  const nT = Math.round(nCyclesTransient * stepsPerCycle);
  const nAvg = Math.round(nCyclesAverage * stepsPerCycle);
  const h = 1 / (f * stepsPerCycle);

  let y = [0, 0, 0];
  let t = 0;
  for (let i = 0; i < nT; i++) {
    y = rk4Step3(deriv, t, y, h);
    t += h;
  }

  let sIn = 0;
  let sMech = 0;
  let sElec = 0;
  for (let i = 0; i < nAvg; i++) {
    const a = a0 * Math.sin(omega * t);
    sIn += -m.gamma * a * y[1] * h;
    sMech += c * y[1] * y[1] * h;
    sElec += (y[2] * y[2] * h) / R;
    y = rk4Step3(deriv, t, y, h);
    t += h;
  }
  const T = nAvg * h;
  return { pInput: sIn / T, pMech: sMech / T, pElec: sElec / T };
}

/** Integra el modo dominante acoplado (RK4 adaptativo) en la excitación pedida. */
function beamTimeResponse(model: BeamModel, omega: number, R: number, a0: number) {
  const f = omega / (2 * Math.PI);
  const deriv = coupledDeriv(model, omega, a0, R, BEAM.zetaMec);
  const m = model.modes[0];
  const cycles = 30;
  const tEnd = cycles / f;
  const samples = integrateAdaptive(deriv, [0, 0, 0], 0, tEnd, {
    sampleEvery: tEnd / 800,
    relTol: 1e-5,
  });
  const t: number[] = [];
  const v: number[] = [];
  const P: number[] = [];
  const tip: number[] = [];
  for (const s of samples) {
    t.push(s.t);
    v.push(s.y[2]);
    P.push((s.y[2] * s.y[2]) / R);
    tip.push(m.phiL * s.y[0]);
  }
  return { t, v, P, tip };
}
