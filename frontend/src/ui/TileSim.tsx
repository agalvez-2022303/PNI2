import React, { useMemo, useRef } from 'react';
import uPlot from 'uplot';
import { useApp } from './store';
import { Viewer3D, ViewerHandle } from './Viewer3D';
import { Section, Slider, StatSI, Stat } from './controls';
import { UPlotChart, baseAxes, CHART } from './UPlotChart';
import { formatSI } from '../core/units';
import { RANGES } from '../sim/defaults';
import { exportTileCSV, exportTileSummary } from './exporters';
import { GitCompare, Download, FileJson, Boxes, X, AlertTriangle } from 'lucide-react';
import { PZT5A, PZT5A_DERIVED, STACK, CIRCUIT } from '../core/referenceModel';

function lineOpts(
  xLabel: string,
  yLabel: string,
  series: { label: string; color: string; dash?: number[] }[]
): Omit<uPlot.Options, 'width' | 'height'> {
  return {
    axes: baseAxes(xLabel, yLabel),
    legend: { show: true },
    cursor: { points: { size: 5 } },
    scales: { x: { time: false } },
    series: [
      {},
      ...series.map((s) => ({
        label: s.label,
        stroke: s.color,
        width: 1.7,
        dash: s.dash,
        points: { show: false },
      })),
    ],
  };
}

const ChartCard: React.FC<{ title: string; sub?: string; children: React.ReactNode }> = ({ title, sub, children }) => (
  <div className="chart-card">
    <h4>
      {title}
      {sub && <span>{sub}</span>}
    </h4>
    <div className="chart-body">{children}</div>
  </div>
);

