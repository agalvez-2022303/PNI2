import { describe, it, expect } from 'vitest';
import { formatSI, toSig } from '../frontend/src/core/units';
import { integrateAdaptive } from '../frontend/src/core/rk4';
import { runTile } from '../frontend/src/sim/tileSim';
import { DEFAULT_TILE } from '../frontend/src/sim/defaults';
import { findMaterial, DEFAULT_MATERIALS } from '../frontend/src/core/materials';

describe('Unidades SI con prefijos', () => {
  it('formatea energía en nJ', () => {
    expect(formatSI(148e-9, 'J')).toBe('148 nJ');
  });
  it('formatea potencia en µW', () => {
    expect(formatSI(265e-6, 'W')).toBe('265 µW');
  });
  it('formatea capacitancia en nF', () => {
    expect(formatSI(4.73e-9, 'F')).toBe('4.73 nF');
  });
  it('maneja el cero y sin unidad', () => {
    expect(formatSI(0, 'V')).toBe('0 V');
    expect(formatSI(3.14159, '', 3)).toBe('3.14');
  });
  it('toSig redondea a cifras significativas', () => {
    expect(toSig(7.9089, 3)).toBe(7.91);
  });
});

describe('Integrador RK4 adaptativo', () => {
  it('resuelve dy/dt = y, y(0)=1 ⇒ y(1)=e (<0.1%)', () => {
    const s = integrateAdaptive((t, y) => [y[0]], [1], 0, 1, { relTol: 1e-8 });
    const yEnd = s[s.length - 1].y[0];
    expect(Math.abs(yEnd - Math.E) / Math.E).toBeLessThan(1e-3);
  });
  it('resuelve el oscilador armónico conservando amplitud', () => {
    const s = integrateAdaptive((t, y) => [y[1], -y[0]], [1, 0], 0, 2 * Math.PI, { relTol: 1e-9 });
    const xEnd = s[s.length - 1].y[0];
    expect(Math.abs(xEnd - 1)).toBeLessThan(1e-3);
  });
});

describe('Simulación de baldosa completa (integración de circuito)', () => {
  it('produce energía cosechada positiva y potencia media finita', () => {
    const pzt = findMaterial(DEFAULT_MATERIALS, 'pzt5a');
    const res = runTile({ ...DEFAULT_TILE, nLayers: 10, Fmax: 700 }, pzt);
    expect(res.Cp).toBeGreaterThan(0);
    expect(res.energyHarvested).toBeGreaterThan(0);
    expect(res.avgPower).toBeGreaterThan(0);
    expect(res.etaRealistic).toBeLessThanOrEqual(res.etaTheoretical + 1e-9);
    expect(res.series.t.length).toBeGreaterThan(50);
  });
});
