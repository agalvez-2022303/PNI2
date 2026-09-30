/** Orquestación de la Simulación 2: viga bimorfa en voladizo (modo 31, dinámica). */
import { Material } from '../core/materials';
import {
  buildBeamModel,
  BeamGeom,
  BeamModel,
  powerFRF,
  optimalResistance,
  williamsYatesPmax,
} from '../core/beam';
import { integrateAdaptive } from '../core/rk4';
import { NUM } from '../core/config';
import { BeamParams, BeamResult } from './types';

function geomFrom(p: BeamParams, piezo: Material, substrate: Material, tipMass: number): BeamGeom {
  return {
    length: p.length,
    width: p.width,
    tSub: p.tSub,
    tPiezo: p.tPiezo,
    tipMass,
    Ep: piezo.youngs,
    Es: substrate.youngs,
    rhoP: piezo.density,
    rhoS: substrate.density,
    epsR: piezo.epsR,
    d31: piezo.d31,
    k31: piezo.k33 * 0.5,
  };
}

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

export function runBeam(p: BeamParams, piezo: Material, substrate: Material): BeamResult {
  const model = buildBeamModel(geomFrom(p, piezo, substrate, p.tipMass), NUM.nModes);
  const omega1 = model.modes[0]?.omega ?? 1;
  const Ropt = optimalResistance(omega1, model.Cp);

  const mOsc = model.meq;
  const pMax = williamsYatesPmax(mOsc, p.a0, p.zetaT, omega1);
  const pRealistic = pMax * p.lossFactor;

  // FRF: barrido de frecuencia
  const fArr: number[] = [];
  const pArr: number[] = [];
  const vArr: number[] = [];
  let pModelPeak = 0;
  let peakFreq = model.modes[0]?.freq ?? 0;
  for (let i = 0; i < NUM.frfPoints; i++) {
    const f = p.freqMin + ((p.freqMax - p.freqMin) * i) / (NUM.frfPoints - 1);
    const omega = 2 * Math.PI * f;
    const P = powerFRF(model, omega, p.a0, p.Rload, p.zetaT);
    const V = Math.sqrt(2 * P * p.Rload); // amplitud a partir de P=|V|²/2R
    fArr.push(f);
    pArr.push(P);
    vArr.push(V);
    if (P > pModelPeak) {
      pModelPeak = P;
      peakFreq = f;
    }
  }

  // Potencia vs R_load (a resonancia del modo 1)
  const rR: number[] = [];
  const rP: number[] = [];
  for (let i = 0; i < NUM.rSweepPoints; i++) {
    const frac = i / (NUM.rSweepPoints - 1);
    const R = Ropt * Math.pow(10, -2 + 4 * frac); // 0.01·Ropt .. 100·Ropt
    rR.push(R);
    rP.push(powerFRF(model, omega1, p.a0, R, p.zetaT));
  }

  // Potencia vs masa de punta (reconstruye el modelo, potencia pico a su resonancia con R_opt)
  const mM: number[] = [];
  const mP: number[] = [];
  const massMax = 30e-3;
  for (let i = 0; i < NUM.massSweepPoints; i++) {
    const mass = (massMax * i) / (NUM.massSweepPoints - 1);
    const mdl = buildBeamModel(geomFrom(p, piezo, substrate, mass), NUM.nModes);
    const w1 = mdl.modes[0].omega;
    const R = optimalResistance(w1, mdl.Cp);
    mM.push(mass);
    mP.push(powerFRF(mdl, w1, p.a0, R, p.zetaT));
  }

  // Respuesta en el tiempo (modo dominante) en resonancia
  const timeSeries = beamTimeResponse(model, p, peakFreq);

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
    Cp: model.Cp,
    Ropt,
    pMaxWilliamsYates: pMax,
    pRealistic,
    pModelPeak,
    peakFreq,
    frf: { f: fArr, P: pArr, V: vArr },
    pVsR: { R: rR, P: rP },
    pVsMass: { m: mM, P: mP },
    timeSeries,
    modeShapes,
  };
}

/** Integra el modo dominante acoplado (RK4 adaptativo) hasta régimen permanente. */
function beamTimeResponse(model: BeamModel, p: BeamParams, freqHz: number) {
  const m = model.modes[0];
  const omega = 2 * Math.PI * freqHz;
  const Cp = model.Cp;
  const R = p.Rload;
  const zeta = p.zetaT;
  const a0 = p.a0;
  // estado y=[η, η̇, v]
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
  const tEnd = cycles / freqHz;
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
