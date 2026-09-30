import React, { useState } from 'react';
import { useApp } from './store';
import { ChartJsCanvas, gridScales } from './ChartJsCanvas';
import { formatSI } from '../core/units';
import { generateReportPdf } from './pdf';
import { Printer, FileDown, Loader2 } from 'lucide-react';

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

const Row: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <tr>
    <td className="name">{k}</td>
    <td>{v}</td>
  </tr>
);

export const ReportTab: React.FC = () => {
  const app = useApp();
  const t = app.tileParams;
  const tr = app.tileResult;
  const b = app.beamParams;
  const br = app.beamResult;
  const piezoT = app.materials.find((m) => m.id === t.piezoId);
  const piezoB = app.materials.find((m) => m.id === b.piezoId);
  const subB = app.materials.find((m) => m.id === b.substrateId);
  const now = new Date().toLocaleString('es-ES');
  const [pdfBusy, setPdfBusy] = useState(false);
  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      await generateReportPdf({
        tile: { params: t, result: tr, piezoName: piezoT?.name ?? '—' },
        beam: { params: b, result: br, piezoName: piezoB?.name ?? '—', subName: subB?.name ?? '—' },
      });
    } finally {
      setPdfBusy(false);
    }
  };

  const tileEvsN =
    tr &&
    ({
      type: 'line',
      data: {
        labels: tr.energyVsLayers.n,
        datasets: [
          {
            label: 'Energía por ciclo (nJ)',
            data: tr.energyVsLayers.E.map((e) => e * 1e9),
            borderColor: '#35e0c4',
            backgroundColor: 'rgba(53,224,196,0.15)',
            pointRadius: 0,
            borderWidth: 2,
            fill: true,
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: gridScales('Nº de capas', 'E (nJ)') },
    } as any);

  const beamFRF =
    br &&
    ({
      type: 'line',
      data: {
        labels: downsample(br.frf.f, 200).map((f) => f.toFixed(0)),
        datasets: [
          {
            label: 'Potencia (µW)',
            data: downsample(br.frf.P, 200).map((p) => p * 1e6),
            borderColor: '#ffb454',
            backgroundColor: 'rgba(255,180,84,0.12)',
            pointRadius: 0,
            borderWidth: 2,
            fill: true,
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: gridScales('Frecuencia (Hz)', 'P (µW)') },
    } as any);

  return (
    <div className="page report" data-testid="report-page">
      <div className="maxw">
        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
          <button className="btn" onClick={() => window.print()} data-testid="report-print">
            <Printer size={15} /> Imprimir
          </button>
          <button className="btn primary" onClick={downloadPdf} disabled={pdfBusy} data-testid="report-pdf">
            {pdfBusy ? <Loader2 size={15} className="spin" /> : <FileDown size={15} />}
            {pdfBusy ? 'Generando…' : 'Descargar PDF'}
          </button>
        </div>

        <h1>Informe técnico · Cosecha de energía piezoeléctrica</h1>
        <p style={{ marginTop: 2 }}>
          PiezoLab · Simulación 3D con física rigurosa · Generado el {now}
        </p>

        <h2>1. Baldosa piezoeléctrica de pisada (modo 33)</h2>
        <p>
          Modelo de stack de N discos, mecánicamente en serie y eléctricamente en paralelo, excitado por una fuerza de
          pisada F(t) = F_max·sin²(πt/T). El circuito integra un puente rectificador y un condensador de almacenamiento
          resuelto con Runge-Kutta 4 de paso adaptativo.
        </p>
        <div className="grid2">
          <div className="card">
            <div className="section-title">Parámetros</div>
            <table className="data">
              <tbody>
                <Row k="Material piezo" v={piezoT?.name ?? '—'} />
                <Row k="Nº de capas" v={`${t.nLayers}`} />
                <Row k="Diámetro disco" v={formatSI(t.diameter, 'm')} />
                <Row k="Espesor disco" v={formatSI(t.thickness, 'm')} />
                <Row k="Fuerza máxima" v={`${t.Fmax.toFixed(0)} N`} />
                <Row k="R_load / C_s" v={`${formatSI(t.Rload, 'Ω')} · ${formatSI(t.Cs, 'F')}`} />
              </tbody>
            </table>
          </div>
          <div className="card">
            <div className="section-title">Resultados</div>
            {tr && (
              <table className="data">
                <tbody>
                  <Row k="Capacitancia C_p" v={formatSI(tr.Cp, 'F')} />
                  <Row k="Carga Q" v={formatSI(tr.Q, 'C')} />
                  <Row k="Voltaje V_oc" v={formatSI(tr.Voc, 'V')} />
                  <Row k="Energía / ciclo" v={formatSI(tr.energyPerCycle, 'J')} />
                  <Row k="Energía cosechada" v={formatSI(tr.energyHarvested, 'J')} />
                  <Row k="Potencia media" v={formatSI(tr.avgPower, 'W')} />
                  <Row k="η teórica / realista" v={`${(tr.etaTheoretical * 100).toFixed(3)}% / ${(tr.etaRealistic * 100).toFixed(3)}%`} />
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="section-title" style={{ marginTop: 12 }}>Ecuaciones implementadas</div>
        <div className="eqbox">Q = n · d₃₃ · F</div>
        <div className="eqbox">C_p = n · ε₃₃ᵀ · A / t</div>
        <div className="eqbox">V_oc = Q / C_p = d₃₃ · t · F / (ε₃₃ᵀ · A)</div>
        <div className="eqbox">E = ½ · C_p · V_oc²</div>
        {tileEvsN && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="section-title">Energía por ciclo vs número de capas</div>
            <ChartJsCanvas config={tileEvsN} height={220} testId="report-chart-tile" />
          </div>
        )}

        <h2>2. Viga bimorfa en voladizo (modo 31, Erturk-Inman)</h2>
        <p>
          Modelo de Euler-Bernoulli acoplado electromecánicamente, truncado a 3 modos. La rigidez a flexión EI y el eje
          neutro se obtienen por transformación de secciones. Se reporta la cota teórica de Williams-Yates junto al valor
          realista con pérdidas.
        </p>
        <div className="grid2">
          <div className="card">
            <div className="section-title">Parámetros</div>
            <table className="data">
              <tbody>
                <Row k="Piezo / sustrato" v={`${piezoB?.name ?? '—'} / ${subB?.name ?? '—'}`} />
                <Row k="Longitud × ancho" v={`${formatSI(b.length, 'm')} × ${formatSI(b.width, 'm')}`} />
                <Row k="Esp. sustrato / piezo" v={`${formatSI(b.tSub, 'm')} / ${formatSI(b.tPiezo, 'm')}`} />
                <Row k="Masa de punta" v={`${(b.tipMass * 1000).toFixed(1)} g`} />
                <Row k="Aceleración base" v={`${b.a0.toFixed(1)} m/s²`} />
                <Row k="ζ_T / pérdidas" v={`${b.zetaT.toFixed(3)} / ×${b.lossFactor.toFixed(2)}`} />
              </tbody>
            </table>
          </div>
          <div className="card">
            <div className="section-title">Resultados</div>
            {br && (
              <table className="data">
                <tbody>
                  <Row k="f₁ / f₂ / f₃" v={`${br.modes.map((m) => m.freq.toFixed(1)).join(' / ')} Hz`} />
                  <Row k="f_n (SDOF)" v={formatSI(br.fnSDOF, 'Hz')} />
                  <Row k="EI / eje neutro" v={`${formatSI(br.EI, 'N·m²')} / ${formatSI(br.neutralAxis, 'm')}`} />
                  <Row k="C_p / R_opt" v={`${formatSI(br.Cp, 'F')} / ${formatSI(br.Ropt, 'Ω')}`} />
                  <Row k="P máx (Williams-Yates)" v={formatSI(br.pMaxWilliamsYates, 'W')} />
                  <Row k="P realista" v={formatSI(br.pRealistic, 'W')} />
                  <Row k="P pico (modelo FRF)" v={`${formatSI(br.pModelPeak, 'W')} @ ${formatSI(br.peakFreq, 'Hz')}`} />
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="section-title" style={{ marginTop: 12 }}>Ecuaciones implementadas</div>
        <div className="eqbox">f_n = (1/2π)·√(k_eq / m_eq)</div>
        <div className="eqbox">R_opt ≈ 1 / (ω_n · C_p)</div>
        <div className="eqbox">P_max = m · a² / (8 · ζ_T · ω_n)  (Williams-Yates)</div>
        <div className="eqbox">EI = E_ref · Σ [ b*·t³/12 + A*·(z − ȳ)² ]  (transformación de secciones)</div>
        {beamFRF && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="section-title">Potencia vs frecuencia (pico de resonancia)</div>
            <ChartJsCanvas config={beamFRF} height={220} testId="report-chart-beam" />
          </div>
        )}

        <h2>3. Honestidad de los resultados y limitaciones</h2>
        <p>
          Todos los valores se reportan en SI y se muestran tanto la cota teórica como el valor realista con pérdidas. El
          modelo de la baldosa asume comportamiento cuasiestático y discos idénticos; la eficiencia se acota por el
          acoplamiento k₃₃². El modelo de la viga desprecia la inercia rotatoria de la masa de punta y usa acoplamiento
          lineal; la potencia real depende fuertemente de la calidad del circuito de acondicionamiento.
        </p>

        <h2>4. Bibliografía</h2>
        <p>
          • Erturk, A. &amp; Inman, D. J. (2011). <i>Piezoelectric Energy Harvesting</i>. Wiley.
          <br />• IEEE Std 176-1987. <i>IEEE Standard on Piezoelectricity</i>.
          <br />• Williams, C. B. &amp; Yates, R. B. (1996). <i>Analysis of a micro-electric generator for microsystems</i>.
          <br />• Roundy, S. &amp; Wright, P. K. (2004). <i>A piezoelectric vibration based generator for wireless electronics</i>.
        </p>
      </div>
    </div>
  );
};
