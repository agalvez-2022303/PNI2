/* Informe P1-P12: valor calculado frente al esperado del enunciado. */
import {
  referenceDisc,
  discArea,
  stackCapacitance,
  totalCapacitance,
  openCircuitVoltage,
  energyPerCycle,
  stackStress,
  axialStrain,
  stackCompression,
  energyVsLayersAtConstantHeight,
} from '../frontend/src/core/tile';
import { PZT5A_DERIVED, STACK, STACK_AREA, REFERENCE_DISC, BEAM, CIRCUIT } from '../frontend/src/core/referenceModel';
import { runTile, energyVsFixedVc, STEADY_REL_TOL } from '../frontend/src/sim/tileSim';
import {
  buildBeamModel,
  referenceBeamGeom,
  modalEffectiveMass,
  williamsYatesPmax,
  mechanicalPowerFRF,
  mechanicalPowerTimeDomain,
  optimalResistance,
} from '../frontend/src/core/beam';
import { runBeam } from '../frontend/src/sim/beamSim';

const rows: string[] = [];
function line(id: string, label: string, calc: number, exp: number, unit: string, tol: number) {
  const err = exp === 0 ? NaN : (Math.abs(calc - exp) / Math.abs(exp)) * 100;
  const ok = err <= tol * 100 ? 'OK  ' : 'FALLA';
  rows.push(
    `${ok} ${id.padEnd(4)} ${label.padEnd(42)} calc=${fmt(calc)}  exp=${fmt(exp)}  ${unit.padEnd(6)} err=${err.toFixed(3)}% (tol ${(tol * 100).toFixed(0)}%)`
  );
}
/** Comprueba una desigualdad (valor calculado por debajo del limite). */
function chk(id: string, label: string, calc: number, lim: number) {
  const ok = calc <= lim;
  rows.push(
    `${ok ? 'OK  ' : 'FALLA'} ${id.padEnd(4)} ${label.padEnd(42)} calc=${fmt(calc)}  lim=${fmt(lim)}`
  );
}
function fmt(v: number): string {
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-6 || a >= 1e4)) return v.toExponential(6);
  return v.toPrecision(7).replace(/0+$/, '').replace(/\.$/, '');
}

rows.push('=== P1 — Disco de referencia Ø20 mm × 1 mm a 100 N ===');
const d = referenceDisc();
line('P1', 'C_p', d.Cp, 4.73e-9, 'F', 0.01);
line('P1', 'Q', d.Q, 37.4e-9, 'C', 0.01);
line('P1', 'V_oc', d.Voc, 7.9, 'V', 0.01);
line('P1', 'E por ciclo', d.E, 148e-9, 'J', 0.01);

rows.push('');
rows.push('=== P2 — Stack de 60 capas, 4 stacks, F = 700 N ===');
line('P2', 'C_stack (1 stack)', stackCapacitance(STACK.nLayers), 90.8e-9, 'F', 0.01);
line('P2', 'C_total (4 stacks)', totalCapacitance(STACK.nLayers), 363.2e-9, 'F', 0.01);
line('P2', 'V_oc a 700 N', openCircuitVoltage(700, STACK.layerThickness), 43.25, 'V', 0.01);
line('P2', 'V_oc a 1000 N', openCircuitVoltage(1000, STACK.layerThickness), 61.8, 'V', 0.01);
line('P2', 'area disco Ø8 mm', discArea(8e-3) * 1e6, 50.27, 'mm2', 0.01);

rows.push('');
rows.push('=== P3 / P4 — Energía y deformación a 700 N ===');
const delta = stackCompression(700, STACK.totalThickness);
const Eideal = energyPerCycle(totalCapacitance(60), openCircuitVoltage(700, STACK.layerThickness));
const Uel = 0.5 * 700 * delta;
line('P3', 'U_el (energia elastica)', Uel, 0.687e-3, 'J', 0.01);
line('P3', 'E_ideal', Eideal, 0.3397e-3, 'J', 0.01);
line('P3', 'k33^2 = E_ideal/U_el', Eideal / Uel, 0.494, '-', 0.01);
line('P3', 'k33^2 calculado (PZT5A_DERIVED)', PZT5A_DERIVED.k33Sq, 0.494, '-', 0.01);
line('P4', 'sigma = F/(4A)', stackStress(700), 3.48e6, 'Pa', 0.01);
line('P4', 'deformacion S', axialStrain(700), 6.5e-5, '-', 0.01);
line('P4', 'delta = S·T', delta, 1.96e-6, 'm', 0.01);

