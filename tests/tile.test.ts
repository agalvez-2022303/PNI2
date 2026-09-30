import { describe, it, expect } from 'vitest';
import {
  discArea,
  capacitance,
  charge,
  openCircuitVoltage,
  energyPerCycle,
  stepForce,
  stepForceDot,
} from '../frontend/src/core/tile';
import { DEFAULT_MATERIALS, findMaterial } from '../frontend/src/core/materials';

/**
 * Caso de referencia (enunciado): PZT-5A, disco Ø20 mm, 1 mm de espesor, F=100 N.
 * Esperado: C_p ≈ 4.73 nF, Q ≈ 37.4 nC, V_oc ≈ 7.9 V, E ≈ 148 nJ.
 * Tolerancia exigida: error < 1 %.
 */
describe('Simulación 1 — baldosa modo 33 (valores de referencia)', () => {
  const pzt5a = findMaterial(DEFAULT_MATERIALS, 'pzt5a');
  const A = discArea(20e-3);
  const t = 1e-3;
  const F = 100;
  const n = 1;

  it('capacitancia C_p ≈ 4.73 nF (<1%)', () => {
    const Cp = capacitance(n, pzt5a.epsR, A, t);
    expect(Math.abs(Cp - 4.73e-9) / 4.73e-9).toBeLessThan(0.01);
  });

  it('carga Q ≈ 37.4 nC (<1%)', () => {
    const Q = charge(n, pzt5a.d33, F);
    expect(Math.abs(Q - 37.4e-9) / 37.4e-9).toBeLessThan(0.01);
  });

  it('voltaje en circuito abierto V_oc ≈ 7.9 V (<1%)', () => {
    const Voc = openCircuitVoltage(pzt5a.d33, t, pzt5a.epsR, A, F);
    expect(Math.abs(Voc - 7.9) / 7.9).toBeLessThan(0.01);
  });

  it('energía por ciclo E ≈ 148 nJ (<1%)', () => {
    const Cp = capacitance(n, pzt5a.epsR, A, t);
    const Voc = openCircuitVoltage(pzt5a.d33, t, pzt5a.epsR, A, F);
    const E = energyPerCycle(Cp, Voc);
    expect(Math.abs(E - 148e-9) / 148e-9).toBeLessThan(0.01);
  });

  it('V_oc = Q / C_p (consistencia de fórmulas)', () => {
    const Cp = capacitance(n, pzt5a.epsR, A, t);
    const Q = charge(n, pzt5a.d33, F);
    const Voc = openCircuitVoltage(pzt5a.d33, t, pzt5a.epsR, A, F);
    expect(Math.abs(Voc - Q / Cp)).toBeLessThan(1e-9);
  });

  it('V_oc es independiente de n (serie mecánica / paralelo eléctrico)', () => {
    const Cp1 = capacitance(1, pzt5a.epsR, A, t);
    const Cp5 = capacitance(5, pzt5a.epsR, A, t);
    const Q1 = charge(1, pzt5a.d33, F);
    const Q5 = charge(5, pzt5a.d33, F);
    expect(Math.abs(Q1 / Cp1 - Q5 / Cp5)).toBeLessThan(1e-9);
  });
});

describe('Fuerza de pisada F(t) = F_max sin²(π t / T)', () => {
  it('vale 0 en t=0 y t=T, y F_max en t=T/2', () => {
    expect(stepForce(0, 700, 0.3)).toBeCloseTo(0, 6);
    expect(stepForce(0.3, 700, 0.3)).toBeCloseTo(0, 6);
    expect(stepForce(0.15, 700, 0.3)).toBeCloseTo(700, 6);
  });
  it('derivada dF/dt es 0 en el pico (t=T/2)', () => {
    expect(stepForceDot(0.15, 700, 0.3)).toBeCloseTo(0, 6);
  });
  it('es nula fuera del intervalo [0,T]', () => {
    expect(stepForce(-0.1, 700, 0.3)).toBe(0);
    expect(stepForce(0.4, 700, 0.3)).toBe(0);
  });
});
