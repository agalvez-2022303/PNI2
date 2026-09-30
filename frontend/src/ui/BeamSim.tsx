import React, { useEffect, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import { useApp } from './store';
import { Viewer3D, ViewerHandle } from './Viewer3D';
import { Section, Slider, Select, StatSI, Stat } from './controls';
import { UPlotChart, UPlotHandle, baseAxes, CHART, vLinePlugin } from './UPlotChart';
import { formatSI } from '../core/units';
import { RANGES } from '../sim/defaults';
import { exportBeamCSV, exportBeamSummary } from './exporters';
import { GitCompare, Download, FileJson, Boxes, X, Radio, Square } from 'lucide-react';

function lineOpts(
  xLabel: string,
  yLabel: string,
  series: { label: string; color: string; dash?: number[] }[],
  logX = false,
  plugins: uPlot.Plugin[] = []
): Omit<uPlot.Options, 'width' | 'height'> {
  return {
    axes: baseAxes(xLabel, yLabel),
    legend: { show: true },
    cursor: { points: { size: 5 } },
    plugins,
    scales: { x: logX ? { distr: 3 } : { time: false } },
    series: [
      {},
      ...series.map((s) => ({ label: s.label, stroke: s.color, width: 1.7, dash: s.dash, points: { show: false } })),
    ],
  };
}

function resample(srcX: number[], srcY: number[], dstX: number[]): number[] {
  return dstX.map((x) => {
    if (x <= srcX[0]) return srcY[0];
    if (x >= srcX[srcX.length - 1]) return srcY[srcY.length - 1];
    let i = 1;
    while (i < srcX.length && srcX[i] < x) i++;
    const f = (x - srcX[i - 1]) / (srcX[i] - srcX[i - 1]);
    return srcY[i - 1] * (1 - f) + srcY[i] * f;
  });
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

export const BeamSim: React.FC = () => {
  const app = useApp();
  const p = app.beamParams;
  const r = app.beamResult;
  const cmp = app.beamCompare;
  const viewerRef = useRef<ViewerHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [modeIndex, setModeIndex] = useState(0);

  const roptRef = useRef<number | null>(null);
  roptRef.current = r?.Ropt ?? null;
  const sweepRef = useRef({ on: false, f: 0 });
  const driveRef = useRef({ on: false, ampNorm: 0 });
  const frfChart = useRef<UPlotHandle>(null);
  const [sweeping, setSweeping] = useState(false);
  const [sweepInfo, setSweepInfo] = useState<{ f: number; P: number } | null>(null);

  useEffect(() => {
    if (!sweeping || !r) {
      sweepRef.current = { on: false, f: 0 };
      driveRef.current = { on: false, ampNorm: 0 };
      frfChart.current?.redraw();
      if (!sweeping) setSweepInfo(null);
      return;
    }
    const duration = 16000;
    const t0 = performance.now();
    const fMin = r.frf.f[0];
    const fMax = r.frf.f[r.frf.f.length - 1];
    const pPeak = r.pModelPeak || 1;
    let raf = 0;
    let lastInfo = 0;
    const loop = () => {
      const el = performance.now() - t0;
      const frac = (el % duration) / duration;
      const f = fMin + frac * (fMax - fMin);
      const P = resample(r.frf.f, r.frf.P, [f])[0];
      const ampNorm = Math.max(0.02, Math.min(1, Math.sqrt(P / pPeak)));
      sweepRef.current = { on: true, f };
      driveRef.current = { on: true, ampNorm };
      frfChart.current?.redraw();
      if (el - lastInfo > 120) {
        lastInfo = el;
        setSweepInfo({ f, P });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      sweepRef.current = { on: false, f: 0 };
      driveRef.current = { on: false, ampNorm: 0 };
      // eslint-disable-next-line react-hooks/exhaustive-deps
      frfChart.current?.redraw();
    };
  }, [sweeping, r]);

  const frf: uPlot.AlignedData = useMemo(() => {
    if (!r) return [[], []];
    if (cmp) return [r.frf.f, r.frf.P, resample(cmp.result.frf.f, cmp.result.frf.P, r.frf.f)];
    return [r.frf.f, r.frf.P];
  }, [r, cmp]);
  const pvr: uPlot.AlignedData = useMemo(() => (r ? [r.pVsR.R, r.pVsR.P] : [[], []]), [r]);
  const pvm: uPlot.AlignedData = useMemo(() => (r ? [r.pVsMass.m.map((x) => x * 1000), r.pVsMass.P] : [[], []]), [r]);
  const vt: uPlot.AlignedData = useMemo(() => (r ? [r.timeSeries.t, r.timeSeries.v] : [[], []]), [r]);
  const pt: uPlot.AlignedData = useMemo(() => (r ? [r.timeSeries.t, r.timeSeries.P] : [[], []]), [r]);

  const hud = r
    ? sweeping && sweepInfo
      ? [
          { k: '► Barrido f', v: formatSI(sweepInfo.f, 'Hz') },
          { k: 'P instantánea', v: formatSI(sweepInfo.P, 'W') },
          { k: 'R óptima', v: formatSI(r.Ropt, 'Ω') },
        ]
      : [
          { k: 'f₁ resonancia', v: formatSI(r.modes[0]?.freq ?? 0, 'Hz') },
          { k: 'P máx (modelo)', v: formatSI(r.pModelPeak, 'W') },
          { k: 'R óptima', v: formatSI(r.Ropt, 'Ω') },
        ]
    : [];

  return (
    <div className="layout">
      <div className="sidebar" data-testid="beam-sidebar">
        <Section title="Materiales">
          <Select
            label="Capas piezoeléctricas"
            value={p.piezoId}
            onChange={(v) => app.patchBeam({ piezoId: v })}
            options={app.piezos.map((m) => ({ value: m.id, label: m.name }))}
            testId="beam-piezo"
          />
          <Select
            label="Sustrato central"
            value={p.substrateId}
            onChange={(v) => app.patchBeam({ substrateId: v })}
            options={app.substrates.map((m) => ({ value: m.id, label: m.name }))}
            testId="beam-substrate"
          />
        </Section>

        <Section title="Geometría de la viga">
          <Slider
            label="Longitud L"
            value={p.length * 1000}
            min={RANGES.beam.lengthMm.min}
            max={RANGES.beam.lengthMm.max}
            step={1}
            onChange={(v) => app.patchBeam({ length: v / 1000 })}
            display={`${(p.length * 1000).toFixed(0)} mm`}
            testId="beam-length"
          />
          <Slider
            label="Ancho b"
            value={p.width * 1000}
            min={RANGES.beam.widthMm.min}
            max={RANGES.beam.widthMm.max}
            step={1}
            onChange={(v) => app.patchBeam({ width: v / 1000 })}
            display={`${(p.width * 1000).toFixed(0)} mm`}
            testId="beam-width"
          />
          <div className="inline-2">
            <Slider
              label="Espesor sustrato"
              value={p.tSub * 1000}
              min={RANGES.beam.tSubMm.min}
              max={RANGES.beam.tSubMm.max}
              step={RANGES.beam.tSubMm.step}
              onChange={(v) => app.patchBeam({ tSub: v / 1000 })}
              display={`${(p.tSub * 1000).toFixed(2)} mm`}
              testId="beam-tsub"
            />
            <Slider
              label="Espesor piezo (c/u)"
              value={p.tPiezo * 1000}
              min={RANGES.beam.tPiezoMm.min}
              max={RANGES.beam.tPiezoMm.max}
              step={RANGES.beam.tPiezoMm.step}
              onChange={(v) => app.patchBeam({ tPiezo: v / 1000 })}
              display={`${(p.tPiezo * 1000).toFixed(2)} mm`}
              testId="beam-tpiezo"
            />
          </div>
          <Slider
            label="Masa de punta"
            value={p.tipMass * 1000}
            min={RANGES.beam.tipMassG.min}
            max={RANGES.beam.tipMassG.max}
            step={RANGES.beam.tipMassG.step}
            onChange={(v) => app.patchBeam({ tipMass: v / 1000 })}
            display={`${(p.tipMass * 1000).toFixed(1)} g`}
            testId="beam-tipmass"
          />
        </Section>

        <Section title="Excitación y amortiguamiento">
          <Slider
            label="Aceleración de base a₀"
            value={p.a0}
            min={RANGES.beam.a0.min}
            max={RANGES.beam.a0.max}
            step={RANGES.beam.a0.step}
            onChange={(v) => app.patchBeam({ a0: v })}
            display={`${p.a0.toFixed(1)} m/s²`}
            testId="beam-a0"
          />
          <Slider
            label="Amortiguamiento total ζ_T"
            value={p.zetaT}
            min={RANGES.beam.zetaT.min}
            max={RANGES.beam.zetaT.max}
            step={RANGES.beam.zetaT.step}
            onChange={(v) => app.patchBeam({ zetaT: v })}
            display={p.zetaT.toFixed(3)}
            testId="beam-zeta"
          />
          <Slider
            label="Factor de pérdidas (realista)"
            value={p.lossFactor}
            min={RANGES.beam.lossFactor.min}
            max={RANGES.beam.lossFactor.max}
            step={RANGES.beam.lossFactor.step}
            onChange={(v) => app.patchBeam({ lossFactor: v })}
            display={`×${p.lossFactor.toFixed(2)}`}
            testId="beam-loss"
          />
          <Slider
            label="Resistencia de carga R_load"
            value={Math.log10(p.Rload)}
            min={3}
            max={7}
            step={0.05}
            onChange={(v) => app.patchBeam({ Rload: Math.pow(10, v) })}
            display={formatSI(p.Rload, 'Ω')}
            testId="beam-rload"
          />
          <div className="inline-2">
            <Slider
              label="Barrido f mín"
              value={p.freqMin}
              min={5}
              max={100}
              step={5}
              onChange={(v) => app.patchBeam({ freqMin: v })}
              display={`${p.freqMin} Hz`}
              testId="beam-fmin"
            />
            <Slider
              label="Barrido f máx"
              value={p.freqMax}
              min={100}
              max={600}
              step={10}
              onChange={(v) => app.patchBeam({ freqMax: v })}
              display={`${p.freqMax} Hz`}
              testId="beam-fmax"
            />
          </div>
        </Section>

        <Section title="Visualización 3D">
          <div className="field">
            <div className="field-head">
              <span className="field-label">Forma modal mostrada</span>
            </div>
            <div className="btn-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  className={`btn sm ${modeIndex === i ? 'primary' : ''}`}
                  onClick={() => setModeIndex(i)}
                  data-testid={`beam-mode-${i + 1}`}
                >
                  Modo {i + 1}
                </button>
              ))}
            </div>
            {r?.modes[modeIndex] && (
              <div className="hint mono" style={{ marginTop: 6 }}>
                f = {r.modes[modeIndex].freq.toFixed(1)} Hz
              </div>
            )}
          </div>
          <button
            className={`btn sm ${sweeping ? 'primary' : ''}`}
            style={{ width: '100%', marginBottom: 12 }}
            onClick={() => setSweeping((s) => !s)}
            data-testid="beam-sweep"
          >
            {sweeping ? <Square size={13} /> : <Radio size={13} />}
            {sweeping ? ' Detener barrido' : ' Barrido de frecuencia'}
          </button>
          <Slider
            label="Factor de escala (deformada)"
            value={p.scaleFactor}
            min={RANGES.beam.scaleFactor.min}
            max={RANGES.beam.scaleFactor.max}
            step={RANGES.beam.scaleFactor.step}
            onChange={(v) => app.patchBeam({ scaleFactor: v })}
            display={`×${p.scaleFactor.toFixed(0)}`}
            testId="beam-scale"
          />
        </Section>

        {r && (
          <Section title="Resultados">
            <div className="stat-grid">
              <StatSI label="f₁ (modo 1)" value={r.modes[0]?.freq ?? 0} unit="Hz" cls="accent" eq="ω_n = λ₁²·√(EI/m'L⁴)" source="Euler-Bernoulli" testId="beam-res-f1" />
              <StatSI label="f₂ / f₃" value={r.modes[1]?.freq ?? 0} unit="Hz" note={`f₃ = ${formatSI(r.modes[2]?.freq ?? 0, 'Hz')}`} testId="beam-res-f2" />
              <Stat label="f_n (SDOF)" value={formatSI(r.fnSDOF, 'Hz')} eq="f_n = (1/2π)·√(k_eq/m_eq)" note={`k_eq=${formatSI(r.keq, 'N/m')}, m_eq=${formatSI(r.meq, 'kg')}`} testId="beam-res-fsdof" />
              <StatSI label="Rigidez EI" value={r.EI} unit="N·m²" eq="EI = E_ref·Σ[b*t³/12 + A*·d²]" source="Transf. de secciones" testId="beam-res-ei" />
              <StatSI label="Eje neutro" value={r.neutralAxis} unit="m" eq="ȳ = ΣA*·z / ΣA*" note={`espesor total ${formatSI(r.totalThickness, 'm')}`} testId="beam-res-na" />
              <StatSI label="Capacitancia C_p" value={r.Cp} unit="F" eq="C_p = ε₃₃·b·L/(2·t_p)" note="bimorfo en serie" testId="beam-res-cp" />
              <StatSI label="R óptima" value={r.Ropt} unit="Ω" cls="accent" eq="R_opt ≈ 1/(ω_n·C_p)" testId="beam-res-ropt" />
              <StatSI label="P máx (Williams-Yates)" value={r.pMaxWilliamsYates} unit="W" cls="accent" eq="P_max = m·a²/(8·ζ_T·ω_n)" source="Williams & Yates 1996" note="cota teórica" testId="beam-res-pwy" />
              <StatSI label="P realista (pérdidas)" value={r.pRealistic} unit="W" cls="amber" eq="P_real = P_max · factor_pérdidas" testId="beam-res-preal" />
              <StatSI label="P pico (modelo FRF)" value={r.pModelPeak} unit="W" note={`en ${formatSI(r.peakFreq, 'Hz')}`} testId="beam-res-pmodel" />
            </div>
          </Section>
        )}

        <div className="btn-row">
          <button className="btn" onClick={app.saveBeamCompare} data-testid="beam-compare">
            <GitCompare size={14} /> Comparar
          </button>
          <button className="btn ghost" onClick={app.clearBeamCompare} disabled={!cmp} data-testid="beam-compare-clear">
            <X size={14} /> Limpiar
          </button>
        </div>
        {cmp && (
          <div className="hint" data-testid="beam-compare-label">
            Comparando con: <b style={{ color: 'var(--violet)' }}>{cmp.label}</b>
          </div>
        )}
        <div className="btn-row">
          <button className="btn sm" onClick={() => r && exportBeamCSV(p, r)} disabled={!r} data-testid="beam-export-csv">
            <Download size={13} /> CSV
          </button>
          <button className="btn sm" onClick={() => r && exportBeamSummary(p, r)} disabled={!r} data-testid="beam-export-json">
            <FileJson size={13} /> JSON
          </button>
        </div>
        <button className="btn sm" onClick={() => viewerRef.current?.exportSTL('viga_bimorfa.stl')} data-testid="beam-export-stl">
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
        <Viewer3D
          ref={viewerRef}
          kind="beam"
          beamParams={p}
          beamResult={r}
          modeIndex={sweeping ? 0 : modeIndex}
          hud={hud}
          beamDriveRef={driveRef}
        />
        <div className="charts" data-testid="beam-charts">
          <ChartCard title="Potencia vs frecuencia (FRF)" sub={r ? `pico ${formatSI(r.peakFreq, 'Hz')}` : ''}>
            <UPlotChart
              ref={frfChart}
              data={frf}
              opts={lineOpts(
                'f (Hz)',
                'P (W)',
                cmp
                  ? [
                      { label: 'actual', color: CHART.accent },
                      { label: cmp.label, color: CHART.violet, dash: [5, 3] },
                    ]
                  : [{ label: 'P', color: CHART.accent }],
                false,
                [vLinePlugin(() => (sweepRef.current.on ? sweepRef.current.f : null), CHART.green, '► f')]
              )}
              redrawKey={cmp ? 'bf-cmp' : 'bf'}
            />
          </ChartCard>
          <ChartCard title="Potencia vs R_load" sub={r ? `R_opt ${formatSI(r.Ropt, 'Ω')}` : ''}>
            <UPlotChart
              data={pvr}
              opts={lineOpts('R (Ω)', 'P (W)', [{ label: 'P', color: CHART.amber }], true, [
                vLinePlugin(() => roptRef.current, CHART.accent, 'R_opt'),
              ])}
              redrawKey="br"
            />
          </ChartCard>
          <ChartCard title="Potencia vs masa de punta" sub="g">
            <UPlotChart data={pvm} opts={lineOpts('m (g)', 'P (W)', [{ label: 'P', color: CHART.green }])} redrawKey="bm" />
          </ChartCard>
          <ChartCard title="Voltaje V(t)" sub="régimen permanente">
            <UPlotChart data={vt} opts={lineOpts('t (s)', 'V (V)', [{ label: 'V', color: CHART.accent }])} redrawKey="bv" />
          </ChartCard>
          <ChartCard title="Potencia P(t)" sub="W">
            <UPlotChart data={pt} opts={lineOpts('t (s)', 'P (W)', [{ label: 'P', color: CHART.amber }])} redrawKey="bp" />
          </ChartCard>
        </div>
      </div>
    </div>
  );
};