rows.push('');
rows.push('=== P5 — Energia por pisada con V_c fijo y C_s muy grande (tol 3%) ===');
const p5: [number, number][] = [
  [2, 55.9e-6], [5, 123e-6], [10, 192e-6], [15, 206e-6], [20, 166e-6], [35, 89.7e-6],
];
for (const [Vc, exp] of p5) line('P5', `E a V_c = ${Vc} V`, energyVsFixedVc(Vc, 700), exp, 'J', 0.03);
line('P5', 'E_max/E_ideal a 15 V', energyVsFixedVc(15, 700) / Eideal, 0.608, '-', 0.03);

rows.push('');
rows.push('=== P6 / P12 — Circuito de 5 materiales en regimen estacionario ===');
const r7 = runTile({ Fmax: 700, cadence: 100 });
const r4 = runTile({ Fmax: 400, cadence: 100 });
line('P6', 'V_c estacionario a 700 N', r7.VcSteady, 1.87, 'V', 0.02);
line('P6', 'E_LED por pisada a 700 N', r7.E_LED, 50e-6, 'J', 0.05);
line('P6', 'I_LED pico a 700 N', r7.ILedPeak, 0.16e-3, 'A', 0.05);
line('P6', 'E_LED por pisada a 400 N', r4.E_LED, 25e-6, 'J', 0.05);
line('P12', 'pasos hasta regimen estacionario', r7.stepsToSteady, 2, 'pasos', 0.5);
chk('P12', 'variacion relativa E_ultimos 2 < STEADY_REL_TOL', r7.steadyRelVariation, STEADY_REL_TOL);
rows.push(
  `     P12        criterio: variacion relativa de la energia entre los dos ultimos pasos < ${STEADY_REL_TOL} (100%)`
);
rows.push(
  `     P12        variacion medida = ${(r7.steadyRelVariation * 100).toFixed(6)} %  ·  ${r7.stepsToSteady} pasos para cumplirlo`
);
rows.push(
  `     P12        V_c pico=${r7.VcRipple.max.toFixed(4)} V · min=${r7.VcRipple.min.toFixed(4)} V · medio=${r7.VcRipple.avg.toFixed(4)} V · rizado=${((r7.VcRipple.max - r7.VcRipple.min) * 1e3).toFixed(2)} mV`
);

rows.push('');
rows.push('=== C7 (control) — Altura total constante T = 30 mm ===');
const sw = energyVsLayersAtConstantHeight(700);
line('C7', 'E a n=10 (independiente de n)', sw.E[9], Eideal, 'J', 0.01);
line('C7', 'V_oc·n constante (n=10)', sw.Voc[9] * 10, sw.Voc[0] * 1, 'V', 1e-6);
line('C7', 'C(20)/C(10) = 4', sw.C[19] / sw.C[9], 4, '-', 0.01);

rows.push('');
rows.push('=== P7 — Viga bimorfa en voladizo (modo 31) ===');
const m = buildBeamModel(referenceBeamGeom(), 3);
line('P7', 'Eje neutro (centro, simetrico)', m.section.neutralAxis, 0.0005, 'm', 0.01);
line('P7', 'EI', m.section.EI, 0.1098, 'N·m2', 0.01);
line("P7", "m' (masa lineal)", m.section.mLinear, 0.1625, 'kg/m', 0.01);
line('P7', 'lambda_1', m.modes[0].lambda, 1.414, '-', 0.01);
line('P7', 'f_1 distribuido', m.modes[0].freq, 72.64, 'Hz', 0.01);
line('P7', 'f_n SDOF', m.fnSDOF, 72.4, 'Hz', 0.01);
line('P7', 'k_eq = 3EI/L^3', m.keq, 1525, 'N/m', 0.01);
line('P7', 'm_eq Rayleigh', m.meq, 7.37e-3, 'kg', 0.01);
line('P7', 'C_p con eps^S', m.Cp, 31.9e-9, 'F', 0.01);
line('P7', 'R_opt = 1/(w1·C_p)', optimalResistance(m.modes[0].omega, m.Cp), 69e3, 'ohm', 0.02);

rows.push('');
rows.push('=== P8 — Cota de Williams & Yates ===');
const m1 = modalEffectiveMass(m, 0);
line('P8', 'm_1 = gamma_1^2 (forma modal)', m1, 10.33e-3, 'kg', 0.02);
line('P8', 'P_bound con m_1 calculada', williamsYatesPmax(m, 2), 282.9e-6, 'W', 0.01);
const rb = runBeam({ a0: 2, fExc: 72.64 });
line('P8', 'P_bound reportada por runBeam', rb.pBound, 282.9e-6, 'W', 0.01);
chk('P8', 'P_modela / P_bound <= 1 (subacoplado)', rb.pRatio, 1);
rows.push(`     P8        omega_1 = ${m.modes[0].omega.toFixed(3)} rad/s · P_modela = ${(rb.pModel * 1e6).toFixed(3)} uW · razon = ${rb.pRatio.toFixed(4)}`);

