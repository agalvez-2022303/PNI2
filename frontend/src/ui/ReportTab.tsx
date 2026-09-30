import React, { useState } from 'react';
import { useApp } from './store';
import { ChartJsCanvas, gridScales } from './ChartJsCanvas';
import { formatSI } from '../core/units';
import { generateReportPdf } from './pdf';
import { Printer, FileDown, Loader2 } from 'lucide-react';
import { STACK, BEAM, PZT5A, PZT5A_DERIVED, CIRCUIT } from '../core/referenceModel';

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
  const t = app.tileInputs;
  const tr = app.tileResult;
  const b = app.beamInputs;
  const br = app.beamResult;
  const now = new Date().toLocaleString('es-ES');
  const [pdfBusy, setPdfBusy] = useState(false);
  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      await generateReportPdf({ tile: { inputs: t, result: tr }, beam: { inputs: b, result: br } });
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
            label: 'Energía por pisada (µJ)',
            data: tr.energyVsLayers.E.map((e) => e * 1e6),
            borderColor: '#35e0c4',
            backgroundColor: 'rgba(53,224,196,0.15)',
            pointRadius: 0,
            borderWidth: 2,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: gridScales('Nº de capas a T constante', 'E (µJ)'),
      },
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
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: gridScales('Frecuencia (Hz)', 'P (µW)'),
      },
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

        <h2>0. Modelo de referencia (no editable)</h2>
        <p>
          Todo el modelo físico está congelado en <code>core/referenceModel.ts</code>. El usuario sólo puede modificar la
          excitación: F_max y cadencia en la baldosa, a0 y f_exc en la viga.
        </p>
        <table className="data">
          <tbody>
            <Row k="Piezoeléctrico" v={`PZT-5H · d₃₃ = ${(PZT5A.d33 * 1e12).toFixed(0)} pC/N · d₃₁ = ${(PZT5A.d31 * 1e12).toFixed(0)} pC/N`} />
            <Row k="Permitividades" v={`ε₃₃ᵀ/ε₀ = ${PZT5A_DERIVED.eps33TRel.toFixed(0)} · ε₃₃ˢ/ε₀ = ${PZT5A_DERIVED.eps33SRel.toFixed(0)}`} />
            <Row
              k="Acoplamientos"
              v={`k₃₃ = ${Math.sqrt(PZT5A_DERIVED.k33Sq).toFixed(4)} · k₃₁ = ${PZT5A_DERIVED.k31.toFixed(4)}`}
            />
            <Row
              k="Stack (modo 33)"
              v={`${STACK.nStacks} stacks × ${STACK.nLayers} discos Ø${STACK.diameterMm} × ${STACK.layerThicknessMm} mm · T = ${STACK.totalThicknessMm} mm`}
            />
            <Row
              k="Circuito"
              v={`C_s = ${(CIRCUIT.Cs * 1e6).toFixed(0)} µF · R = ${CIRCUIT.Rload} Ω · V_f = ${CIRCUIT.Vf} V · V_d = ${CIRCUIT.Vdiode} V`}
            />
            <Row
              k="Viga (modo 31)"
              v={`L = ${(BEAM.length * 1000).toFixed(0)} × ${(BEAM.width * 1000).toFixed(0)} mm · t_s = ${(BEAM.tSub * 1000).toFixed(2)} mm · t_p = ${(BEAM.tPiezo * 1000).toFixed(2)} mm · M_t = ${(BEAM.tipMass * 1000).toFixed(1)} g`}
            />
            <Row
              k="Supuestos declarados"
              v={`ζ_mec = ${BEAM.zetaMec} (no medido) · m₁ = γ₁² = ${br ? (br.modalMass1 * 1000).toFixed(2) : '—'} g (calculada de la forma modal)`}
            />
          </tbody>
        </table>

        <h2>1. Baldosa piezoeléctrica de pisada (modo 33)</h2>
        <p>
          Stack de N discos, mecánicamente en serie y eléctricamente en paralelo, excitado por una fuerza de pisada
          F(t) = F_max·sin²(πt/T_p). El circuito integra el puente rectificador, el condensador de almacenamiento Cs, la
          resistencia y el LED con Runge-Kutta 4 de paso fijo, encadenando pisados hasta régimen estacionario.
        </p>
        <div className="grid2">
          <div className="card">
            <div className="section-title">Entradas del usuario</div>
            <table className="data">
              <tbody>
                <Row k="Fuerza máxima F_max" v={`${t.Fmax.toFixed(0)} N`} />
                <Row k="Cadencia" v={`${t.cadence.toFixed(0)} pasos/min`} />
              </tbody>
            </table>
          </div>
          <div className="card">
            <div className="section-title">Resultados</div>
            {tr && (
              <table className="data">
                <tbody>
                  <Row k="Capacitancia C_total" v={formatSI(tr.Cp, 'F')} />
                  <Row k="Carga Q" v={formatSI(tr.Q, 'C')} />
                  <Row k="Voltaje V_oc" v={formatSI(tr.Voc, 'V')} />
                  <Row k="Energía ideal ½CV²" v={formatSI(tr.energyIdeal, 'J')} />
                  <Row k="Energía U_el" v={formatSI(tr.U_el, 'J')} />
                  <Row k="Energía cosechada" v={formatSI(tr.E_harvested, 'J')} />
                  <Row k="Energía al LED" v={formatSI(tr.E_LED, 'J')} />
                  <Row k="V_c estacionaria (pico)" v={`${tr.VcSteady.toFixed(4)} V (media ${tr.VcRipple.avg.toFixed(4)} V)`} />
                  <Row k="I_LED pico" v={formatSI(tr.ILedPeak, 'A')} />
                  <Row k="η elemento / módulo" v={`${(tr.k2Elemento * 100).toFixed(3)}% / ${(tr.etaModulo * 100).toFixed(3)}%`} />
                </tbody>
              </table>
            )}
          </div>
        </div>
        {tr && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="section-title">Cadena de energía de un pisada (C11)</div>
            <table className="data">
              <tbody>
                <Row k="U_el" v={formatSI(tr.chain.U_el, 'J')} />
                <Row k="E_ideal" v={formatSI(tr.chain.E_ideal, 'J')} />
                <Row k="E_extraída" v={formatSI(tr.chain.E_extracted, 'J')} />
                <Row k="E_almacenada" v={formatSI(tr.chain.E_stored, 'J')} />
                <Row k="E_LED" v={formatSI(tr.chain.E_LED, 'J')} />
              </tbody>
            </table>
            <p style={{ marginTop: 6 }}>
              La cadena es monótona decreciente: cada eslabón es menor o igual que el anterior. U_el es la energía
              mecánica almacenada en el pisada, E_ideal el máximo ½·C·V_oc², E_extraída lo que sale del terminal del
              piezo, E_almacenada la parte que llega al nodo Cs+R+LED, y E_LED la que consume el diodo.
            </p>
          </div>
        )}
        <div className="section-title" style={{ marginTop: 12 }}>Ecuaciones implementadas</div>
        <div className="eqbox">σ = F / (4 · A)</div>
        <div className="eqbox">Q = n · d₃₃ · F</div>
        <div className="eqbox">C_total = 4 · n · ε₃₃ᵀ · A / t</div>
        <div className="eqbox">V_oc = d₃₃ · t · F / (4 · ε₃₃ᵀ · A)</div>
        <div className="eqbox">U_el = ½ · F · δ = ½ · F · s₃₃ · σ · T</div>
        <div className="eqbox">E_ideal = ½ · C_total · V_oc²</div>
        {tileEvsN && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="section-title">C7: energía por pisada frente al nº de capas a altura total constante</div>
            <ChartJsCanvas config={tileEvsN} height={220} testId="report-chart-tile" />
            <p style={{ marginTop: 6 }}>
              A T constante, C ∝ n² y V_oc ∝ 1/n, de modo que E = ½·C·V_oc² no depende de n: dividir la misma altura en
              más capas no produce más energía.
            </p>
          </div>
        )}

        <h2>2. Viga bimorfa en voladizo (modo 31)</h2>
        <p>
          Modelo de Euler-Bernoulli acoplado electromecánicamente y truncado a 3 modos. La rigidez a flexión EI y el eje
          neutro salen por transformación de secciones; el acoplamiento usa k₃₁ y ε₃₃ˢ, no los del modo 33. Se contrasta
          la FRF con la integración temporal en resonancia (P9) y la potencia del modelo con la cota de Williams–Yates.
        </p>
        <div className="grid2">
          <div className="card">
            <div className="section-title">Entradas del usuario</div>
            <table className="data">
              <tbody>
                <Row k="Aceleración de base a0" v={`${b.a0.toFixed(1)} m/s²`} />
                <Row k="Frecuencia f_exc" v={`${b.fExc.toFixed(2)} Hz`} />
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
                  <Row k="k_eq / m_eq" v={`${formatSI(br.keq, 'N/m')} / ${formatSI(br.meq, 'kg')}`} />
                  <Row k="C_p / R_opt" v={`${formatSI(br.Cp, 'F')} / ${formatSI(br.Ropt, 'Ω')}`} />
                  <Row k="Cota Williams–Yates" v={formatSI(br.pBound, 'W')} />
                  <Row k="P del modelo a R_opt" v={`${formatSI(br.pModel, 'W')} @ ${formatSI(br.peakFreq, 'Hz')}`} />
                  <Row k="P modelo / cota" v={br.pRatio.toFixed(4)} />
                  <Row k="FRF vs tiempo (P9)" v={`${(br.frfVsTime.pFrf * 1e6).toFixed(3)} / ${(br.frfVsTime.pTime * 1e6).toFixed(3)} µW (${(br.frfVsTime.relDiff * 100).toFixed(3)} %)`} />
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="section-title" style={{ marginTop: 12 }}>Ecuaciones implementadas</div>
        <div className="eqbox">k₃₁ = d₃₁² / (s₁₁ᴱ · ε₃₃ᵀ)   ·   ε₃₃ˢ = ε₃₃ᵀ (1 − k₃₁²)</div>
        <div className="eqbox">ω_n = λ₁² · √(EI / (m' · L⁴))</div>
        <div className="eqbox">R_opt = 1 / (ω_n · C_p)</div>
        <div className="eqbox">P_bound = m · a² / (8 · ζ_mec · ω_n)   (Williams–Yates)</div>
        <div className="eqbox">EI = Σ Eᵢ · [ b·t³/12 + A·d² ]   (transformación de secciones)</div>
        {beamFRF && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="section-title">Potencia vs frecuencia (resonancia)</div>
            <ChartJsCanvas config={beamFRF} height={220} testId="report-chart-beam" />
          </div>
        )}

        <h2>3. Honestidad de los resultados y limitaciones</h2>
        <p>
          Todos los valores se reportan en SI y se muestran tanto la cota teórica como el valor del modelo. La baldosa
          asume comportamiento cuasiestático y discos idénticos; su eficiencia queda acotada por k₃₃². La viga desprecia
          la inercia rotatoria de la masa de punta y usa acoplamiento lineal, y su amortiguamiento mecánico ζ = 0.02 es un
          supuesto no medido. La potencia real depende fuertemente de la calidad del circuito de acondicionamiento.
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
