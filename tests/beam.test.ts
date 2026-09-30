import { describe, it, expect } from 'vitest';
import {
  williamsYatesPmax,
  compositeSection,
  eigenvalues,
  optimalResistance,
  buildBeamModel,
  BeamGeom,
} from '../frontend/src/core/beam';

/**
 * Caso de referencia (enunciado): m=5 g, a=2 m/s², ζ_T=0.03, f_n=50 Hz
 * ⇒ P_max ≈ 265 µW (cota teórica de Williams & Yates).
 */
describe('Simulación 2 — viga bimorfa modo 31', () => {
  it('cota de Williams-Yates P_max ≈ 265 µW (<1%)', () => {
    const omegaN = 2 * Math.PI * 50;
    const P = williamsYatesPmax(0.005, 2, 0.03, omegaN);
    expect(Math.abs(P - 265e-6) / 265e-6).toBeLessThan(0.01);
  });

  it('sección simétrica ⇒ eje neutro centrado', () => {
    const b = 20e-3;
    const layers = [
      { thickness: 0.25e-3, youngs: 61e9, density: 7750 },
      { thickness: 0.5e-3, youngs: 100e9, density: 8500 },
      { thickness: 0.25e-3, youngs: 61e9, density: 7750 },
    ];
    const sec = compositeSection(layers, b, 100e9);
    const total = 0.25e-3 + 0.5e-3 + 0.25e-3;
    expect(sec.neutralAxis).toBeCloseTo(total / 2, 9);
    expect(sec.EI).toBeGreaterThan(0);
    expect(sec.mLinear).toBeGreaterThan(0);
  });

  it('primer autovalor del voladizo sin masa de punta ≈ 1.8751', () => {
    const roots = eigenvalues(0, 3);
    expect(roots[0]).toBeCloseTo(1.8751, 3);
    expect(roots[1]).toBeCloseTo(4.6941, 2);
    expect(roots[2]).toBeCloseTo(7.8548, 2);
  });

  it('la masa de punta reduce la frecuencia natural fundamental', () => {
    const noMass = eigenvalues(0, 1)[0];
    const heavy = eigenvalues(2, 1)[0];
    expect(heavy).toBeLessThan(noMass);
  });

  it('f_n distribuida (modo 1) y SDOF coinciden dentro del 5%', () => {
    const g: BeamGeom = {
      length: 60e-3,
      width: 20e-3,
      tSub: 0.5e-3,
      tPiezo: 0.25e-3,
      tipMass: 5e-3,
      Ep: 61e9,
      Es: 100e9,
      rhoP: 7750,
      rhoS: 8500,
      epsR: 1700,
      d31: -171e-12,
      k31: 0.35,
    };
    const model = buildBeamModel(g, 3);
    const fDist = model.modes[0].freq;
    expect(Math.abs(fDist - model.fnSDOF) / model.fnSDOF).toBeLessThan(0.05);
    expect(model.Cp).toBeGreaterThan(0);
  });

  it('R_opt = 1/(ω_n C_p)', () => {
    const R = optimalResistance(2 * Math.PI * 50, 20e-9);
    expect(R).toBeCloseTo(1 / (2 * Math.PI * 50 * 20e-9), 3);
  });
});
