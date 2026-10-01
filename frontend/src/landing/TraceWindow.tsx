/**
 * Ventana «Pisada.trz»: la curva de fuerza F(t) dibujada a píxel y las cifras
 * de circuito abierto del módulo, recalculadas al mover la fuerza pico.
 *
 * El lienzo se dibuja a escala entera (2 o 3 px por píxel lógico): su ancho
 * lógico se adapta al contenedor en lugar de estirar los píxeles.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Window } from './Window';
import { FMAX, TOTAL_CAPACITANCE, TP, fmt, forceSamples, openCircuitFigures } from './physics';
import { pixelScale, useWidth } from './useWidth';

/** Alto lógico del lienzo y márgenes, en píxeles lógicos. */
const H = 64;
const PAD_L = 3;
const PAD_B = 4;
const PLOT_H = H - PAD_B - 6;
/** Ancho lógico de referencia para elegir la escala. */
const NOMINAL_W = 150;

interface TraceWindowProps {
  active: boolean;
  onFocus: () => void;
  onClose: () => void;
  style?: React.CSSProperties;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Ordenada en píxeles lógicos de una fuerza dada. */
function yOf(f: number): number {
  return H - PAD_B - 1 - Math.round((f / FMAX.max) * PLOT_H);
}

export function TraceWindow({ active, onFocus, onClose, style }: TraceWindowProps) {
  const [Fmax, setFmax] = useState<number>(FMAX.def);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cellRef, cellW] = useWidth<HTMLDivElement>();
  const reduce = useRef(prefersReducedMotion());
  const drawn = useRef(0);
  const fig = useMemo(() => openCircuitFigures(Fmax), [Fmax]);

  const s = pixelScale(cellW, NOMINAL_W);
  const W = Math.max(60, Math.floor(cellW / s));
  const samplesN = W - PAD_L - 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || cellW === 0) return;
    // La escala vertical es la de F_max máxima, así que la curva crece de verdad.
    const samples = forceSamples(Fmax, samplesN);
    if (reduce.current) drawn.current = samplesN;

    let raf = 0;
    const paint = () => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#000';
      // Ejes.
      ctx.fillRect(PAD_L - 1, 2, 1, H - PAD_B - 1);
      ctx.fillRect(PAD_L - 1, H - PAD_B, W - PAD_L, 1);
      // Rejilla de puntos cada 1/4 de la escala y marcas de tiempo.
      for (let q = 1; q <= 4; q++) {
        const y = yOf((FMAX.max * q) / 4);
        for (let x = PAD_L + 1; x < W; x += 4) ctx.fillRect(x, y, 1, 1);
      }
      for (let k = 0; k <= 6; k++) {
        const x = PAD_L + Math.round(((samplesN - 1) * k) / 6);
        ctx.fillRect(x, H - PAD_B + 1, 1, 2);
      }
      // Curva, trazada en escalones de píxel entero.
      const upto = Math.min(samplesN, Math.floor(drawn.current));
      let prev = yOf(samples[0]);
      for (let i = 0; i < upto; i++) {
        const y = yOf(samples[i]);
        const top = Math.min(prev, y);
        ctx.fillRect(PAD_L + i, top, 1, Math.abs(prev - y) + 1);
        ctx.fillRect(PAD_L + i, y - 1, 1, 1);
        prev = y;
      }
      if (upto < samplesN) {
        drawn.current += 3;
        raf = requestAnimationFrame(paint);
      }
    };
    paint();
    return () => cancelAnimationFrame(raf);
  }, [Fmax, W, samplesN, cellW]);

  // Caja punteada sobre el pulso 0…T_p, en píxeles lógicos × escala.
  const x0 = PAD_L + Math.round((samplesN - 1) / 6);
  const x1 = PAD_L + Math.round(((samplesN - 1) * 5) / 6);
  const yPeak = yOf(Fmax) - 2;
  const antsStyle: React.CSSProperties = {
    left: x0 * s,
    width: (x1 - x0) * s,
    top: yPeak * s,
    height: (H - PAD_B - yPeak) * s,
  };

  return (
    <Window
      title="Pisada.trz"
      className="pz-trace"
      active={active}
      onFocus={onFocus}
      onClose={onClose}
      draggable
      style={style}
      id="w-trace"
      status={
        <>
          <span>circuito abierto</span>
          <span>T_p = {fmt(TP, 1)} s</span>
          <span>C_total = {fmt(TOTAL_CAPACITANCE * 1e9, 1)} nF</span>
        </>
      }
    >
      <div className="pz-plot">
        <div className="pz-axis-y" aria-hidden style={{ height: H * s }}>
          <span>{fmt(FMAX.max, 0)} N</span>
          <span>0</span>
        </div>
        <div className="pz-canvas-cell" ref={cellRef}>
          <div className="pz-canvas-wrap" style={{ width: W * s, height: H * s }}>
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              style={{ width: W * s, height: H * s }}
              role="img"
              aria-label={`Fuerza de pisada F(t) = F_max · sin²(πt/T_p) con F_max = ${fmt(Fmax, 0)} N`}
            />
            <div className="pz-ants" aria-hidden style={antsStyle} />
            <span className="pz-peak-label" style={{ top: yPeak * s, left: ((x0 + x1) / 2) * s }}>
              F<sub>max</sub>
            </span>
          </div>
          <div className="pz-axis-x" aria-hidden style={{ width: W * s }}>
            <span>−{fmt(TP * 0.25, 3)} s</span>
            <span className="pz-axis-span">pisada · T_p</span>
            <span>{fmt(TP * 1.25, 3)} s</span>
          </div>
        </div>
      </div>

      <label className="pz-slider" htmlFor="pz-fmax">
        <span className="pz-slider-head">
          <span>
            Fuerza pico F<sub>max</sub>
          </span>
          <output htmlFor="pz-fmax">
            {fmt(Fmax, 0)} N <small>≈ {fmt(fig.massKg, 0)} kg</small>
          </output>
        </span>
        <input
          id="pz-fmax"
          type="range"
          min={FMAX.min}
          max={FMAX.max}
          step={FMAX.step}
          value={Fmax}
          onChange={(e) => setFmax(Number(e.target.value))}
        />
        <span className="pz-slider-range" aria-hidden>
          <span>{fmt(FMAX.min, 0)} N</span>
          <span>{fmt(FMAX.max, 0)} N</span>
        </span>
      </label>

      <dl className="pz-readout" aria-live="polite">
        <div>
          <dt>
            V<sub>oc</sub> del módulo
          </dt>
          <dd>{fmt(fig.voc, 2)} V</dd>
        </div>
        <div>
          <dt>E ideal por pisada</dt>
          <dd>{fmt(fig.energy * 1e3, 4)} mJ</dd>
        </div>
        <div>
          <dt>σ por stack</dt>
          <dd>{fmt(fig.stress / 1e6, 2)} MPa</dd>
        </div>
        <div>
          <dt>δ del stack</dt>
          <dd>{fmt(fig.compression * 1e6, 2)} µm</dd>
        </div>
      </dl>
    </Window>
  );
}
