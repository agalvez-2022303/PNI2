/**
 * Pruebas de referencia de la viga bimorfa en voladizo (modo 31).
 * Casos P7, P8, P9 y P10 del enunciado.
 */
import { describe, it, expect } from 'vitest';
import {
  compositeSection,
  eigenvalues,
  optimalResistance,
  buildBeamModel,
  referenceBeamGeom,
  mechanicalPowerFRF,
  mechanicalPowerTimeDomain,
  williamsYatesPmax,
  modalEffectiveMass,
} from '../frontend/src/core/beam';
import { rk4Step } from '../frontend/src/core/rk4';
import { PZT5A, PZT5A_DERIVED, EPS33_S, BRASS, BEAM } from '../frontend/src/core/referenceModel';
import { runBeam } from '../frontend/src/sim/beamSim';

function rel(got: number, want: number): number {
  return want === 0 ? Number.NaN : Math.abs(got - want) / Math.abs(want);
}

const model = buildBeamModel(referenceBeamGeom(), 3);

describe('Geometría y material vienen del modelo de referencia', () => {
  it('la viga usa Y11 = 1/s11E en el modo 31 (C3)', () => {
    const g = referenceBeamGeom();
    expect(g.Ep).toBeCloseTo(PZT5A_DERIVED.Y11, 0);
    expect(g.Ep).not.toBeCloseTo(PZT5A_DERIVED.Y33, 0);
  });

  it('k31 se deriva de d31/s11E/ε33^T (C6), no de k33·0.5', () => {
    const g = referenceBeamGeom();
    expect(rel(g.k31 ** 2, 0.1185)).toBeLessThan(0.01);
    // Sale de los primitivos piezoeléctricos, no de k33.
    expect(g.k31).toBeCloseTo(
      Math.sqrt((PZT5A.d31 * PZT5A.d31) / (PZT5A.s11E * PZT5A_DERIVED.eps33T)),
      12
    );
    // k31 = 0.344 frente al 0.352 de la relación errónea k33/2.
    expect(g.k31).toBeCloseTo(0.3442, 3);
  });

  it('C5: C_p usa ε33^S = ε33^T(1 - k31²)', () => {
    const g = referenceBeamGeom();
    const CpEsp = (EPS33_S * g.width * g.length) / (2 * g.tPiezo);
    expect(model.Cp).toBeCloseTo(CpEsp, 18);
  });
});

describe('P7 — Viga bimorfa: propiedades de sección y resonancia', () => {
  it('EI = 0.1098 N·m² (<1%)', () => {
    expect(rel(model.section.EI, 0.1098)).toBeLessThan(0.01);
  });

  it('masa lineal = 0.1625 kg/m (<1%)', () => {
    const mEsp =
      2 * PZT5A.density * BEAM.width * BEAM.tPiezo + BRASS.density * BEAM.width * BEAM.tSub;
    expect(rel(model.section.mLinear, 0.1625)).toBeLessThan(0.01);
    expect(model.section.mLinear).toBeCloseTo(mEsp, 12);
  });

  it('λ1 = 1.414 con la masa de punta de 5 g', () => {
    expect(rel(model.modes[0].lambda, 1.414)).toBeLessThan(0.01);
  });

  it('f1 = 72.64 Hz (modelo distribuido, <1%)', () => {
    expect(rel(model.modes[0].freq, 72.64)).toBeLessThan(0.01);
  });

  it('f1 = 72.4 Hz (un grado de libertad, <1%)', () => {
    expect(rel(model.fnSDOF, 72.4)).toBeLessThan(0.01);
  });

  it('k_eq = 1525 N/m (<1%)', () => {
    const kEsp = (3 * model.section.EI) / Math.pow(BEAM.length, 3);
    expect(rel(model.keq, 1525)).toBeLessThan(0.01);
    expect(model.keq).toBeCloseTo(kEsp, 9);
  });

  it('m_eq = 7.37 g (<1%)', () => {
    expect(rel(model.meq * 1e3, 7.37)).toBeLessThan(0.01);
  });

  it('C_p = 31.9 nF (tolerancia 1%)', () => {
    expect(rel(model.Cp, 31.9e-9)).toBeLessThan(0.01);
  });

  it('R_opt ≈ 1/(ω1·C_p) ≈ 69 kΩ (<2%)', () => {
    const R = optimalResistance(model.modes[0].omega, model.Cp);
    expect(rel(R, 69e3)).toBeLessThan(0.02);
    expect(R).toBeCloseTo(1 / (model.modes[0].omega * model.Cp), 6);
  });

  it('el sustrato es latón de 100 GPa', () => {
    expect(BRASS.Y).toBe(100e9);
  });
});

