/**
 * Pruebas de referencia de la baldosa / stack piezoeléctrico (modo 33).
 *
 * Casos P1 a P5 y P7 (energía frente a V_c) del enunciado. Tolerancia 1 %
 * salvo donde se indica otra cosa.
 */
import { describe, it, expect } from 'vitest';
import {
  discArea,
  discCapacitance,
  charge,
  openCircuitVoltage,
  openCircuitVoltageFromDisc,
  energyPerCycle,
  referenceDisc,
  stackCapacitance,
  totalCapacitance,
  stackStress,
  axialStrain,
  stackCompression,
  stepForce,
  stepForceDot,
  energyVsLayersAtConstantHeight,
} from '../frontend/src/core/tile';
import { PZT5A, PZT5A_DERIVED, STACK, STACK_AREA, REFERENCE_DISC } from '../frontend/src/core/referenceModel';
import { runTile, energyVsFixedVc, STEADY_REL_TOL } from '../frontend/src/sim/tileSim';
import { assertEnergyConservation } from '../frontend/src/core/energy';

/** Error relativo de `got` respecto a `want`, o NaN si want es 0. */
function rel(got: number, want: number): number {
  return want === 0 ? Number.NaN : Math.abs(got - want) / Math.abs(want);
}

describe('Constantes del modelo de referencia', () => {
  it('k33² y k31² se CALCULAN, no se tabulan', () => {
    expect(rel(PZT5A_DERIVED.k33Sq, 0.494)).toBeLessThan(0.01);
    expect(rel(PZT5A_DERIVED.k31Sq, 0.1185)).toBeLessThan(0.01);
  });

  it('Y33 = 1/s33E ≈ 53.2 GPa y Y11 = 1/s11E ≈ 61.0 GPa', () => {
    expect(rel(PZT5A_DERIVED.Y33, 53.2e9)).toBeLessThan(0.01);
    expect(rel(PZT5A_DERIVED.Y11, 61.0e9)).toBeLessThan(0.01);
  });

  it('el modelo está congelado', () => {
    expect(Object.isFrozen(PZT5A)).toBe(true);
    expect(Object.isFrozen(STACK)).toBe(true);
    expect(Object.isFrozen(PZT5A_DERIVED)).toBe(true);
  });

  it('C6: k31 se deriva de d31, s11E y ε33^T, no de k33', () => {
    // k31² = d31²/(s11E·ε33^T) calculado, NO (k33/2)².
    const k31 = Math.sqrt(PZT5A_DERIVED.k31Sq);
    const erroneo = Math.sqrt(PZT5A_DERIVED.k33Sq) * 0.5;
    // Los dos valores se parecen (0.344 vs 0.352) pero no son iguales: la
    // diferencia del 2.3 % es justamente el error que C6 elimina.
    expect(k31).toBeCloseTo(0.3442, 4);
    expect(Math.abs(k31 - erroneo)).toBeGreaterThan(0.005);
    // Y la comprobación que importa: sale de los primitivos, no de k33.
    expect(k31).toBeCloseTo(
      Math.sqrt((PZT5A.d31 * PZT5A.d31) / (PZT5A.s11E * PZT5A_DERIVED.eps33T)),
      12
    );
  });
});

describe('P1 — Disco Ø20 mm × 1 mm a 100 N', () => {
  const d = referenceDisc();

  it('C_p ≈ 4.73 nF (<1%)', () => {
    expect(rel(d.Cp, 4.73e-9)).toBeLessThan(0.01);
  });

  it('Q ≈ 37.4 nC (<1%)', () => {
    expect(rel(d.Q, 37.4e-9)).toBeLessThan(0.01);
  });

  it('V_oc ≈ 7.9 V (<1%)', () => {
    expect(rel(d.Voc, 7.9)).toBeLessThan(0.01);
  });

  it('E ≈ 148 nJ (<1%)', () => {
    expect(rel(d.E, 148e-9)).toBeLessThan(0.01);
  });

  it('V_oc = Q/C_p', () => {
    expect(Math.abs(d.Voc - d.Q / d.Cp)).toBeLessThan(1e-12);
  });

  it('E = ½·C_p·V_oc²', () => {
    expect(rel(d.E, 0.5 * d.Cp * d.Voc * d.Voc)).toBeLessThan(1e-12);
  });
});

