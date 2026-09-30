import React, { useMemo, useRef } from 'react';
import uPlot from 'uplot';
import { useApp } from './store';
import { Viewer3D, ViewerHandle } from './Viewer3D';
import { Section, Slider, Select, Toggle, StatSI, Stat } from './controls';
import { UPlotChart, baseAxes, CHART } from './UPlotChart';
import { formatSI } from '../core/units';
import { RANGES } from '../sim/defaults';
import { exportTileCSV, exportTileSummary } from './exporters';
import { GitCompare, Download, FileJson, Boxes, X } from 'lucide-react';

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
  const p = app.tileParams;
  const r = app.tileResult;
  const cmp = app.tileCompare;
  const viewerRef = useRef<ViewerHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const piezo = app.materials.find((m) => m.id === p.piezoId);

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

  const hud = r
    ? [
        { k: 'V circuito abierto', v: formatSI(r.Voc, 'V') },
        { k: 'Energía / paso', v: formatSI(r.energyPerCycle, 'J') },
        { k: 'η realista', v: (r.etaRealistic * 100).toFixed(3) + ' %' },
      ]
    : [];

  return (
    <div className="layout">
      <div className="sidebar" data-testid="tile-sidebar">
        <Section title="Material piezoeléctrico">
          <Select
            label="Cerámica / polímero"
            value={p.piezoId}
            onChange={(v) => app.patchTile({ piezoId: v })}
            options={app.piezos.map((m) => ({ value: m.id, label: m.name }))}
            testId="tile-material"
          />
          {piezo && (
            <div className="hint mono">
              d33 = {(piezo.d33 * 1e12).toFixed(0)} pC/N · ε_r = {piezo.epsR} · k33 = {piezo.k33}
            </div>
          )}
        </Section>

        <Section title="Geometría del stack">
          <Slider
            label="Nº de capas (discos)"
            value={p.nLayers}
            min={RANGES.tile.nLayers.min}
            max={RANGES.tile.nLayers.max}
            step={1}
            onChange={(v) => app.patchTile({ nLayers: Math.round(v) })}
            display={`${p.nLayers}`}
            testId="tile-nlayers"
          />
          <Slider
            label="Diámetro del disco"
            value={p.diameter * 1000}
            min={RANGES.tile.diameterMm.min}
            max={RANGES.tile.diameterMm.max}
            step={RANGES.tile.diameterMm.step}
            onChange={(v) => app.patchTile({ diameter: v / 1000 })}
            display={`${(p.diameter * 1000).toFixed(1)} mm`}
            testId="tile-diameter"
          />
          <Slider
            label="Espesor del disco"
            value={p.thickness * 1000}
            min={RANGES.tile.thicknessMm.min}
            max={RANGES.tile.thicknessMm.max}
            step={RANGES.tile.thicknessMm.step}
            onChange={(v) => app.patchTile({ thickness: v / 1000 })}
            display={`${(p.thickness * 1000).toFixed(2)} mm`}
            testId="tile-thickness"
          />
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
          <Toggle
            label="Modo caminata (varios pasos)"
            value={p.walkMode}
            onChange={(v) => app.patchTile({ walkMode: v })}
            testId="tile-walkmode"
          />
          {p.walkMode && (
            <>
              <Slider
                label="Frecuencia de zancada"
                value={p.walkFreq}
                min={RANGES.tile.walkFreq.min}
                max={RANGES.tile.walkFreq.max}
                step={RANGES.tile.walkFreq.step}
                onChange={(v) => app.patchTile({ walkFreq: v })}
                display={`${p.walkFreq.toFixed(1)} Hz`}
                testId="tile-walkfreq"
              />
              <Slider
                label="Nº de pasos"
                value={p.walkSteps}
                min={RANGES.tile.walkSteps.min}
                max={RANGES.tile.walkSteps.max}
                step={1}
                onChange={(v) => app.patchTile({ walkSteps: Math.round(v) })}
                display={`${p.walkSteps}`}
                testId="tile-walksteps"
              />
            </>
          )}
        </Section>

        <Section title="Circuito de cosecha">
          <Slider
            label="Resistencia de carga R_load"
            value={Math.log10(p.Rload)}
            min={3}
            max={7}
            step={0.05}
            onChange={(v) => app.patchTile({ Rload: Math.pow(10, v) })}
            display={formatSI(p.Rload, 'Ω')}
            testId="tile-rload"
          />
          <Slider
            label="Capacitor de almacenamiento C_s"
            value={Math.log10(p.Cs)}
            min={-7}
            max={-2}
            step={0.05}
            onChange={(v) => app.patchTile({ Cs: Math.pow(10, v) })}
            display={formatSI(p.Cs, 'F')}
            testId="tile-cs"
          />
          <div className="inline-2">
            <Slider
              label="Caída por diodo"
              value={p.Vdiode}
              min={0.2}
              max={1}
              step={0.05}
              onChange={(v) => app.patchTile({ Vdiode: v })}
              display={`${p.Vdiode.toFixed(2)} V`}
              testId="tile-vdiode"
            />
            <Slider
              label="Nº diodos (puente)"
              value={p.nDiodes}
              min={1}
              max={4}
              step={1}
              onChange={(v) => app.patchTile({ nDiodes: Math.round(v) })}
              display={`${p.nDiodes}`}
              testId="tile-ndiodes"
            />
          </div>
        </Section>

        <Section title="Visualización">
          <Slider
            label="Factor de escala (deformación)"
            value={p.scaleFactor}
            min={RANGES.tile.scaleFactor.min}
            max={RANGES.tile.scaleFactor.max}
            step={1}
            onChange={(v) => app.patchTile({ scaleFactor: v })}
            display={`×${p.scaleFactor.toFixed(0)}`}
            testId="tile-scale"
          />
        </Section>

        {r && (
          <Section title="Resultados analíticos">
            <div className="stat-grid">
              <StatSI
                label="Capacitancia C_p"
                value={r.Cp}
                unit="F"
                cls="accent"
                eq="C_p = n · ε₃₃ᵀ · A / t"
                source="IEEE Std 176-1987"
                testId="tile-res-cp"
              />
              <StatSI
                label="Carga Q"
                value={r.Q}
                unit="C"
                eq="Q = n · d₃₃ · F"
                source="Modo 33"
                testId="tile-res-q"
              />
              <StatSI
                label="Voltaje V_oc"
                value={r.Voc}
                unit="V"
                cls="accent"
                eq="V_oc = d₃₃ · t · F / (ε₃₃ᵀ · A)"
                source="Roundy & Wright 2004"
                testId="tile-res-voc"
              />
              <StatSI
                label="Energía / ciclo"
                value={r.energyPerCycle}
                unit="J"
                eq="E = ½ · C_p · V_oc²"
                testId="tile-res-e"
              />
              <StatSI
                label="Energía cosechada"
                value={r.energyHarvested}
                unit="J"
                cls="amber"
                eq="∫ V²/R dt + ½C_s·V_cs²"
                note="entregada a la carga + almacenada"
                testId="tile-res-eh"
              />
              <StatSI
                label="Potencia media"
                value={r.avgPower}
                unit="W"
                eq="P = E_cosechada / t_total"
                testId="tile-res-p"
              />
              <Stat
                label="η teórica"
                value={(r.etaTheoretical * 100).toFixed(3) + ' %'}
                eq="η = E_generada / U_mecánica = k²ₑ = d₃₃²·Y/ε₃₃ᵀ"
                note={`acoplamiento efectivo k²ₑ = ${(r.maxCoupling * 100).toFixed(1)}% (a circuito abierto)`}
                testId="tile-res-etat"
              />
              <Stat
                label="η realista"
                value={(r.etaRealistic * 100).toFixed(3) + ' %'}
                cls="amber"
                eq="η = E_cosechada / E_mecánica"
                note="con pérdidas del circuito"
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
        <Viewer3D ref={viewerRef} kind="tile" tileParams={p} tileResult={r} hud={hud} />
        <div className="charts" data-testid="tile-charts">
          <ChartCard title="Fuerza de pisada F(t)" sub="N">
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
          <ChartCard title="Potencia P(t)" sub="W">
            <UPlotChart data={seriesP} opts={lineOpts('t (s)', 'P (W)', [{ label: 'P', color: CHART.accent }])} redrawKey="tp" />
          </ChartCard>
          <ChartCard title="Energía en el capacitor" sub="J">
            <UPlotChart data={seriesE} opts={lineOpts('t (s)', 'E (J)', [{ label: 'E', color: CHART.green }])} redrawKey="te" />
          </ChartCard>
          <ChartCard title="Energía / ciclo vs Nº capas" sub={cmp ? 'comparación' : ''}>
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
