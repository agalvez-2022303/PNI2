/**
 * Informe técnico-científico. Documento formal, estilo de revista técnica:
 * contenedores oscuros de líneas finas, tipografía monoespaciada para datos,
 * sin tarjetas redondeadas. Se exporta a PDF con el mismo contenido
 * (`ui/pdf.ts`) o vía impresión del navegador.
 *
 * Estructura exigida:
 *   0. Resumen ejecutivo y justificación de impacto local (Guatemala).
 *   1. Marco matemático: notación de Voigt y ecuaciones constitutivas
 *      (IEEE Std 176-1987; Erturk & Inman 2011).
 *   2. Baldosa en modo 33 y viga en modo 31: entradas, resultados, cadena.
 *   3. Tabla comparativa: valores teóricos vs resultados de simulación.
 *   4. Conclusiones técnicas honestas sobre viabilidad energética.
 *   5. Bibliografía.
 */
import React, { useState } from 'react';
import { useApp } from './store';
import { ChartJsCanvas, gridScales } from './ChartJsCanvas';
import { formatSI } from '../core/units';
import { generateReportPdf } from './pdf';
import { totalCapacitance, openCircuitVoltage } from '../core/tile';
import { STACK, PZT5A_DERIVED, CIRCUIT, G } from '../core/referenceModel';

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

const Row: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <tr>
    <td className="rep-name">{k}</td>
    <td className="rep-num">{v}</td>
  </tr>
);

/** Comparación teórico vs simulado: desviación con signo, en %. */
const dev = (sim: number, theo: number): string => (theo > 0 ? `${(((sim - theo) / theo) * 100).toFixed(2)} %` : '—');

interface Props {
  /** Flujo de tránsito asumido [personas/hora] para el escalado local. */
  flowPerHour?: number;
}