describe('P8 — Cota de Williams & Yates con ζ mecánico fijo (C4)', () => {
  it('la masa modal efectiva sale de la forma modal del modo 1 y da 10.33 g (2%)', () => {
    // NO hay constante: m₁ = γ₁² con γ₁ = ∫m'φ dx + M_t φ(L) y la forma
    // normalizada en masa. El valor del enunciado es 10.33 g.
    const m1 = modalEffectiveMass(model, 0);
    expect(rel(m1, 10.33e-3)).toBeLessThan(0.02);
  });

  it('m₁ = γ₁² es la masa modal, NO la m_eq de Rayleigh (7.37 g)', () => {
    const m1 = modalEffectiveMass(model, 0);
    expect(m1).toBeCloseTo(model.modes[0].gamma * model.modes[0].gamma, 15);
    expect(m1).not.toBeCloseTo(model.meq, 9);
    expect(m1).toBeGreaterThan(model.meq);
  });

  it('P_bound usa la masa modal calculada ≈ 283 µW con ζ_m = 0.02, a0 = 2 (<1%)', () => {
    const P = williamsYatesPmax(model, 2);
    expect(rel(P, 283e-6)).toBeLessThan(0.01);
    // Coherente con la fórmula a mano con la masa calculada.
    const m1 = modalEffectiveMass(model, 0);
    expect(P).toBeCloseTo((m1 * 4) / (16 * BEAM.zetaMec * model.modes[0].omega), 15);
  });

  it('ζ_m = 0.02 está marcado como SUPUESTO en el modelo', () => {
    expect(BEAM.zetaMec).toBe(0.02);
  });

  it('la potencia del modelo a R_opt es ≤ P_bound y se reporta la razón', () => {
    const r = runBeam({ a0: 2, fExc: 72.64 });
    expect(r.pModel).toBeLessThanOrEqual(r.pBound);
    expect(rel(r.pRatio, r.pModel / r.pBound)).toBeLessThan(1e-12);
    expect(r.pRatio).toBeGreaterThan(0);
  });

  it('ya no existe el factor "realista = 0.5 · cota"', () => {
    const r = runBeam({ a0: 2, fExc: 72.64 });
    expect(r.pRatio).not.toBeCloseTo(0.5, 1);
  });
});

describe('P9 — potencia eléctrica: FRF contra el promedio temporal ⟨v²/R⟩', () => {
  it('runBeam: FRF eléctrica y promedio de la simulación acoplada coinciden < 2 %', () => {
    const r = runBeam({ a0: 2, fExc: 72.64 });
    expect(r.frfVsTime.relDiff).toBeLessThan(0.02);
    // Ambas son potencias eléctricas mucho mayores que las del amortiguador.
    expect(r.frfVsTime.pFrf).toBeGreaterThan(0);
    expect(r.frfVsTime.pTime).toBeGreaterThan(0);
  });

  it('la energía eléctrica no supera la cota de Williams & Yates', () => {
    const r = runBeam({ a0: 2, fExc: 72.64 });
    expect(r.frfVsTime.pFrf).toBeLessThanOrEqual(r.pBound);
  });
});

describe('P9b — comprobación mecánica de la FRF', () => {
  it('la FRF mecánica coincide con la integración temporal < 2 %', () => {
    const pFrf = mechanicalPowerFRF(model, model.modes[0].omega, 2, BEAM.zetaMec);
    const pTime = mechanicalPowerTimeDomain(model, model.modes[0].omega, 2, BEAM.zetaMec).meanPower;
    expect(rel(pTime, pFrf)).toBeLessThan(0.02);
  });

  it('la disipación mecánica NO lleva el factor γ² espurio', () => {
    const m = model.modes[0];
    const p = mechanicalPowerFRF(model, m.omega, 2, BEAM.zetaMec);
    // P = γ²a0²/(4ζω) en resonancia: cuatro veces la cota de Williams & Yates.
    const expected = (m.gamma * m.gamma * 2 * 2) / (4 * BEAM.zetaMec * m.omega);
    expect(rel(p, expected)).toBeLessThan(1e-9);
    // La versión con γ² en c era 5.84 µW; la correcta es ~1131 µW.
    expect(p).toBeGreaterThan(1.1e-3);
  });

  it('runBeam reporta la comparación mecánica', () => {
    const r = runBeam({ a0: 2, fExc: 72.64 });
    expect(r.mechVsTime.relDiff).toBeLessThan(0.02);
  });
});

describe('P9c — balance de potencia en régimen', () => {
  it('P_entrada = P_mecánica + P_eléctrica dentro del 2 %', () => {
    const r = runBeam({ a0: 2, fExc: 72.64 });
    expect(r.powerBalance.relDiff).toBeLessThan(0.02);
  });

  it('los tres términos son positivos y la suma es coherente', () => {
    const r = runBeam({ a0: 2, fExc: 72.64 });
    const b = r.powerBalance;
    expect(b.pInput).toBeGreaterThan(0);
    expect(b.pMech).toBeGreaterThan(0);
    expect(b.pElec).toBeGreaterThan(0);
    expect(rel(b.pSum, b.pInput)).toBeLessThan(0.02);
  });
});

