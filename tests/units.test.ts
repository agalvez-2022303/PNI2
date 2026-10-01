import { describe, it, expect } from 'vitest';
import { formatSI, toSig } from '../frontend/src/core/units';
import { integrateAdaptive } from '../frontend/src/core/rk4';
import { runTile } from '../frontend/src/sim/tileSim';
import { runBeam } from '../frontend/src/sim/beamSim';
import { DEFAULT_TILE_INPUTS, DEFAULT_BEAM_INPUTS, clampTileInputs, clampBeamInputs } from '../frontend/src/sim/defaults';
import { INPUTS } from '../frontend/src/core/referenceModel';

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
    const s = integrateAdaptive((_t, y) => [y[0]], [1], 0, 1, { relTol: 1e-8 });
    const yEnd = s[s.length - 1].y[0];
    expect(Math.abs(yEnd - Math.E) / Math.E).toBeLessThan(1e-3);
  });
  it('resuelve el oscilador armónico conservando amplitud', () => {
    const s = integrateAdaptive((_t, y) => [y[1], -y[0]], [1, 0], 0, 2 * Math.PI, { relTol: 1e-9 });
    const xEnd = s[s.length - 1].y[0];
    expect(Math.abs(xEnd - 1)).toBeLessThan(1e-3);
  });
});

describe('Entradas del usuario: sólo F_max, cadencia, a0 y f_exc', () => {
  it('los valores por defecto salen del modelo de referencia', () => {
    expect(DEFAULT_TILE_INPUTS.Fmax).toBe(700);
    expect(DEFAULT_TILE_INPUTS.cadence).toBe(100);
    expect(DEFAULT_BEAM_INPUTS.a0).toBe(2);
  });

  it('los rangos son los del enunciado', () => {
    expect(INPUTS.Fmax.min).toBe(300);
    expect(INPUTS.Fmax.max).toBe(1530);
    expect(INPUTS.cadence.min).toBe(60);
    expect(INPUTS.cadence.max).toBe(120);
    expect(INPUTS.a0.min).toBe(0.5);
    expect(INPUTS.a0.max).toBe(5);
    expect(INPUTS.fExc.min).toBe(40);
    expect(INPUTS.fExc.max).toBe(110);
  });

  it('el recorte mantiene las entradas dentro del rango', () => {
    expect(clampTileInputs({ Fmax: 5000 }).Fmax).toBe(1530);
    expect(clampTileInputs({ Fmax: 1 }).Fmax).toBe(300);
    expect(clampTileInputs({ cadence: 1e9 }).cadence).toBe(120);
    expect(clampBeamInputs({ a0: -5 }).a0).toBe(0.5);
    expect(clampBeamInputs({ fExc: 1e6 }).fExc).toBe(110);
  });

  it('un valor no numérico cae al mínimo, no rompe la simulación', () => {
    expect(clampTileInputs({ Fmax: Number.NaN }).Fmax).toBe(300);
  });
});

describe('Simulación del stack completa (integración de circuito)', () => {
  it('produce energía cosechada positiva y potencia media finita', () => {
    const res = runTile({ Fmax: 700, cadence: 100 });
    expect(res.Cp).toBeGreaterThan(0);
    expect(res.E_harvested).toBeGreaterThan(0);
    expect(res.avgPowerLED).toBeGreaterThan(0);
    expect(res.series.t.length).toBeGreaterThan(50);
  });

  it('la energía crece con la fuerza dentro del rango', () => {
    const bajo = runTile({ Fmax: 300, cadence: 100 });
    const alto = runTile({ Fmax: 1000, cadence: 100 });
    expect(alto.E_harvested).toBeGreaterThan(bajo.E_harvested);
  });

  it('la deformación y el esfuerzo salen del solver y escalan con F', () => {
    const bajo = runTile({ Fmax: 300, cadence: 100 });
    const alto = runTile({ Fmax: 1000, cadence: 100 });
    expect(alto.stress / bajo.stress).toBeCloseTo(1000 / 300, 10);
    expect(alto.compression / bajo.compression).toBeCloseTo(1000 / 300, 10);
  });
});

describe('Simulación de la viga completa', () => {
  it('devuelve resultados finitos y positivos', () => {
    const r = runBeam({ a0: 2, fExc: 72.64 });
    expect(Number.isFinite(r.EI)).toBe(true);
    expect(r.EI).toBeGreaterThan(0);
    expect(r.pBound).toBeGreaterThan(0);
    expect(r.pModel).toBeGreaterThan(0);
    expect(r.pRatio).toBeGreaterThan(0);
    expect(r.pRatio).toBeLessThanOrEqual(1);
  });

  it('la serie temporal tiene longitud suficiente', () => {
    const r = runBeam({ a0: 2, fExc: 72.64 });
    expect(r.timeSeries.t.length).toBeGreaterThan(100);
  });
});
