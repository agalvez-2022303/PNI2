/**
 * Las seis gráficas de la zona inferior, dibujadas a mano en SVG.
 *
 * No se usa ninguna librería de charts: hacen falta ejes con unidades, rótulos
 * legibles a 11 px y un cursor NUMÉRICO compartido, no una interpolación de
 * aspecto. Las cinco primeras están sincronizadas en el mismo eje temporal; la
 * sexta es un barrido y no comparte eje.
 *
 * Todos los datos salen de `result.series` y de `result.energyVsLayers`, es
 * decir, de lo que el solver ha resuelto: la interfaz no calcula física.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TileResult } from '../../sim/types';
import { StepClock } from './clock';
import { fmt, T } from './theme';

interface Props {
  result: TileResult | null;
  clock: StepClock;
}

const W = 300;
const H = 132;
const PL = 40;
const PR = 8;
const PT = 16;
const PB = 18;

/** Una gráfica con su cursor. */
const Chart: React.FC<{
  title: string;
  unit: string;
  xs: number[];
  ys: number[];
  xUnit: string;
  cursor?: number | null;
  onSeek?: (t: number) => void;
  testid: string;
  bands?: { at: number; color: string }[];
}> = ({ title, unit, xs, ys, xUnit, cursor, onSeek, testid, bands }) => {
  const ref = useRef<SVGSVGElement>(null);
  const iw = W - PL - PR;
  const ih = H - PT - PB;

  const { xmin, xmax, ymin, ymax } = useMemo(() => {
    if (xs.length === 0) return { xmin: 0, xmax: 1, ymin: 0, ymax: 1 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const y of ys) {
      if (!isFinite(y)) continue;
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
    if (!isFinite(lo)) {
      lo = 0;
      hi = 1;
    }
    // Los valores negativos (Vp bipolar) necesitan su cero dentro del recuadro.
    if (ymax <= 0) hi = 0;
    if (ymin > 0) lo = 0;
    const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1;
    return {
      xmin: xs[0],
      xmax: xs[xs.length - 1],
      ymin: lo - (lo > 0 ? 0 : pad),
      ymax: hi + pad,
    };
  }, [xs, ys]);

  const sx = (x: number) => PL + ((x - xmin) / (xmax - xmin || 1)) * iw;
  const sy = (y: number) => PT + ih - ((y - ymin) / (ymax - ymin || 1)) * ih;

  const path = useMemo(() => {
    if (xs.length < 2) return '';
    let d = '';
    let started = false;
    for (let i = 0; i < xs.length; i++) {
      const px = sx(xs[i]);
      const py = sy(ys[i]);
      if (!isFinite(py)) continue;
      d += `${started ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`;
      started = true;
    }
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xs, ys, ymin, ymax, xmin, xmax]);

  // Cuatro divisiones por eje: suficiente para leer, no ilegible a 11 px.
  const yTicks = [0, 0.333, 0.667, 1].map((f) => ymin + (ymax - ymin) * f);
  const xTicks = [0, 0.5, 1].map((f) => xmin + (xmax - xmin) * f);

  const seek = (e: React.MouseEvent) => {
    if (!onSeek || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const f = (e.clientX - r.left - PL) / iw;
    if (f < 0 || f > 1) return;
    onSeek(xmin + f * (xmax - xmin));
  };

  return (
    <div className="cad-chart" data-testid={testid}>
      <div className="cad-chart-head">
        <span className="t">{title}</span>
        <span className="u">
          {unit}
          {cursor !== null && cursor !== undefined ? ` · t = ${fmt(cursor, 3)} s` : ''}
        </span>
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="cad-chart-svg"
        onMouseMove={seek}
        onClick={seek}
        preserveAspectRatio="none"
      >
        {/* bandas de referencia (umbrales) */}
        {bands?.map((b) =>
          b.at >= ymin && b.at <= ymax ? (
            <line
              key={b.at}
              x1={PL}
              x2={W - PR}
              y1={sy(b.at)}
              y2={sy(b.at)}
              stroke={b.color}
              strokeWidth="1"
              strokeDasharray="4 3"
            />
          ) : null
        )}
        {/* rejilla y ejes */}
        {yTicks.map((y, i) => (
          <g key={i}>
            <line x1={PL} x2={W - PR} y1={sy(y)} y2={sy(y)} stroke={T.line} strokeWidth="1" />
            <text x={PL - 4} y={sy(y) + 3} className="ax" textAnchor="end">
              {fmt(y, axisDigits(ymax - ymin))}
            </text>
          </g>
        ))}
        {xTicks.map((x, i) => (
          <text key={i} x={sx(x)} y={H - 5} className="ax" textAnchor="middle">
            {fmt(x, 2)}
          </text>
        ))}
        <line x1={PL} x2={W - PR} y1={PT} y2={PT} stroke={T.textDim} strokeWidth="1" />
        <line x1={PL} x2={PL} y1={PT} y2={PT + ih} stroke={T.textDim} strokeWidth="1" />
        <line x1={PL} x2={W - PR} y1={PT + ih} y2={PT + ih} stroke={T.textDim} strokeWidth="1" />
        {/* cero */}
        {ymin < 0 && ymax > 0 && (
          <line x1={PL} x2={W - PR} y1={sy(0)} y2={sy(0)} stroke={T.textDim} strokeWidth="1" />
        )}
        <path d={path} fill="none" stroke={T.accent} strokeWidth="1.4" />
        {/* cursor sincronizado */}
        {cursor !== null && cursor !== undefined && cursor >= xmin && cursor <= xmax && (
          <line
            x1={sx(cursor)}
            x2={sx(cursor)}
            y1={PT}
            y2={PT + ih}
            stroke={T.warn}
            strokeWidth="1"
            data-testid={`cursor-${testid}`}
          />
        )}
        <text x={W - PR} y={H - 5} className="ax" textAnchor="end">
          {xUnit}
        </text>
      </svg>
    </div>
  );
};

export const Charts: React.FC<Props> = ({ result, clock }) => {
  // Cursor de lectura: si el usuario pasa el ratón manda su posición; si no,
  // sigue a la animación. Es el mismo valor para las cinco primeras.
  const [hoverT, setHoverT] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const readRef = useRef<number | null>(null);
  readRef.current = hoverT;

  // Refresco del cursor a 20 Hz: se lee igual de bien y no repinta 60 veces.
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 50);
    return () => window.clearInterval(id);
  }, []);

  if (!result) {
    return (
      <div className="cad-charts" data-testid="cad-charts">
        <p className="cad-empty">resolviendo…</p>
      </div>
    );
  }

  const s = result.series;
  const t = readRef.current !== null ? readRef.current : clock.t;
  const cmp = result.energyVsLayers;

  return (
    <div className="cad-charts" data-testid="cad-charts">
      <Chart
        title="fuerza de pisada"
        unit="N"
        xs={s.t}
        ys={s.F}
        xUnit="t [s]"
        cursor={t}
        onSeek={(v) => setHoverT(v)}
        testid="chart-f"
      />
      <Chart
        title="tensión del piezo V_p"
        unit="V"
        xs={s.t}
        ys={s.Vp}
        xUnit="t [s]"
        cursor={t}
        onSeek={(v) => setHoverT(v)}
        testid="chart-vp"
      />
      <Chart
        title="tensión de C_s"
        unit="V"
        xs={s.t}
        ys={s.Vcs}
        xUnit="t [s]"
        cursor={t}
        onSeek={(v) => setHoverT(v)}
        testid="chart-vc"
        bands={[{ at: 100, color: '#ef5350' }]}
      />
      <Chart
        title="corriente del LED"
        unit="mA"
        xs={s.t}
        ys={s.I.map((v) => v * 1e3)}
        xUnit="t [s]"
        cursor={t}
        onSeek={(v) => setHoverT(v)}
        testid="chart-i"
      />
      <Chart
        title="energía acumulada al LED"
        unit="µJ"
        xs={s.t}
        ys={s.EledCum.map((v) => v * 1e6)}
        xUnit="t [s]"
        cursor={t}
        onSeek={(v) => setHoverT(v)}
        testid="chart-eled"
      />
      <Chart
        title="energía por pisada frente a nº de capas"
        unit="µJ"
        xs={cmp.n}
        ys={cmp.E.map((v) => v * 1e6)}
        xUnit="n capas (T constante)"
        testid="chart-cmp"
      />
    </div>
  );
};

/** Decimales del eje en función del recorrido: 4 cifras significativas. */
function axisDigits(span: number): number {
  const a = Math.abs(span);
  if (a === 0) return 0;
  if (a < 1e-3) return 6;
  if (a < 1e-2) return 4;
  if (a < 1e-1) return 3;
  if (a < 1e1) return 2;
  return 1;
}