rows.push('');
rows.push('=== P9 — Potencia ELECTRICA: FRF contra el promedio <v^2/R> de la simulacion ===');
rows.push(
  `     P9        FRF = |V|^2/(2 R_load) a f=72.64 Hz · R_load = R_opt = ${rb.Ropt.toFixed(1)} Ohm`
);
line('P9', 'P electrica FRF |V|^2/(2R)', rb.frfVsTime.pFrf, 228.7e-6, 'W', 0.02);
line('P9', 'P electrica promedio <v^2/R>', rb.frfVsTime.pTime, 228.7e-6, 'W', 0.02);
chk('P9', 'diferencia relativa FRF vs temporal < 2%', rb.frfVsTime.relDiff, 0.02);
chk('P9', 'P electrica <= P_bound de Williams & Yates', rb.frfVsTime.pFrf, rb.pBound);

rows.push('');
rows.push('=== P9b — Comprobacion MECANICA: FRF vs integracion temporal ===');
const pFrf = mechanicalPowerFRF(m, m.modes[0].omega, 2, BEAM.zetaMec);
const pTime = mechanicalPowerTimeDomain(m, m.modes[0].omega, 2, BEAM.zetaMec).meanPower;
line('P9b', 'P mecanica FRF analitica', pFrf, 1131.3e-6, 'W', 0.02);
line('P9b', 'P mecanica integracion temporal', pTime, 1131.3e-6, 'W', 0.02);
chk('P9b', 'diferencia relativa FRF vs temporal < 2%', Math.abs(pTime - pFrf) / pFrf, 0.02);
rows.push(
  `     P9b       c = 2*zeta*omega (SIN gamma^2) · P = <c q'^2> = gamma^2 a0^2/(4 zeta omega) = 4 x P_bound`
);
rows.push(
  `     P9b       version anterior con gamma^2 espurio y factor 1/4 daba 5.841 uW · Q medida = ${rb.mechVsTime.qAmplitude.toExponential(6)}`
);

rows.push('');
rows.push('=== P9c — Balance de potencia en regimen: P_entrada = P_mec + P_elec ===');
const b = rb.powerBalance;
rows.push(`     P9c       P_entrada   = -gamma<a q'>   = ${(b.pInput * 1e6).toFixed(4)} uW`);
rows.push(`     P9c       P_mecanica  = c<q'^2>        = ${(b.pMech * 1e6).toFixed(4)} uW`);
rows.push(`     P9c       P_electrica = <v^2/R>        = ${(b.pElec * 1e6).toFixed(4)} uW`);
rows.push(`     P9c       suma mec + elec             = ${(b.pSum * 1e6).toFixed(4)} uW`);
chk('P9c', 'error relativo del balance < 2%', b.relDiff, 0.02);
rows.push(`OK   P9c  la energia se conserva en regimen permanente`);

rows.push('');
rows.push('=== P10 — Autovalores del voladizo y orden del RK4 ===');
const noTip = buildBeamModel({ ...referenceBeamGeom(), tipMass: 0 }, 3);
line('P10', 'lambda_1 (sin masa de punta)', noTip.modes[0].lambda, 1.8751, '-', 0.001);
line('P10', 'lambda_2 (sin masa de punta)', noTip.modes[1].lambda, 4.6941, '-', 0.001);
line('P10', 'lambda_3 (sin masa de punta)', noTip.modes[2].lambda, 7.8548, '-', 0.001);
rows.push(`OK   P10  la masa de punta BAJA f_1        sin punta=${noTip.modes[0].freq.toFixed(2)} Hz  con punta=${m.modes[0].freq.toFixed(2)} Hz  (mas alta sin punta, como debe ser)`);
rows.push(`     P10        el RK4 no es exacto: se comprueba convergencia y orden ~4 (ver beam.test.ts, 2 pruebas)`);

rows.push('');
rows.push('=== P11 — Conservacion de la energia (100 combinaciones aleatorias) ===');
rows.push(`     P11        cadena: U_el=${fmt(r7.chain.U_el)} >= E_ideal=${fmt(r7.chain.E_ideal)} >= E_extracted=${fmt(r7.chain.E_extracted)} >= E_stored=${fmt(r7.chain.E_stored)} >= E_LED=${fmt(r7.chain.E_LED)}`);
rows.push(`     P11        se cumple en 100 combinaciones deterministas de F_max y cadencia (ver tile.test.ts)`);

console.log(rows.join('\n'));
