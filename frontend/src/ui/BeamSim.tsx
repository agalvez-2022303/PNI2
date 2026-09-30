import React, { useEffect, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import { useApp } from './store';
import { Viewer3D, ViewerHandle } from './Viewer3D';
import { Section, Slider, StatSI, Stat } from './controls';
import { UPlotChart, UPlotHandle, baseAxes, CHART, vLinePlugin } from './UPlotChart';
import { formatSI } from '../core/units';
import { RANGES } from '../sim/defaults';
import { exportBeamCSV, exportBeamSummary } from './exporters';
import { GitCompare, Download, FileJson, Boxes, X, Radio, Square } from 'lucide-react';
import { BEAM, PZT5A, PZT5A_DERIVED } from '../core/referenceModel';

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

/**
 * Celda plana de gráfica. Sustituye al antiguo `ChartCard`: no hay caja, ni
 * sombra, ni borde redondeado, sólo una línea de 1 px que separa las celdas y
 * una franja de cabecera con el mismo fondo que el resto de la interfaz.
 */
const ChartSlot: React.FC<{ title: string; sub?: string; children: React.ReactNode }> = ({ title, sub, children }) => (
  <div className="chart-slot">
    <div className="chart-cap">
      <span>{title}</span>
      {sub && <span className="u">{sub}</span>}
    </div>
    <div className="chart-body">{children}</div>
  </div>
);

export const BeamSim: React.FC = () => {
  const app = useApp();
  const p = app.beamInputs;
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
    const pPeak = r.pModel || 1;
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
          { k: 'P en resonancia', v: formatSI(r.pModel, 'W') },
          { k: 'R óptima', v: formatSI(r.Ropt, 'Ω') },
        ]
    : [];

  return (
    <div className="layout">
      <div className="sidebar" data-testid="beam-sidebar">
        <Section title="Modelo fijo (no editable)">
          <div className="hint mono" data-testid="beam-model">
            PZT-5H bimorfo + latón · L = {(BEAM.length * 1000).toFixed(0)} × {(BEAM.width * 1000).toFixed(0)} mm
            <br />
            t_s = {(BEAM.tSub * 1000).toFixed(2)} mm · t_p = {(BEAM.tPiezo * 1000).toFixed(2)} mm (×2) · M_t ={' '}
            {(BEAM.tipMass * 1000).toFixed(1)} g
            <br />
            ε₃₃ˢ/ε₀ = {PZT5A_DERIVED.eps33SRel.toFixed(0)} · k₃₁ = {PZT5A_DERIVED.k31.toFixed(4)}
            <br />
            ζ_mec = {BEAM.zetaMec} (supuesto) · m₁ = γ₁² = {r ? (r.modalMass1 * 1000).toFixed(2) : '—'} g (de la forma modal)
          </div>
        </Section>

        <Section title="Excitación">
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
            label="Frecuencia de excitación f_exc"
            value={p.fExc}
            min={RANGES.beam.fExc.min}
            max={RANGES.beam.fExc.max}
            step={RANGES.beam.fExc.step}
            onChange={(v) => app.patchBeam({ fExc: v })}
            display={`${p.fExc.toFixed(2)} Hz`}
            testId="beam-fexc"
          />
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
        </Section>

        {r && (
          <Section title="Resultados">
            <div className="stat-grid">
              <StatSI
                label="f₁ (modo 1)"
                value={r.modes[0]?.freq ?? 0}
                unit="Hz"
                cls="accent"
                eq="ω_n = λ₁² · √(EI / (m'·L⁴))"
                source="Euler-Bernoulli"
                testId="beam-res-f1"
              />
              <StatSI
                label="f₂ / f₃"
                value={r.modes[1]?.freq ?? 0}
                unit="Hz"
                note={`f₃ = ${formatSI(r.modes[2]?.freq ?? 0, 'Hz')}`}
                testId="beam-res-f2"
              />
              <Stat
                label="f_n (SDOF)"
                value={formatSI(r.fnSDOF, 'Hz')}
                eq="f_n = (1/2π)·√(k_eq/m_eq)"
                note={`k_eq=${formatSI(r.keq, 'N/m')}, m_eq=${formatSI(r.meq, 'kg')}`}
                testId="beam-res-fsdof"
              />
              <StatSI
                label="Rigidez EI"
                value={r.EI}
                unit="N·m²"
                eq="EI = Σ Eᵢ·[b·t³/12 + A·d²]"
                source="Transformación de secciones"
                testId="beam-res-ei"
              />
              <StatSI
                label="Eje neutro"
                value={r.neutralAxis}
                unit="m"
                eq="ȳ = ΣA·z / ΣA"
                note={`espesor total ${formatSI(r.totalThickness, 'm')}`}
                testId="beam-res-na"
              />
              <StatSI
                label="Capacitancia C_p"
                value={r.Cp}
                unit="F"
                eq="C_p = ε₃₃ˢ·b·L / (2·t_p)"
                note="bimorfo en serie, ε₃₃ˢ = ε₃₃ᵀ(1−k₃₁²)"
                testId="beam-res-cp"
              />
              <StatSI
                label="R óptima"
                value={r.Ropt}
                unit="Ω"
                cls="accent"
                eq="R_opt = 1 / (ω_n · C_p)"
                testId="beam-res-ropt"
              />
              <StatSI
                label="Cota Williams–Yates"
                value={r.pBound}
                unit="W"
                cls="accent"
                eq="P_bound = m·a² / (8·ζ_mec·ω_n)"
                source="Williams & Yates 1996"
                note="con γ₂ como masa Generalized"
                testId="beam-res-pwy"
              />
              <StatSI
                label="P del modelo a R_opt"
                value={r.pModel}
                unit="W"
                cls="amber"
                eq="P = ½·ω_n·ξ²·(ω_n/λ²)·R/(R²+X_C²)"
                note={`en ${formatSI(r.peakFreq, 'Hz')}`}
                testId="beam-res-pmodel"
              />
              <Stat
                label="P modelo / cota"
                value={r.pRatio.toFixed(4)}
                eq="razón modelo / Williams–Yates"
                note="debe ser ≤ 1: la cota no puede superarse"
                testId="beam-res-pratio"
              />
              <Stat
                label="FRF vs integración temporal"
                value={`${(r.frfVsTime.pFrf * 1e6).toFixed(3)} / ${(r.frfVsTime.pTime * 1e6).toFixed(3)} µW`}
                eq="P9: la FRF y la integración temporal deben coincidir"
                note={`diferencia relativa ${(r.frfVsTime.relDiff * 100).toFixed(3)} %`}
                testId="beam-res-p9"
              />
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
          beamInputs={p}
          beamResult={r}
          modeIndex={sweeping ? 0 : modeIndex}
          hud={hud}
          beamDriveRef={driveRef}
        />
        <div className="charts" data-testid="beam-charts">
          <ChartSlot title="Potencia vs frecuencia (FRF)" sub={r ? `pico ${formatSI(r.peakFreq, 'Hz')}` : ''}>
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
          </ChartSlot>
          <ChartSlot title="Potencia vs R_load" sub={r ? `R_opt ${formatSI(r.Ropt, 'Ω')}` : ''}>
            <UPlotChart
              data={pvr}
              opts={lineOpts('R (Ω)', 'P (W)', [{ label: 'P', color: CHART.amber }], true, [
                vLinePlugin(() => roptRef.current, CHART.accent, 'R_opt'),
              ])}
              redrawKey="br"
            />
          </ChartSlot>
          <ChartSlot title="Voltaje V(t)" sub="régimen permanente">
            <UPlotChart data={vt} opts={lineOpts('t (s)', 'V (V)', [{ label: 'V', color: CHART.accent }])} redrawKey="bv" />
          </ChartSlot>
          <ChartSlot title="Potencia P(t)" sub="W">
            <UPlotChart data={pt} opts={lineOpts('t (s)', 'P (W)', [{ label: 'P', color: CHART.amber }])} redrawKey="bp" />
          </ChartSlot>
        </div>
      </div>
    </div>
  );
};