describe('P10 — Autovalores del volantizo y verificación del RK4', () => {
  it('primer autovalor ≈ 1.8751', () => {
    const roots = eigenvalues(0, 3);
    expect(roots[0]).toBeCloseTo(1.8751, 3);
  });

  it('segundo autovalor ≈ 4.6941', () => {
    const roots = eigenvalues(0, 3);
    expect(roots[1]).toBeCloseTo(4.6941, 3);
  });

  it('tercer autovalor ≈ 7.8548', () => {
    const roots = eigenvalues(0, 3);
    expect(roots[2]).toBeCloseTo(7.8548, 3);
  });

  it('la masa de punta reduce la frecuencia fundamental', () => {
    expect(eigenvalues(2, 1)[0]).toBeLessThan(eigenvalues(0, 1)[0]);
  });

  it('RK4 resuelve dy/dt = y con el orden de convergencia esperado', () => {
    // Un solo paso de h=1 no es exacto (RK4 es de orden 4, no exacto): da
    // 2.7083 frente a e = 2.71828. Con muchos pasos pequeños converge a e.
    const f = (_t: number, y: number[]): number[] => y;
    const integrate = (n: number) => {
      const h = 1 / n;
      let y = [1];
      for (let i = 0; i < n; i++) y = rk4Step(f, i * h, y, h);
      return y[0];
    };
    expect(integrate(1)).toBeCloseTo(65 / 24, 12); // 2.70833... = 1 + 19/24
    expect(rel(integrate(200), Math.E)).toBeLessThan(1e-8);
    // El error cae como h⁴: al doblar n, el error baja ~16 veces.
    const e1 = Math.abs(integrate(50) - Math.E);
    const e2 = Math.abs(integrate(100) - Math.E);
    expect(e1 / e2).toBeGreaterThan(12);
    expect(e1 / e2).toBeLessThan(20);
  });

  it('RK4 resuelve el oscilador armónico con error O(h^4)', () => {
    const omega = 5;
    const exact = (t: number, y0: number[]) => [y0[0] * Math.cos(omega * t) + (y0[1] / omega) * Math.sin(omega * t)];
    const f = (_t: number, y: number[]): number[] => [y[1], -omega * omega * y[0]];
    const T = 0.4;
    const measure = (n: number) => {
      let y: [number, number] = [1, 0];
      const h = T / n;
      for (let i = 0; i < n; i++) {
        const k1 = f(i * h, y);
        const k2 = f(i * h + h / 2, [y[0] + (h / 2) * k1[0], y[1] + (h / 2) * k1[1]]);
        const k3 = f(i * h + h / 2, [y[0] + (h / 2) * k2[0], y[1] + (h / 2) * k2[1]]);
        const k4 = f(i * h + h, [y[0] + h * k3[0], y[1] + h * k3[1]]);
        y = [
          y[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
          y[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
        ];
      }
      return Math.abs(y[0] - exact(T, [1, 0])[0]);
    };
    const e1 = measure(40);
    const e2 = measure(80);
    // Al doblar h el error baja ~16 veces (orden 4).
    expect(e1 / e2).toBeGreaterThan(12);
    expect(e1 / e2).toBeLessThan(20);
    expect(e2).toBeLessThan(1e-8);
  });
});

describe('Sección compuesta', () => {
  it('sección simétrica ⇒ eje neutro centrado', () => {
    const b = 20e-3;
    const layers = [
      { thickness: 0.25e-3, youngs: PZT5A_DERIVED.Y11, density: PZT5A.density },
      { thickness: 0.5e-3, youngs: BRASS.Y, density: BRASS.density },
      { thickness: 0.25e-3, youngs: PZT5A_DERIVED.Y11, density: PZT5A.density },
    ];
    const sec = compositeSection(layers, b, BRASS.Y);
    const total = 0.25e-3 + 0.5e-3 + 0.25e-3;
    expect(sec.neutralAxis).toBeCloseTo(total / 2, 9);
    expect(sec.EI).toBeGreaterThan(0);
    expect(sec.mLinear).toBeGreaterThan(0);
  });

  it('el espesor total es 1 mm (0.5 sustrato + 2×0.25 piezo)', () => {
    expect(rel(model.section.totalThickness, 1e-3)).toBeLessThan(1e-9);
  });
});

describe('Ejecución de la simulación de viga', () => {
  it('produce una FRF y unos barridos consistentes', () => {
    const r = runBeam({ a0: 2, fExc: 72.64 });
    expect(r.frf.f.length).toBeGreaterThan(100);
    expect(r.pVsR.R.length).toBeGreaterThan(50);
    expect(r.modes.length).toBe(3);
    expect(r.pBound).toBeGreaterThan(0);
  });

  it('a0 dentro del rango da más potencia que a0 mínima', () => {
    const bajo = runBeam({ a0: 0.5, fExc: 72.64 });
    const alto = runBeam({ a0: 5, fExc: 72.64 });
    expect(alto.pModel).toBeGreaterThan(bajo.pModel);
  });
});