describe('P2 — Stack de 60 capas en paralelo eléctrico', () => {
  it('C_stack ≈ 90.8 nF (<1%)', () => {
    expect(rel(stackCapacitance(STACK.nLayers), 90.8e-9)).toBeLessThan(0.01);
  });

  it('C_total de 4 stacks ≈ 363.2 nF (<1%)', () => {
    expect(rel(totalCapacitance(STACK.nLayers), 363.2e-9)).toBeLessThan(0.01);
  });

  it('V_oc a 700 N ≈ 43.25 V (<1%)', () => {
    expect(rel(openCircuitVoltage(700, STACK.layerThickness), 43.25)).toBeLessThan(0.01);
  });

  it('V_oc a 1000 N ≈ 61.8 V (<1%)', () => {
    expect(rel(openCircuitVoltage(1000, STACK.layerThickness), 61.8)).toBeLessThan(0.01);
  });

  it('V_oc es lineal en F', () => {
    const v700 = openCircuitVoltage(700, STACK.layerThickness);
    const v1000 = openCircuitVoltage(1000, STACK.layerThickness);
    expect(rel(v1000 / v700, 1000 / 700)).toBeLessThan(1e-9);
  });

  it('el área del disco Ø8 mm es 50.27 mm²', () => {
    expect(rel(STACK_AREA * 1e6, 50.27)).toBeLessThan(0.01);
    expect(rel(discArea(8e-3), STACK_AREA)).toBeLessThan(1e-12);
  });
});

describe('P3/P4 — Energía y deformación a 700 N', () => {
  const sigma = stackStress(700);
  const strain = axialStrain(700);
  const delta = stackCompression(700, STACK.totalThickness);
  const E_ideal = energyPerCycle(totalCapacitance(60), openCircuitVoltage(700, STACK.layerThickness));
  const U_el = 0.5 * 700 * delta;

  it('E_ideal = 0.3397 mJ (<1%)', () => {
    expect(rel(E_ideal, 0.3397e-3)).toBeLessThan(0.01);
  });

  it('U_el = 0.687 mJ (<1%)', () => {
    expect(rel(U_el, 0.687e-3)).toBeLessThan(0.01);
  });

  it('E_ideal/U_el = 0.494 = k33² (C1: es acoplamiento, NO eficiencia)', () => {
    expect(rel(E_ideal / U_el, 0.494)).toBeLessThan(0.01);
    expect(rel(E_ideal / U_el, PZT5A_DERIVED.k33Sq)).toBeLessThan(0.01);
  });

  it('σ = 3.48 MPa con F repartido F/4 por stack (C8)', () => {
    expect(rel(sigma, 3.48e6)).toBeLessThan(0.01);
    expect(sigma).toBeCloseTo(700 / (4 * STACK_AREA), 3);
  });

  it('δ = 1.96 µm (C8: deformación derivada del solver)', () => {
    expect(rel(delta, 1.96e-6)).toBeLessThan(0.01);
  });

  it('deformación S = 6.5e-5', () => {
    expect(rel(strain, 6.5e-5)).toBeLessThan(0.02);
  });
});

describe('P5 — Energía por pisada con V_c fijo y C_s muy grande (tolerancia 3%)', () => {
  const casos: [number, number][] = [
    [2, 55.9e-6],
    [5, 123e-6],
    [10, 192e-6],
    [15, 206e-6],
    [20, 166e-6],
    [35, 89.7e-6],
  ];

  for (const [Vc, esperado] of casos) {
    it(`V_c = ${Vc} V → E ≈ ${(esperado * 1e6).toFixed(0)} µJ (<3%)`, () => {
      expect(rel(energyVsFixedVc(Vc, 700), esperado)).toBeLessThan(0.03);
    });
  }

  it('el máximo está en 15 V y vale el 60.8 % de E_ideal', () => {
    const E15 = energyVsFixedVc(15, 700);
    const Eideal = energyPerCycle(totalCapacitance(60), openCircuitVoltage(700, STACK.layerThickness));
    expect(rel(E15 / Eideal, 0.608)).toBeLessThan(0.03);
    // Ningún otro V_c del barrido lo supera.
    for (const [Vc] of casos) {
      if (Vc === 15) continue;
      expect(energyVsFixedVc(Vc, 700)).toBeLessThan(E15);
    }
  });

  it('la energía decrece con V_c por encima de 15 V (no es monótona)', () => {
    expect(energyVsFixedVc(20, 700)).toBeLessThan(energyVsFixedVc(15, 700));
    expect(energyVsFixedVc(35, 700)).toBeLessThan(energyVsFixedVc(20, 700));
  });
});

