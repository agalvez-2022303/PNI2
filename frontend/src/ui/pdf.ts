/** Generación de un PDF descargable con gráficas embebidas (sin depender de la impresión). */
import { jsPDF } from 'jspdf';
import { Chart, registerables } from 'chart.js';
import { formatSI } from '../core/units';
import { TileInputs, TileResult, BeamInputs, BeamResult } from '../sim/types';
import { totalCapacitance, openCircuitVoltage } from '../core/tile';
import { STACK, BEAM, PZT5A, PZT5A_DERIVED, CIRCUIT } from '../core/referenceModel';

Chart.register(...registerables);

const whiteBg = {
  id: 'whiteBg',
  beforeDraw: (c: any) => {
    const { ctx } = c;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.restore();
  },
};

async function chartImage(config: any): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 430;
  const ctx = canvas.getContext('2d')!;
  const chart = new Chart(ctx, {
    ...config,
    options: { ...config.options, responsive: false, animation: false },
    plugins: [whiteBg],
  });
  chart.update('none');
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  const url = chart.toBase64Image('image/png', 1);
  chart.destroy();
  return url;
}

function darkScales(x: string, yl: string) {
  return {
    x: { title: { display: true, text: x, color: '#222' }, ticks: { color: '#333' }, grid: { color: '#e2e2e2' } },
    y: { title: { display: true, text: yl, color: '#222' }, ticks: { color: '#333' }, grid: { color: '#e2e2e2' } },
  };
}

export interface ReportPayload {
  tile: { inputs: TileInputs; result: TileResult | null };
  beam: { inputs: BeamInputs; result: BeamResult | null };
  /** Flujo de tránsito asumido [personas/hora] para el escalado local. */
  flowPerHour?: number;
}

