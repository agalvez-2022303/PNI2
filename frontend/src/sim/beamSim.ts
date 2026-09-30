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

  // P9: la FRF analítica en resonancia se contrasta con la integración
  // temporal directa del mismo oscilador. Deben coincidir dentro del 2 %.
  const pFrfMech = mechanicalPowerFRF(model, omega1, p.a0, BEAM.zetaMec);
  const pTimeMech = mechanicalPowerTimeDomain(model, omega1, p.a0, BEAM.zetaMec).meanPower;
  const frfVsTime = {
    pFrf: pFrfMech,
    pTime: pTimeMech,
    relDiff: pFrfMech > 0 ? Math.abs(pTimeMech - pFrfMech) / pFrfMech : Number.NaN,
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
    timeSeries,
    modeShapes,
  };
}

/** Integra el modo dominante acoplado (RK4 adaptativo) en la excitación pedida. */
function beamTimeResponse(model: BeamModel, omega: number, R: number, a0: number) {
  const m = model.modes[0];
  const Cp = model.Cp;
  const zeta = BEAM.zetaMec;
  const f = omega / (2 * Math.PI);
  // y = [η, η̇, v]
  const deriv = (t: number, y: number[]): number[] => {
    const eta = y[0];
    const etaDot = y[1];
    const v = y[2];
    const a = a0 * Math.sin(omega * t);
    const etaDDot = -2 * zeta * m.omega * etaDot - m.omega * m.omega * eta + m.theta * v - m.gamma * a;
    const vDot = -(v / R + m.theta * etaDot) / Cp;
    return [etaDot, etaDDot, vDot];
  };
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