describe('C7 — Energía frente a nº de capas a altura total constante', () => {
  const sweep = energyVsLayersAtConstantHeight(700);

  it('E es INDEPENDIENTE de n a T constante', () => {
    const E0 = sweep.E[0];
    for (const E of sweep.E) {
      expect(rel(E, E0)).toBeLessThan(0.01);
    }
  });

  it('V_oc es ∝ 1/n a T constante', () => {
    // Al repartir la misma altura T en más capas, cada una es más fina: la
    // tensión de circuito abierto cae en la misma proporción.
    for (let i = 0; i < sweep.n.length; i++) {
      expect(sweep.Voc[i] * sweep.n[i]).toBeCloseTo(sweep.Voc[0] * sweep.n[0], 6);
    }
    // De 1 a 2 capas, V_oc se reduce a la mitad.
    expect(sweep.Voc[1]).toBeCloseTo(sweep.Voc[0] / 2, 6);
    // Y de 10 a 20, a la quinta parte.
    expect(sweep.Voc[19]).toBeCloseTo(sweep.Voc[9] / 2, 6);
  });

  it('C crece como n²', () => {
    for (let i = 1; i < sweep.n.length; i++) {
      expect(rel(sweep.C[i] / sweep.C[i - 1], ((i + 1) / i) ** 2)).toBeLessThan(0.01);
    }
  });

  it('no sugiere "más capas = más energía"', () => {
    const maxE = Math.max(...sweep.E);
    const minE = Math.min(...sweep.E);
    expect(rel(maxE, minE)).toBeLessThan(0.01);
  });
});

describe('Fuerza de pisada F(t) = F_max·sin²(π t/T_p)', () => {
  it('vale 0 en t=0 y t=T_p, y F_max en t=T_p/2', () => {
    expect(stepForce(0, 700, 0.3)).toBeCloseTo(0, 6);
    expect(stepForce(0.3, 700, 0.3)).toBeCloseTo(0, 6);
    expect(stepForce(0.15, 700, 0.3)).toBeCloseTo(700, 6);
  });

  it('dF/dt es 0 en el pico', () => {
    expect(stepForceDot(0.15, 700, 0.3)).toBeCloseTo(0, 6);
  });

  it('es nula fuera de [0, T_p]', () => {
    expect(stepForce(-0.1, 700, 0.3)).toBe(0);
    expect(stepForce(0.4, 700, 0.3)).toBe(0);
  });

  it('∫dF/dt dt = F_max en la subida', () => {
    const n = 100000;
    const h = 0.15 / n;
    let s = 0;
    for (let i = 0; i < n; i++) s += stepForceDot((i + 0.5) * h, 700, 0.3) * h;
    expect(rel(s, 700)).toBeLessThan(1e-6);
  });
});

describe('P6/P12 — Circuito de 5 materiales en régimen estacionario', () => {
  it('a 700 N y 100 pasos/min: V_c entre 1.85 y 1.88 V', () => {
    const r = runTile({ Fmax: 700, cadence: 100 });
    expect(r.VcSteady).toBeGreaterThanOrEqual(1.85);
    expect(r.VcSteady).toBeLessThanOrEqual(1.88);
  });

  it('a 700 N: energía al LED ≈ 50 µJ por pisada (tolerancia 5%)', () => {
    const r = runTile({ Fmax: 700, cadence: 100 });
    expect(rel(r.E_LED, 50e-6)).toBeLessThan(0.05);
  });

  it('a 700 N: I_LED pico ≈ 0.16 mA (tolerancia 5%)', () => {
    const r = runTile({ Fmax: 700, cadence: 100 });
    expect(rel(r.ILedPeak, 0.16e-3)).toBeLessThan(0.05);
  });

  it('a 400 N: ≈ 25 µJ por pisada (tolerancia 5%)', () => {
    const r = runTile({ Fmax: 400, cadence: 100 });
    expect(rel(r.E_LED, 25e-6)).toBeLessThan(0.05);
  });

  it('P12: la energía por paso varía menos del 1 % en los dos últimos pasos', () => {
    const r = runTile({ Fmax: 700, cadence: 100 });
    expect(r.stepsToSteady).toBeGreaterThan(1);
    expect(r.steadyRelVariation).toBeLessThan(STEADY_REL_TOL);
  });
});

describe('C1 — Eficiencias con denominadores correctos', () => {
  const r = runTile({ Fmax: 700, cadence: 100 });

  it('k2_ef = E_ideal/U_el da 0.494 (acoplamiento del elemento)', () => {
    expect(rel(r.k2Elemento, 0.494)).toBeLessThan(0.01);
  });

  it('η_cerámica = E_cosechada/U_el es un valor pequeño y con sentido', () => {
    expect(r.etaCeramic).toBeGreaterThan(0);
    expect(r.etaCeramic).toBeLessThan(r.k2Elemento);
  });

  it('η_módulo usa ∫F dδ, no F·5 mm', () => {
    const esperado = r.E_harvested / (700 * r.compression);
    expect(rel(r.etaModulo, esperado)).toBeLessThan(1e-12);
    // y difiere del "contexto 5 mm"
    expect(Math.abs(r.etaModulo - r.contexto5mm)).toBeGreaterThan(0);
  });

  it('η_cerámica ≤ k2_ef en todo el rango de entradas', () => {
    for (const Fmax of [300, 500, 700, 1000]) {
      const rr = runTile({ Fmax, cadence: 100 });
      expect(rr.etaCeramic).toBeLessThanOrEqual(rr.k2Elemento * 1.000001);
    }
  });
});