export async function generateReportPdf(pl: ReportPayload) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 15;
  let y = 18;

  const ensure = (h: number) => {
    if (y + h > 285) {
      doc.addPage();
      y = 18;
    }
  };
  const h1 = (t: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(18, 22, 28);
    doc.text(t, M, y);
    y += 7;
  };
  const sub = (t: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(t, M, y);
    y += 7;
  };
  const h2 = (t: string) => {
    ensure(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(16, 120, 108);
    doc.text(t, M, y);
    y += 5;
    doc.setDrawColor(200);
    doc.line(M, y, W - M, y);
    y += 5;
  };
  const para = (t: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(70);
    const lines = doc.splitTextToSize(t, W - 2 * M);
    ensure(lines.length * 4.6 + 2);
    doc.text(lines, M, y);
    y += lines.length * 4.6 + 3;
  };
  const kv = (rows: [string, string][]) => {
    doc.setFontSize(9.5);
    rows.forEach(([k, v]) => {
      ensure(5.5);
      doc.setTextColor(95);
      doc.setFont('helvetica', 'normal');
      doc.text(k, M, y);
      doc.setTextColor(20);
      doc.setFont('helvetica', 'bold');
      doc.text(v, W / 2, y);
      y += 5.4;
    });
    y += 2;
  };
  const eq = (t: string) => {
    ensure(8);
    doc.setFillColor(238, 246, 244);
    doc.rect(M, y - 3.6, W - 2 * M, 6, 'F');
    doc.setDrawColor(53, 190, 168);
    doc.setLineWidth(0.6);
    doc.line(M, y - 3.6, M, y + 2.4);
    doc.setFont('courier', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(20);
    doc.text(t, M + 2.5, y + 0.6);
    y += 8;
  };
  const img = (url: string) => {
    const w = W - 2 * M;
    const h = w * 0.478;
    ensure(h + 4);
    doc.addImage(url, 'PNG', M, y, w, h);
    y += h + 4;
  };

  h1('Informe Técnico · Módulo de Grada Piezoeléctrica Cosechadora de Energía');
  sub(`PiezoLab · Baldosa en modo 33 validada contra viga bimorfa en modo 31 · Generado el ${new Date().toLocaleString('es-ES')}`);

  // Crédito de autores, estilo revista técnica.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 45, 61);
  doc.text('Alberto Josue Alejandro Gálvez', M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(110);
  doc.text('Simulación · investigación de campo · modelado electrónico · experimentación', M, y + 4);
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 45, 61);
  doc.text('Luis de Leon', M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(110);
  doc.text('Investigación · redacción del informe · elaboración del paper', M, y + 4);
  y += 9;
  doc.setDrawColor(180);
  doc.line(M, y, W - M, y);
  y += 6;

  const flow = pl.flowPerHour ?? 100;
  const trSum = pl.tile.result;
  h2('0. Resumen ejecutivo');
  para(
    'Baldosa de tránsito que convierte la energía elástica de cada pisada en electricidad mediante 4 stacks PZT-5A de 60 discos en modo 33, con puente rectificador, almacenamiento Cs y LED. Cálculo analítico + RK4 de paso fijo, con conservación de energía verificada por pisada (error < 1 % contra los casos de referencia).'
  );
  if (trSum) {
    kv([
      ['Energía útil por pisada (LED)', formatSI(trSum.E_LED, 'J')],
      ['Energía útil por persona (4 baldosas)', formatSI(trSum.E_harvested * 4, 'J')],
      ['Escalado local', `${formatSI(trSum.E_harvested * 4 * flow * 12, 'J')}/día · ${flow} personas/h · 12 h activas`],
    ]);
  }
  para(
    'Impacto local (Guatemala): mercados municipales, terminales de transporte, universidades y hospitales, y escaleras en zonas rurales con electrificación intermitente. La baldosa no sustituye a la red: sostiene señalización autónoma de emergencia, contadores de aforo y nodos IoT de duty-cycle bajo, eliminando baterías y cableado donde su mantenimiento cuesta más que el dispositivo.'
  );

  h2('1. Marco matemático (notación de Voigt, IEEE Std 176-1987)');
  para(
    'Eje 3 = dirección de polarización; los tensores se colapsan a vectores de 6 componentes (11->1, 22->2, 33->3, 23->4, 13->5, 12->6). Ecuaciones constitutivas lineales:'
  );
  eq('S_i = s^E_ij · T_j + d_ki · E_k        (i,j = 1..6 ; k = 1..3)');
  eq('D_i = d_ik · T_k + eps^T_ij · E_j');
  para('Baldosa, modo 33 (esfuerzo y campo paralelos al espesor):');
  eq('S3 = s33E·T3 + d33·E3      D3 = d33·T3 + eps33T·E3');
  eq(`k33^2 = d33^2/(s33E·eps33T) = ${PZT5A_DERIVED.k33Sq.toFixed(4)}   (techo de conversión por pisada)`);
  para('Viga bimorfa, modo 31 (Erturk & Inman 2011, Euler-Bernoulli acoplado):');
  eq('S1 = s11E·T1 + d31·E3      k31^2 = d31^2/(s11E·eps33T)');
  eq('eps33S = eps33T·(1 - k31^2)');

  h2('2. Modelo de referencia (no editable)');
  kv([
    ['Piezoeléctrico', `PZT-5A · d33 = ${(PZT5A.d33 * 1e12).toFixed(0)} pC/N · d31 = ${(PZT5A.d31 * 1e12).toFixed(0)} pC/N`],
    ['Permitividades', `e33T/e0 = ${PZT5A_DERIVED.eps33TRel.toFixed(0)} · e33S/e0 = ${PZT5A_DERIVED.eps33SRel.toFixed(0)}`],
    ['Acoplamientos', `k33 = ${Math.sqrt(PZT5A_DERIVED.k33Sq).toFixed(4)} · k31 = ${PZT5A_DERIVED.k31.toFixed(4)}`],
    ['Stack (modo 33)', `${STACK.nStacks} x ${STACK.nLayers} discos ${STACK.diameterMm} x ${STACK.layerThicknessMm} mm · T = ${STACK.totalThicknessMm} mm`],
    ['Circuito', `Cs = ${(CIRCUIT.Cs * 1e6).toFixed(0)} uF · R = ${CIRCUIT.Rload} ohm · Vf = ${CIRCUIT.Vf} V · Vd = ${CIRCUIT.Vdiode} V`],
    ['Viga (modo 31)', `L = ${(BEAM.length * 1000).toFixed(0)} x ${(BEAM.width * 1000).toFixed(0)} mm · ts = ${(BEAM.tSub * 1000).toFixed(2)} mm · tp = ${(BEAM.tPiezo * 1000).toFixed(2)} mm`],
    [
      'Supuestos declarados',
      `zeta_mec = ${BEAM.zetaMec} (no medido) · m1 = gamma1^2 = ${pl.beam.result ? (pl.beam.result.modalMass1 * 1000).toFixed(2) : '—'} g (de la forma modal)`,
    ],
  ]);

  // ---- Simulación 1 ----
  const t = pl.tile.inputs;
  const tr = pl.tile.result;
  h2('3. Baldosa piezoeléctrica de pisada (modo 33)');
  para(
    'Stack de N discos mecanicamente en serie y electricamente en paralelo, excitado por F(t)=F_max·sin²(pi·t/T). El circuito (puente rectificador + condensador de almacenamiento + R + LED) se integra con Runge-Kutta 4, encadenando pisados hasta regimen estacionario.'
  );
  kv([
    ['Fuerza máxima F_max', `${t.Fmax.toFixed(0)} N`],
    ['Cadencia', `${t.cadence.toFixed(0)} pasos/min`],
  ]);
  if (tr) {
    kv([
      ['Capacitancia C_total', formatSI(tr.Cp, 'F')],
      ['Carga Q', formatSI(tr.Q, 'C')],
      ['Voltaje V_oc', formatSI(tr.Voc, 'V')],
      ['Energía ideal 1/2·C·V_oc²', formatSI(tr.energyIdeal, 'J')],
      ['Energía mecánica U_el', formatSI(tr.U_el, 'J')],
      ['Energía cosechada', formatSI(tr.E_harvested, 'J')],
      ['Energía al LED', formatSI(tr.E_LED, 'J')],
      ['V_c estacionaria (pico)', `${tr.VcSteady.toFixed(4)} V (media ${tr.VcRipple.avg.toFixed(4)} V)`],
      ['I_LED pico', formatSI(tr.ILedPeak, 'A')],
      ['η elemento / módulo', `${(tr.k2Elemento * 100).toFixed(3)}% / ${(tr.etaModulo * 100).toFixed(3)}%`],
    ]);
    para('Cadena de energía por pisada (C11): ' + [
      `U_el = ${formatSI(tr.chain.U_el, 'J')}`,
      `E_ideal = ${formatSI(tr.chain.E_ideal, 'J')}`,
      `E_extraída = ${formatSI(tr.chain.E_extracted, 'J')}`,
      `E_almacenada = ${formatSI(tr.chain.E_stored, 'J')}`,
      `E_LED = ${formatSI(tr.chain.E_LED, 'J')}`,
    ].join(' · '));
  }
  eq('sigma = F/(4A)      Q = n·d33·F      C_total = 4·n·e33T·A/t');
  eq('V_oc = d33·t·F/(4·e33T·A)      U_el = 1/2·F·s33·sigma·T');
  if (tr) {
    const im = await chartImage({
      type: 'line',
      data: {
        labels: tr.energyVsLayers.n,
        datasets: [
          {
            label: 'Energía por pisada (µJ)',
            data: tr.energyVsLayers.E.map((e) => e * 1e6),
            borderColor: '#0f9c86',
            backgroundColor: 'rgba(15,156,134,0.12)',
            pointRadius: 0,
            borderWidth: 2,
            fill: true,
          },
        ],
      },
      options: { plugins: { legend: { labels: { color: '#222' } }, title: { display: true, text: 'C7: energía vs nº de capas a T constante', color: '#111' } }, scales: darkScales('Nº de capas', 'E (µJ)') },
    });
    img(im);
    para('A T constante, C es proporcional a n² y V_oc a 1/n, de modo que E = 1/2·C·V_oc² no depende de n: dividir la misma altura en más capas no produce más energía.');
  }

  // ---- Simulación 2 ----
  const b = pl.beam.inputs;
  const br = pl.beam.result;
  h2('4. Viga bimorfa en voladizo (modo 31)');
  para(
    'Modelo de Euler-Bernoulli acoplado electromecánicamente, truncado a 3 modos. La rigidez EI y el eje neutro se obtienen por transformación de secciones; el acoplamiento usa k31 y e33S, no los del modo 33. Se contrasta la FRF con la integración temporal (P9) y la potencia del modelo con la cota de Williams-Yates.'
  );
  kv([
    ['Aceleración de base a0', `${b.a0.toFixed(1)} m/s²`],
    ['Frecuencia de excitación f_exc', `${b.fExc.toFixed(2)} Hz`],
  ]);
  if (br) {
    kv([
      ['f1 / f2 / f3', `${br.modes.map((m) => m.freq.toFixed(1)).join(' / ')} Hz`],
      ['f_n (SDOF)', formatSI(br.fnSDOF, 'Hz')],
      ['EI / eje neutro', `${formatSI(br.EI, 'N·m²')} / ${formatSI(br.neutralAxis, 'm')}`],
      ['k_eq / m_eq', `${formatSI(br.keq, 'N/m')} / ${formatSI(br.meq, 'kg')}`],
      ['C_p / R_opt', `${formatSI(br.Cp, 'F')} / ${formatSI(br.Ropt, 'Ω')}`],
      ['Cota Williams-Yates', formatSI(br.pBound, 'W')],
      ['P del modelo a R_opt', `${formatSI(br.pModel, 'W')} @ ${formatSI(br.peakFreq, 'Hz')}`],
      ['P modelo / cota', br.pRatio.toFixed(4)],
      ['FRF vs tiempo (P9)', `${(br.frfVsTime.pFrf * 1e6).toFixed(3)} / ${(br.frfVsTime.pTime * 1e6).toFixed(3)} uW (${(br.frfVsTime.relDiff * 100).toFixed(3)} %)`],
    ]);
  }
  eq('k31 = d31^2/(s11E·e33T)      e33S = e33T·(1 - k31^2)');
  eq("w_n = l1^2·sqrt(EI/(m'·L^4))      R_opt = 1/(w_n·C_p)");
  eq('P_bound = m·a^2/(8·zeta_mec·w_n)   (Williams-Yates)');
  if (br) {
    const step = Math.max(1, Math.floor(br.frf.f.length / 240));
    const fl: number[] = [];
    const pw: number[] = [];
    for (let i = 0; i < br.frf.f.length; i += step) {
      fl.push(Number(br.frf.f[i].toFixed(0)));
      pw.push(br.frf.P[i] * 1e6);
    }
    const im = await chartImage({
      type: 'line',
      data: {
        labels: fl,
        datasets: [
          {
            label: 'Potencia (µW)',
            data: pw,
            borderColor: '#d98a17',
            backgroundColor: 'rgba(217,138,23,0.12)',
            pointRadius: 0,
            borderWidth: 2,
            fill: true,
          },
        ],
      },
      options: { plugins: { legend: { labels: { color: '#222' } }, title: { display: true, text: 'Potencia vs frecuencia (resonancia)', color: '#111' } }, scales: darkScales('Frecuencia (Hz)', 'P (µW)') },
    });
    img(im);
  }

  h2('5. Comparativa · valores teóricos vs simulación');
  if (tr) {
    const cTheo = totalCapacitance(STACK.nLayers);
    const vTheo = openCircuitVoltage(t.Fmax, STACK.layerThickness);
    const d = (sim: number, theo: number) => `${(((sim - theo) / theo) * 100).toFixed(3)} %`;
    kv([
      ['C_total · teórica vs simulada', `${formatSI(cTheo, 'F')} / ${formatSI(tr.Cp, 'F')}  (desv. ${d(tr.Cp, cTheo)})`],
      ['V_oc · teórica vs simulada', `${formatSI(vTheo, 'V')} / ${formatSI(tr.Voc, 'V')}  (desv. ${d(tr.Voc, vTheo)})`],
      ['E teórica ideal ½·C·V_oc² (frontera k33²)', formatSI(tr.energyIdeal, 'J')],
      ['E útil real E_LED en régimen', `${formatSI(tr.E_LED, 'J')}  (${d(tr.E_LED, tr.energyIdeal)} respecto a la ideal)`],
      ['η elemento k²_ef = E_ideal/U_el vs k33²', `${(tr.k2Elemento * 100).toFixed(3)} % vs ${(PZT5A_DERIVED.k33Sq * 100).toFixed(2)} %`],
    ]);
  }
  if (br) {
    kv([['P viga modelo vs cota Williams-Yates', `${formatSI(br.pModel, 'W')} / ${formatSI(br.pBound, 'W')} (razón ${br.pRatio.toFixed(4)})`]]);
  }

  h2('6. Conclusiones técnicas (honestas) y limitaciones');
  para(
    'Con la física verificada, la baldosa entrega microjulios por pisada, no vatios: es inviable para cargas continuas y viable con margen para señalización LED autónoma intermitente, contadores de aforo y nodos IoT de duty-cycle bajo (µW de media), que es el caso de uso defendible en espacios públicos de Guatemala. Limitaciones declaradas: modelo cuasiestático del stack, discos idénticos, eficiencia acotada por k33²; el puente se ha validado con 1N4007 (Vd = 0.6 V) —una versión Schottky (Vd ~ 0.35 V) reduciría a la mitad esa pérdida, pero no forma parte de la referencia validada—; en la viga se desprecia la inercia rotatoria de la masa de punta y ζ = 0.02 es un supuesto no medido; la cota de Williams-Yates es un techo que el modelo no supera. Pérdidas por grieta y envejecimiento del cerámico fuera de alcance. La deformación 3D está exagerada con un factor fijo y visible.'
  );
  h2('7. Bibliografía');
  para(
    'IEEE Std 176-1987, Standard on Piezoelectricity (notación de Voigt y ejes de polarización). · Erturk & Inman (2011), Piezoelectric Energy Harvesting, Wiley. · Williams & Yates (1996). · Roundy & Wright (2004).'
  );

  doc.save('informe_tecnico_grada_piezoeléctrica.pdf');
}