export const TileSim: React.FC = () => {
  const app = useApp();
  const p = app.tileInputs;
  const r = app.tileResult;
  const cmp = app.tileCompare;
  const viewerRef = useRef<ViewerHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const seriesV: uPlot.AlignedData = useMemo(
    () => (r ? [r.series.t, r.series.Vcs, r.series.Vp] : [[], [], []]),
    [r]
  );
  const seriesP: uPlot.AlignedData = useMemo(() => (r ? [r.series.t, r.series.P] : [[], []]), [r]);
  const seriesE: uPlot.AlignedData = useMemo(() => (r ? [r.series.t, r.series.Estored] : [[], []]), [r]);
  const seriesF: uPlot.AlignedData = useMemo(() => (r ? [r.series.t, r.series.F] : [[], []]), [r]);
  const seriesN: uPlot.AlignedData = useMemo(() => {
    if (!r) return [[], []];
    if (cmp) return [r.energyVsLayers.n, r.energyVsLayers.E, cmp.result.energyVsLayers.E];
    return [r.energyVsLayers.n, r.energyVsLayers.E];
  }, [r, cmp]);

  // C8: el factor de exageración del render es fijo y se muestra siempre.
  const hud = r
    ? [
        { k: 'V circuito abierto', v: formatSI(r.Voc, 'V') },
        { k: 'E ideal / paso', v: formatSI(r.energyIdeal, 'J') },
        { k: 'Deformación ×' + r.renderExaggeration, v: formatSI(r.compression * r.renderExaggeration, 'm') },
      ]
    : [];

  return (
    <div className="layout">
      <div className="sidebar" data-testid="tile-sidebar">
        <Section title="Modelo fijo (no editable)">
          <div className="hint mono" data-testid="tile-model">
            PZT-5H · d₃₃ = {(PZT5A.d33 * 1e12).toFixed(0)} pC/N · ε₃₃ᵀ/ε₀ = {PZT5A_DERIVED.eps33TRel.toFixed(0)} · k₃₃ ={' '}
            {Math.sqrt(PZT5A_DERIVED.k33Sq).toFixed(3)}
            <br />
            {STACK.nStacks} stacks · {STACK.nLayers} discos de Ø{STACK.diameterMm} × {STACK.layerThicknessMm} mm · T ={' '}
            {STACK.totalThicknessMm} mm
            <br />
            C_s = {(CIRCUIT.Cs * 1e6).toFixed(0)} µF · R = {CIRCUIT.Rload} Ω · V_f = {CIRCUIT.Vf} V · 2V_d ={' '}
            {(2 * CIRCUIT.Vdiode).toFixed(1)} V
          </div>
        </Section>

        <Section title="Excitación de pisada">
          <Slider
            label="Fuerza máxima F_max"
            value={p.Fmax}
            min={RANGES.tile.Fmax.min}
            max={RANGES.tile.Fmax.max}
            step={RANGES.tile.Fmax.step}
            onChange={(v) => app.patchTile({ Fmax: v })}
            display={`${p.Fmax.toFixed(0)} N`}
            testId="tile-fmax"
          />
          <Slider
            label="Cadencia de pisado"
            value={p.cadence}
            min={RANGES.tile.cadence.min}
            max={RANGES.tile.cadence.max}
            step={RANGES.tile.cadence.step}
            onChange={(v) => app.patchTile({ cadence: v })}
            display={`${p.cadence.toFixed(0)} pasos/min`}
            testId="tile-cadence"
          />
        </Section>

        {r && r.alerts.length > 0 && (
          <Section title="Alertas de seguridad">
            {r.alerts.map((a) => (
              <div className="alert" key={a.code} data-testid={`tile-alert-${a.code}`} role="alert">
                <AlertTriangle size={14} />
                <span>{a.message}</span>
              </div>
            ))}
          </Section>
        )}

        {r && (
          <Section title="Resultados analíticos">
            <div className="stat-grid">
              <StatSI
                label="Capacitancia C_total"
                value={r.Cp}
                unit="F"
                cls="accent"
                eq="C = 4 · n · ε₃₃ᵀ · A / t"
                source="IEEE Std 176-1987"
                testId="tile-res-cp"
              />
              <StatSI
                label="Carga Q en el pico"
                value={r.Q}
                unit="C"
                eq="Q = n · d₃₃ · F"
                note="Modo 33: la carga no depende de la geometría."
                testId="tile-res-q"
              />
              <StatSI
                label="Voltaje V_oc en circuito abierto"
                value={r.Voc}
                unit="V"
                cls="accent"
                eq="V_oc = d₃₃ · t · F / (4 · ε₃₃ᵀ · A)"
                source="Roundy & Wright 2004"
                testId="tile-res-voc"
              />
              <StatSI
                label="Energía ideal ½·C·V_oc²"
                value={r.energyIdeal}
                unit="J"
                eq="E_ideal = ½ · C_total · V_oc²"
                testId="tile-res-e"
              />
              <StatSI
                label="Energía eléctrica U_el"
                value={r.U_el}
                unit="J"
                eq="U_el = ½ · F · δ = ½ · F · s₃₃ · F/(4A) · T"
                testId="tile-res-uel"
              />
              <StatSI
                label="Energía cosechada (LED + R)"
                value={r.E_harvested}
                unit="J"
                cls="amber"
                eq="E = E_LED + E_R"
                note="régimen estacionario, último pisada"
                testId="tile-res-eh"
              />
              <StatSI
                label="Energía al LED por pisada"
                value={r.E_LED}
                unit="J"
                eq="E_LED = ∫ V_f · I_LED dt"
                testId="tile-res-led"
              />
              <StatSI
                label="V_c en régimen estacionario"
                value={r.VcSteady}
                unit="V"
                eq="pico del rizado de C_s"
                note={`min ${r.VcRipple.min.toFixed(3)} V · media ${r.VcRipple.avg.toFixed(3)} V`}
                testId="tile-res-vc"
              />
              <StatSI
                label="Corriente pico del LED"
                value={r.ILedPeak}
                unit="A"
                eq="I_LED = (V_c − V_f) / R"
                testId="tile-res-iled"
              />
              <StatSI
                label="Potencia media al LED"
                value={r.avgPowerLED}
                unit="W"
                eq="P = E_LED · cadencia / 60"
                testId="tile-res-p"
              />
              <StatSI
                label="Esfuerzo por stack"
                value={r.stress}
                unit="Pa"
                eq="σ = F / (4 · A)"
                testId="tile-res-sigma"
              />
              <StatSI
                label="Aplastamiento δ en el pico"
                value={r.compression}
                unit="m"
                eq="δ = s₃₃ · σ · T"
                testId="tile-res-delta"
              />
              <Stat
                label="η elemento k²"
                value={(r.k2Elemento * 100).toFixed(3) + ' %'}
                eq="k²ₑ = E_ideal / U_el = d₃₃² · Y₃₃ / ε₃₃ᵀ"
                testId="tile-res-k2"
              />
              <Stat
                label="η módulo (con circuito)"
                value={(r.etaModulo * 100).toFixed(3) + ' %'}
                cls="amber"
                eq="η = E_cosechada / U_el"
                note="incluye pérdidas de diodos, Cs y R"
                testId="tile-res-etar"
              />
            </div>
          </Section>
        )}

        <div className="btn-row">
          <button className="btn" onClick={app.saveTileCompare} data-testid="tile-compare">
            <GitCompare size={14} /> Comparar
          </button>
          <button className="btn ghost" onClick={app.clearTileCompare} disabled={!cmp} data-testid="tile-compare-clear">
            <X size={14} /> Limpiar
          </button>
        </div>
        {cmp && (
          <div className="hint" data-testid="tile-compare-label">
            Comparando con: <b style={{ color: 'var(--violet)' }}>{cmp.label}</b>
          </div>
        )}
        <div className="btn-row">
          <button className="btn sm" onClick={() => r && exportTileCSV(p, r)} disabled={!r} data-testid="tile-export-csv">
            <Download size={13} /> CSV
          </button>
          <button className="btn sm" onClick={() => r && exportTileSummary(p, r)} disabled={!r} data-testid="tile-export-json">
            <FileJson size={13} /> JSON
          </button>
        </div>
        <button className="btn sm" onClick={() => viewerRef.current?.exportSTL('baldosa.stl')} data-testid="tile-export-stl">
          <Boxes size={13} /> Exportar geometría STL
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".stl,.gltf,.glb"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files?.[0] && viewerRef.current?.importShell(e.target.files[0])}
        />
      </div>

      <div className="stage">
        <Viewer3D ref={viewerRef} kind="tile" tileInputs={p} tileResult={r} hud={hud} />
        <div className="charts" data-testid="tile-charts">
          <ChartCard title="Fuerza de pisada F(t) = F_max·sin²(π t/T_p)" sub="N">
            <UPlotChart data={seriesF} opts={lineOpts('t (s)', 'F (N)', [{ label: 'F', color: CHART.violet }])} redrawKey="tf" />
          </ChartCard>
          <ChartCard title="Voltaje V(t)" sub="almacenamiento / piezo">
            <UPlotChart
              data={seriesV}
              opts={lineOpts('t (s)', 'V (V)', [
                { label: 'V_cs', color: CHART.accent },
                { label: 'V_p', color: CHART.amber },
              ])}
              redrawKey="tv"
            />
          </ChartCard>
          <ChartCard title="Potencia al LED P(t)" sub="W">
            <UPlotChart data={seriesP} opts={lineOpts('t (s)', 'P (W)', [{ label: 'P', color: CHART.accent }])} redrawKey="tp" />
          </ChartCard>
          <ChartCard title="Energía almacenada en C_s" sub="J">
            <UPlotChart data={seriesE} opts={lineOpts('t (s)', 'E (J)', [{ label: 'E', color: CHART.green }])} redrawKey="te" />
          </ChartCard>
          <ChartCard title="E / pisada vs nº de capas a T constante" sub={cmp ? 'comparación' : 'C7'}>
            <UPlotChart
              data={seriesN}
              opts={lineOpts(
                'N capas',
                'E (J)',
                cmp
                  ? [
                      { label: 'actual', color: CHART.accent },
                      { label: cmp.label, color: CHART.violet, dash: [5, 3] },
                    ]
                  : [{ label: 'E', color: CHART.accent }]
              )}
              redrawKey={cmp ? 'tn-cmp' : 'tn'}
            />
          </ChartCard>
        </div>
      </div>
    </div>
  );
};