export const ReportTab: React.FC<Props> = ({ flowPerHour = 100 }) => {
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
      await generateReportPdf({ tile: { inputs: t, result: tr }, beam: { inputs: b, result: br }, flowPerHour });
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
            borderColor: '#0d63c9',
            backgroundColor: 'rgba(56,189,248,0.12)',
            pointRadius: 0,
            borderWidth: 1.5,
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
            borderColor: '#f5a524',
            backgroundColor: 'rgba(245,165,36,0.10)',
            pointRadius: 0,
            borderWidth: 1.5,
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

  const perPerson = tr ? tr.E_harvested * 15 : 0;
  const perDay = tr ? perPerson * flowPerHour * 12 : 0;
  // Columna "teórica" de la comparativa: las mismas fórmulas cerradas del
  // core, evaluadas fuera del solver (la desviación debe ser nula).
  const cTheo = totalCapacitance(STACK.nLayers);
  const vTheo = openCircuitVoltage(t.Fmax, STACK.layerThickness);

  return (
    <div className="rep-doc" data-testid="report-page">
      <div className="rep-inner">
        <div className="rep-actions">
          <button type="button" className="cad-btn" onClick={() => window.print()} data-testid="report-print">
            imprimir
          </button>
          <button type="button" className="cad-btn on" onClick={downloadPdf} disabled={pdfBusy} data-testid="report-pdf">
            {pdfBusy ? 'generando…' : 'exportar PDF'}
          </button>
        </div>

        <h1 className="rep-title">Informe Técnico · Módulo de Grada Piezoeléctrica Cosechadora de Energía</h1>
        <p className="rep-sub">
          PiezoLab · baldosa cosechadora en modo 33 con validación cruzada contra viga bimorfa en modo 31 · generado el{' '}
          {now} · modelo físico congelado en <code>core/referenceModel.ts</code> (PZT-5A, IEEE Std 176-1987)
        </p>

        <div className="rep-authors">
          <div className="rep-author">
            <b>Alberto Josue Alejandro Gálvez</b>
            <span>Simulación · investigación de campo · modelado electrónico · experimentación</span>
          </div>
          <div className="rep-author">
            <b>Luis de Leon</b>
            <span>Investigación · redacción del informe · elaboración del paper</span>
          </div>
        </div>

        <h2>0. Resumen ejecutivo</h2>
        <p>
          Se simula una baldosa de tránsito que convierte la energía elástica de cada pisada en energía eléctrica
          mediante {STACK.nStacks} stacks PZT-5A de {STACK.nLayers} discos en <b>modo 33</b> (campo y esfuerzo a lo
          largo del espesor), con rectificación por puente de diodos, almacenamiento en Cs ={' '}
          {(CIRCUIT.Cs * 1e6).toFixed(0)} µF y carga útil sobre un LED rojo. Todo el cálculo es analítico-numérico
          (RK4 de paso fijo) y verifica conservación de energía por pisada (cota C11) con error menor al 1 % frente a
          los casos de referencia.
        </p>
        {tr && (
          <table className="rep-table">
            <tbody>
              <Row k="Fuerza pico de la pisada" v={`${t.Fmax.toFixed(0)} N (${(t.Fmax / (G * 1.3)).toFixed(0)} kg con factor dinámico 1.3)`} />
              <Row k="Voltaje en vacío V_oc" v={formatSI(tr.Voc, 'V')} />
              <Row k="Energía útil por pisada" v={`${formatSI(tr.E_LED, 'J')} al LED · ${formatSI(tr.E_harvested, 'J')} cosechadas`} />
              <Row k="Energía útil por persona" v={`${formatSI(perPerson, 'J')} (4 baldosas por paso)`} />
              <Row k="Escalado local" v={`${formatSI(perDay, 'J')}/día con ${flowPerHour} personas/h · 12 h activas`} />
            </tbody>
          </table>
        )}
        <h3>Justificación de impacto local (Guatemala)</h3>
        <p>
          El diseño apunta a espacios guatemaltecos de alto flujo peatonal donde el cableado es caro o inexistente:
          mercados municipales, terminales de transporte (Transmetro, Puerta Paradas del sur), universidades y
          hospitales, y escaleras de acceso en zonas rurales con electrificación intermitente. Una fuente de µJ por
          pisada no sustituye a la red: sostiene señalización autónoma de emergencia, contadores de aforo para gestión
          de flujo y nodos IoT de bajo duty-cycle, eliminando baterías y mantenimiento en puntos donde cambiarlas
          cuesta más que el dispositivo.
        </p>

        <h2>1. Marco matemático (notación de Voigt)</h2>
        <p>
          Con la convención de la norma IEEE Std 176-1987, el eje 3 es la dirección de polarización del cerámico y las
          magnitudes de tensor se colapsan a vectores de 6 componentes (11→1, 22→2, 33→3, 23→4, 13→5, 12→6). Las
          ecuaciones constitutivas lineales, en forma matricial de Voigt, son:
        </p>
        <div className="rep-eq">Sᵢ = sᴱᵢⱼ Tⱼ + dₖᵢ Eₖ &nbsp;&nbsp;(i, j = 1…6 ; k = 1…3)</div>
        <div className="rep-eq">Dᵢ = dᵢₖ Tₖ + εᵀᵢⱼ Eⱼ</div>
        <p>
          <b>Baldosa · modo 33.</b> Esfuerzo y campo eléctrico paralelos al espesor: sólo sobreviven los términos 3.
          Con campos uniformes y cargas eléctrica y mecánica ideales,
        </p>
        <div className="rep-eq">S₃ = s₃₃ᴱ T₃ + d₃₃ E₃ &nbsp;&nbsp;·&nbsp;&nbsp; D₃ = d₃₃ T₃ + ε₃₃ᵀ E₃</div>
        <div className="rep-eq">k₃₃² = d₃₃² / (s₃₃ᴱ · ε₃₃ᵀ) = {PZT5A_DERIVED.k33Sq.toFixed(4)} &nbsp;&nbsp;(techo de conversión por pisada)</div>
        <div className="rep-eq">V_oc = d₃₃ · t · F / (4 · ε₃₃ᵀ · A) &nbsp;&nbsp;·&nbsp;&nbsp; U_el = ½ · F · δ &nbsp;&nbsp;·&nbsp;&nbsp; E_ideal = ½ · C_total · V_oc²</div>
        <p>
          <b>Viga bimorfa · modo 31.</b> El esfuerzo es axial (dirección 1) y el campo de polarización (dirección 3);
          el modelo dinámico es Euler–Bernoulli con acoplamiento electromecánico según Erturk &amp; Inman (2011):
        </p>
        <div className="rep-eq">S₁ = s₁₁ᴱ T₁ + d₃₁ E₃ &nbsp;&nbsp;·&nbsp;&nbsp; k₃₁² = d₃₁² / (s₁₁ᴱ · ε₃₃ᵀ) = {PZT5A_DERIVED.k31Sq.toFixed(4)}</div>
        <div className="rep-eq">ε₃₃ˢ = ε₃₃ᵀ (1 − k₃₁²) &nbsp;&nbsp;·&nbsp;&nbsp; R_opt = 1/(ωₙ·C_p) &nbsp;&nbsp;·&nbsp;&nbsp; P ≤ m·a₀²/(8·ζ·ωₙ) (Williams–Yates)</div>

        <h2>2. Resultados de simulación</h2>
        <h3>2.1 Baldosa (modo 33, RK4 encadenado hasta régimen)</h3>
        <table className="rep-table">
          <tbody>
            <Row k="F_max · cadencia" v={`${t.Fmax.toFixed(0)} N · ${t.cadence.toFixed(0)} pasos/min`} />
            <Row k="C_total · Q" v={`${formatSI(tr ? tr.Cp : NaN, 'F')} · ${formatSI(tr ? tr.Q : NaN, 'C')}`} />
            <Row k="V_oc · U_el" v={`${tr ? tr.Voc.toFixed(2) : '—'} V · ${tr ? formatSI(tr.U_el, 'J') : '—'}`} />
            <Row k="E_ideal (teórica con k₃₃²)" v={tr ? formatSI(tr.energyIdeal, 'J') : '—'} />
            <Row k="E_harvested (real tras circuito)" v={tr ? formatSI(tr.E_harvested, 'J') : '—'} />
            <Row k="E_LED (útil)" v={tr ? formatSI(tr.E_LED, 'J') : '—'} />
            <Row k="V_c régimen · I_LED pico" v={`${tr ? tr.VcSteady.toFixed(4) : '—'} V · ${tr ? formatSI(tr.ILedPeak, 'A') : '—'}`} />
            <Row k="η elemento / η módulo" v={tr ? `${(tr.k2Elemento * 100).toFixed(2)} % / ${(tr.etaModulo * 100).toFixed(2)} %` : '—'} />
          </tbody>
        </table>
        {tr && (
          <p className="rep-note">
            Cadena C11 por pisada: U_el {formatSI(tr.chain.U_el, 'J')} → E_ideal {formatSI(tr.chain.E_ideal, 'J')} →
            E_extraída {formatSI(tr.chain.E_extracted, 'J')} → E_almacenada {formatSI(tr.chain.E_stored, 'J')} →
            E_LED {formatSI(tr.chain.E_LED, 'J')}. Cada eslabón es ≤ anterior: la energía teórica ideal
            (acoplamiento k₃₃²) no es la energía útil real, que pierde además en el puente (2·V_d por conducción),
            en la resistencia de carga y en el propio LED.
          </p>
        )}
        {tileEvsN && (
          <div className="rep-fig">
            <div className="rep-fig-title">C7 · energía por pisada frente al nº de capas (T constante)</div>
            <ChartJsCanvas config={tileEvsN} height={190} testId="report-chart-tile" />
          </div>
        )}

        <h3>2.2 Viga bimorfa (modo 31, validación cruzada del acoplamiento)</h3>
        <table className="rep-table">
          <tbody>
            <Row k="a₀ · f_exc" v={`${b.a0.toFixed(1)} m/s² · ${b.fExc.toFixed(2)} Hz`} />
            <Row k="f₁ / f₂ / f₃" v={br ? `${br.modes.map((m) => m.freq.toFixed(1)).join(' / ')} Hz` : '—'} />
            <Row k="C_p · R_opt" v={br ? `${formatSI(br.Cp, 'F')} · ${formatSI(br.Ropt, 'Ω')}` : '—'} />
            <Row k="P modelo vs cota Williams–Yates" v={br ? `${formatSI(br.pModel, 'W')} / ${formatSI(br.pBound, 'W')} (razón ${br.pRatio.toFixed(4)})` : '—'} />
            <Row k="FRF vs tiempo (P9)" v={br ? `${(br.frfVsTime.relDiff * 100).toFixed(3)} % de desviación` : '—'} />
          </tbody>
        </table>
        {beamFRF && (
          <div className="rep-fig">
            <div className="rep-fig-title">Potencia colectada frente a frecuencia de excitación</div>
            <ChartJsCanvas config={beamFRF} height={190} testId="report-chart-beam" />
          </div>
        )}

        <h2>3. Tabla comparativa · teórico vs simulado</h2>
        <table className="rep-table">
          <thead>
            <tr>
              <th>magnitud</th>
              <th className="rep-num">valor teórico</th>
              <th className="rep-num">simulación</th>
              <th className="rep-num">desviación</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Capacidad del elemento · C_total = 4·n·ε₃₃ᵀ·A/t</td>
              <td className="rep-num">{formatSI(totalCapacitance(STACK.nLayers), 'F')}</td>
              <td className="rep-num">{tr ? formatSI(tr.Cp, 'F') : '—'}</td>
              <td className="rep-num">{tr ? dev(tr.Cp, totalCapacitance(STACK.nLayers)) : '—'}</td>
            </tr>
            <tr>
              <td>Voltaje en vacío · V_oc = d₃₃·t·F/(4·ε₃₃ᵀ·A)</td>
              <td className="rep-num">{formatSI(openCircuitVoltage(t.Fmax, STACK.layerThickness), 'V')}</td>
              <td className="rep-num">{tr ? formatSI(tr.Voc, 'V') : '—'}</td>
              <td className="rep-num">{tr ? dev(tr.Voc, openCircuitVoltage(t.Fmax, STACK.layerThickness)) : '—'}</td>
            </tr>
            <tr>
              <td>Energía teórica ideal · ½·C·V_oc² (frontera k₃₃²)</td>
              <td className="rep-num">—</td>
              <td className="rep-num">{tr ? formatSI(tr.energyIdeal, 'J') : '—'}</td>
              <td className="rep-num">{tr ? `${(tr.k2Elemento * 100).toFixed(2)} % de U_el (techo ${(PZT5A_DERIVED.k33Sq * 100).toFixed(2)} %)` : '—'}</td>
            </tr>
            <tr>
              <td>Energía útil real · E_LED tras circuito</td>
              <td className="rep-num">{tr ? formatSI(tr.energyIdeal, 'J') + ' (ideal)' : '—'}</td>
              <td className="rep-num">{tr ? formatSI(tr.E_LED, 'J') : '—'}</td>
              <td className="rep-num">{tr ? dev(tr.E_LED, tr.energyIdeal) : '—'}</td>
            </tr>
            <tr>
              <td>Potencia en resonancia de la viga (modo 31)</td>
              <td className="rep-num">{br ? formatSI(br.pBound, 'W') + ' (cota W–Y)' : '—'}</td>
              <td className="rep-num">{br ? formatSI(br.pModel, 'W') : '—'}</td>
              <td className="rep-num">{br ? dev(br.pModel, br.pBound) : '—'}</td>
            </tr>
          </tbody>
        </table>
        <p className="rep-note">
          Las desviaciones teórico↔simulado de C_total y V_oc son nulas por construcción (misma fórmula cerrada); el
          salto grande es deliberado y honesto: entre la energía ideal de una descarga completa y la energía útil real
          media E_LED en el ciclo estacionario están las pérdidas del puente, Cs y R que el RK4 integra paso a paso.
        </p>

        <h2>4. Conclusiones técnicas (honestas)</h2>
        <p>
          Con la física verificada, la baldosa entrega <b>microjulios por pisada</b>, no vatios. Eso la hace inviable
          para alimentar cargas continuas e <b>viable</b>, con márgenes holgados, para el nicho al que apunta:
          señalización LED autónoma de emergencia (intermitente), contadores de aforo y nodos IoT de duty-cycle bajo,
          donde el consumo medio está en el rango de los µW y la energía cosechada por el tránsito real de{' '}
          {flowPerHour} personas/h cubre el presupuesto con holgura en horas punta. El mensaje es
          deliberadamente sobrio: el sistema no “genera electricidad para el edificio”; elimina baterías y cableado en
          el punto exacto donde hoy se instalan sensores y señales, que es el caso de uso defendible en espacios
          públicos de Guatemala. Limitaciones declaradas: modelo cuasiestático del stack, discos idénticos, ζ de la
          viga no medido (0.02 supuesto), pérdidas por grieta y envejecimiento del cerámico fuera de alcance. El
          puente se ha validado con diodos de uso general 1N4007 (V_d = 0.6 V); sustituirlos por Schottky (V_d ≈ 0.35 V)
          reduciría aproximadamente a la mitad la pérdida del puente, pero esa variante NO forma parte de la
          referencia validada y por eso no se usa en las cifras de este reporte.
        </p>

        <h2>5. Bibliografía</h2>
        <p>
          • IEEE Std 176-1987. <i>IEEE Standard on Piezoelectricity</i> — notación de Voigt, ejes de polarización y
          constantes elásticas/dieléctricas a campo o esfuerzo constante.
          <br />
          • Erturk, A. &amp; Inman, D. J. (2011). <i>Piezoelectric Energy Harvesting</i>. Wiley — viga Euler–Bernoulli
          acoplada en modo 31.
          <br />
          • Williams, C. B. &amp; Yates, R. B. (1996). <i>Analysis of a micro-electric generator for microsystems</i>.
          <br />
          • Roundy, S. &amp; Wright, P. K. (2004). <i>A piezoelectric vibration based generator for wireless electronics</i>.
        </p>
      </div>
    </div>
  );
};