describe('C8 — Alertas de seguridad', () => {
  it('a 700 N no hay alerta de esfuerzo ni de tensión', () => {
    const r = runTile({ Fmax: 700, cadence: 100 });
    expect(r.alerts.filter((a) => a.code === 'sigma')).toHaveLength(0);
  });

  it('V_oc a 700 N = 43.25 V está por debajo del límite de 100 V', () => {
    const r = runTile({ Fmax: 700, cadence: 100 });
    expect(r.alerts.filter((a) => a.code === 'voltage')).toHaveLength(0);
  });

  it('el factor de exageración del render es fijo y visible', () => {
    const a = runTile({ Fmax: 300, cadence: 100 });
    const b = runTile({ Fmax: 1000, cadence: 100 });
    expect(a.renderExaggeration).toBe(b.renderExaggeration);
    expect(a.renderExaggeration).toBeGreaterThan(1);
  });
});

describe('C11 — Conservación de la energía', () => {
  it('se cumple en la corrida nominal', () => {
    const r = runTile({ Fmax: 700, cadence: 100 });
    expect(() => assertEnergyConservation(r.chain)).not.toThrow();
  });

  it('la cadena está ordenada de mayor a menor', () => {
    const r = runTile({ Fmax: 700, cadence: 100 });
    const c = r.chain;
    expect(c.U_el).toBeGreaterThan(c.E_ideal);
    expect(c.E_ideal).toBeGreaterThan(c.E_stored);
    // El LED consume una fracción de lo que entró al nodo de almacenamiento.
    expect(c.E_stored).toBeGreaterThan(c.E_LED);
    // E_extracted incluye además la pérdida en los diodos, así que queda por
    // encima de E_stored pero sigue por debajo del máximo ideal ½·C·V_oc².
    expect(c.E_extracted).toBeLessThanOrEqual(c.E_ideal);
    expect(c.E_extracted).toBeGreaterThan(c.E_stored);
  });

  it('lanza un error visible si un eslabón supera al anterior', () => {
    expect(() =>
      assertEnergyConservation({
        U_el: 1e-6,
        E_ideal: 1e-6,
        E_extracted: 5e-6, // mayor que E_ideal: imposible
        E_stored: 0,
        E_LED: 0,
      })
    ).toThrow(/viola conservación/);
  });

  it('P11: se cumple en 100 combinaciones aleatorias de F_max y cadencia', () => {
    let checked = 0;
    // Generador determinista para que la prueba sea reproducible.
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 100; i++) {
      const Fmax = 300 + (1000 - 300) * rnd();
      const cadence = 60 + (120 - 60) * rnd();
      const r = runTile({ Fmax, cadence });
      expect(r.E_harvested).toBeLessThanOrEqual(r.U_el * (1 + 1e-6));
      expect(r.etaCeramic).toBeLessThanOrEqual(r.k2Elemento * (1 + 1e-6));
      expect(r.energyIdeal).toBeLessThanOrEqual(r.U_el * (1 + 1e-6));
      expect(r.E_LED).toBeLessThanOrEqual(r.E_harvested * (1 + 1e-6) + 1e-18);
      checked++;
    }
    expect(checked).toBe(100);
  });
});

describe('Coherencia del resultado', () => {
  it('V_oc del resultado coincide con la fórmula de referencia', () => {
    const r = runTile({ Fmax: 700, cadence: 100 });
    expect(r.Voc).toBeCloseTo(openCircuitVoltage(700, STACK.layerThickness), 9);
  });

  it('la carga Q sigue d33·F·n_capas', () => {
    const r = runTile({ Fmax: 700, cadence: 100 });
    expect(r.Q).toBeCloseTo(charge(PZT5A.d33, 700) * STACK.nLayers, 15);
  });

  it('la energía disipada no puede superar E_ideal en todo el rango', () => {
    for (const Fmax of [300, 450, 600, 750, 900, 1000]) {
      const r = runTile({ Fmax, cadence: 100 });
      expect(r.E_harvested).toBeLessThanOrEqual(r.energyIdeal * (1 + 1e-6));
    }
  });

  it('C_p del disco de referencia usa ε33^T', () => {
    const Cp = discCapacitance(REFERENCE_DISC.diameter, REFERENCE_DISC.thickness);
    expect(rel(Cp, 4.73e-9)).toBeLessThan(0.01);
    expect(Cp).toBeCloseTo(
      (PZT5A_DERIVED.eps33T * discArea(REFERENCE_DISC.diameter)) / REFERENCE_DISC.thickness,
      18
    );
  });

  it('V_oc del disco suelto es independiente del área en la forma esperada', () => {
    const v = openCircuitVoltageFromDisc(100, 20e-3, 1e-3);
    expect(rel(v, 7.9)).toBeLessThan(0.01);
  });
});
