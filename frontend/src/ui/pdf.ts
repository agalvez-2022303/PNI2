/** Generación de un PDF descargable con gráficas embebidas (sin depender de la impresión). */
import { jsPDF } from 'jspdf';
import { Chart, registerables } from 'chart.js';
import { formatSI } from '../core/units';
import { TileParams, TileResult, BeamParams, BeamResult } from '../sim/types';

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
  tile: { params: TileParams; result: TileResult | null; piezoName: string };
  beam: { params: BeamParams; result: BeamResult | null; piezoName: string; subName: string };
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

  h1('Informe técnico · Cosecha de energía piezoeléctrica');
  sub(`PiezoLab · Simulación 3D con física rigurosa · Generado el ${new Date().toLocaleString('es-ES')}`);

  // ---- Simulación 1 ----
  const t = pl.tile.params;
  const tr = pl.tile.result;
  h2('1. Baldosa piezoeléctrica de pisada (modo 33)');
  para(
    'Stack de N discos mecánicamente en serie y eléctricamente en paralelo, excitado por F(t)=F_max·sin²(πt/T). El circuito (puente rectificador + condensador de almacenamiento) se integra con Runge-Kutta 4 de paso adaptativo.'
  );
  kv([
    ['Material piezoeléctrico', pl.tile.piezoName],
    ['Nº de capas', `${t.nLayers}`],
    ['Diámetro / espesor disco', `${formatSI(t.diameter, 'm')} / ${formatSI(t.thickness, 'm')}`],
    ['Fuerza máxima', `${t.Fmax.toFixed(0)} N`],
    ['R_load / C_s', `${formatSI(t.Rload, 'Ω')} / ${formatSI(t.Cs, 'F')}`],
  ]);
  if (tr) {
    kv([
      ['Capacitancia C_p', formatSI(tr.Cp, 'F')],
      ['Carga Q', formatSI(tr.Q, 'C')],
      ['Voltaje V_oc', formatSI(tr.Voc, 'V')],
      ['Energía por ciclo', formatSI(tr.energyPerCycle, 'J')],
      ['Energía cosechada', formatSI(tr.energyHarvested, 'J')],
      ['Potencia media', formatSI(tr.avgPower, 'W')],
      ['η teórica / realista', `${(tr.etaTheoretical * 100).toFixed(3)}% / ${(tr.etaRealistic * 100).toFixed(3)}%`],
    ]);
  }
  eq('Q = n · d33 · F      C_p = n · e33T · A / t');
  eq('V_oc = d33 · t · F / (e33T · A)      E = 1/2 · C_p · V_oc^2');
  if (tr) {
    const im = await chartImage({
      type: 'line',
      data: {
        labels: tr.energyVsLayers.n,
        datasets: [
          {
            label: 'Energía por ciclo (nJ)',
            data: tr.energyVsLayers.E.map((e) => e * 1e9),
            borderColor: '#0f9c86',
            backgroundColor: 'rgba(15,156,134,0.12)',
            pointRadius: 0,
            borderWidth: 2,
            fill: true,
          },
        ],
      },
      options: { plugins: { legend: { labels: { color: '#222' } }, title: { display: true, text: 'Energía por ciclo vs Nº de capas', color: '#111' } }, scales: darkScales('Nº de capas', 'E (nJ)') },
    });
    img(im);
  }

  // ---- Simulación 2 ----
  const b = pl.beam.params;
  const br = pl.beam.result;
  h2('2. Viga bimorfa en voladizo (modo 31, Erturk-Inman)');
  para(
    'Modelo de Euler-Bernoulli acoplado electromecánicamente, truncado a 3 modos. La rigidez EI y el eje neutro se obtienen por transformación de secciones. Se reporta la cota teórica de Williams-Yates junto al valor realista con pérdidas.'
  );
  kv([
    ['Piezo / sustrato', `${pl.beam.piezoName} / ${pl.beam.subName}`],
    ['Longitud × ancho', `${formatSI(b.length, 'm')} × ${formatSI(b.width, 'm')}`],
    ['Esp. sustrato / piezo', `${formatSI(b.tSub, 'm')} / ${formatSI(b.tPiezo, 'm')}`],
    ['Masa de punta', `${(b.tipMass * 1000).toFixed(1)} g`],
    ['Aceleración base / ζ_T', `${b.a0.toFixed(1)} m/s² / ${b.zetaT.toFixed(3)}`],
  ]);
  if (br) {
    kv([
      ['f1 / f2 / f3', `${br.modes.map((m) => m.freq.toFixed(1)).join(' / ')} Hz`],
      ['f_n (SDOF)', formatSI(br.fnSDOF, 'Hz')],
      ['EI / eje neutro', `${formatSI(br.EI, 'N·m²')} / ${formatSI(br.neutralAxis, 'm')}`],
      ['C_p / R_opt', `${formatSI(br.Cp, 'F')} / ${formatSI(br.Ropt, 'Ω')}`],
      ['P máx (Williams-Yates)', formatSI(br.pMaxWilliamsYates, 'W')],
      ['P realista (pérdidas)', formatSI(br.pRealistic, 'W')],
      ['P pico modelo (FRF)', `${formatSI(br.pModelPeak, 'W')} @ ${formatSI(br.peakFreq, 'Hz')}`],
    ]);
  }
  eq('f_n = (1/2p)·sqrt(k_eq/m_eq)      R_opt ~ 1/(w_n·C_p)');
  eq('P_max = m·a^2 / (8·zeta_T·w_n)   (Williams-Yates)');
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
      options: { plugins: { legend: { labels: { color: '#222' } }, title: { display: true, text: 'Potencia vs frecuencia (pico de resonancia)', color: '#111' } }, scales: darkScales('Frecuencia (Hz)', 'P (µW)') },
    });
    img(im);
  }

  h2('3. Honestidad y limitaciones');
  para(
    'Todos los valores en SI; se muestran cota teórica y valor realista con pérdidas. Baldosa: cuasiestática, discos idénticos, η a circuito abierto = acoplamiento efectivo k²e. Viga: se desprecia la inercia rotatoria de la masa de punta y se usa acoplamiento lineal; P_max (Williams-Yates) es una cota superior. La deformación 3D está exagerada mediante un factor de escala.'
  );
  h2('4. Bibliografía');
  para(
    'Erturk & Inman (2011), Piezoelectric Energy Harvesting, Wiley. · IEEE Std 176-1987, Standard on Piezoelectricity. · Williams & Yates (1996). · Roundy & Wright (2004).'
  );

  doc.save('informe_piezolab.pdf');
}
