/**
 * Caso P5: energía por pisada con V_c fijo y C_s muy grande.
 * Barras tramadas = referencia del enunciado; barras negras = modelo.
 * Valores tomados de la tabla de validación del README.
 */
import React from 'react';
import { fmt } from './physics';
import { pixelScale, useWidth } from './useWidth';

export const P5_ROWS = [
  { vc: 2, ref: 55.9, model: 55.86 },
  { vc: 5, ref: 123, model: 123.31 },
  { vc: 10, ref: 192, model: 192.13 },
  { vc: 15, ref: 206, model: 206.48 },
  { vc: 20, ref: 166, model: 166.34 },
  { vc: 35, ref: 89.7, model: 89.63 },
] as const;

const MAX = 220;
const BAR = 8;
const GAP = 2;
/** Separación mínima por grupo de barras, en píxeles lógicos. */
const MIN_GROUP = BAR * 2 + GAP + 6;
const NOMINAL_GROUP = 28;
const H = 60;

export function P5Chart() {
  const [ref, available] = useWidth<HTMLElement>();
  // Escala entera de píxel: el espacio sobrante abre los grupos, no estira el dibujo.
  const s = pixelScale(available, P5_ROWS.length * NOMINAL_GROUP);
  const group = Math.max(MIN_GROUP, Math.floor(available / s / P5_ROWS.length));
  const width = P5_ROWS.length * group;
  const y = (v: number) => H - Math.round((v / MAX) * H);
  return (
    <figure className="pz-p5" ref={ref}>
      <svg
        width={width * s}
        height={(H + 1) * s}
        viewBox={`0 0 ${width} ${H + 1}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label="Energía por pisada frente a V_c: referencia y modelo coinciden en los seis puntos; el máximo está en 15 V."
      >
        <defs>
          <pattern id="pz-d50" width="2" height="2" patternUnits="userSpaceOnUse">
            <rect width="2" height="2" fill="#fff" />
            <rect width="1" height="1" fill="#000" />
            <rect x="1" y="1" width="1" height="1" fill="#000" />
          </pattern>
        </defs>
        {[50, 100, 150, 200].map((v) => (
          <g key={v}>
            {Array.from({ length: Math.floor(width / 3) }, (_, i) => (
              <rect key={i} x={i * 3} y={y(v)} width="1" height="1" fill="#000" />
            ))}
          </g>
        ))}
        {P5_ROWS.map((r, i) => {
          const x = i * group + Math.floor((group - BAR * 2 - GAP) / 2);
          return (
            <g key={r.vc}>
              <rect x={x} y={y(r.ref)} width={BAR} height={H - y(r.ref)} fill="url(#pz-d50)" stroke="#000" strokeWidth="1" />
              <rect x={x + BAR + GAP} y={y(r.model)} width={BAR} height={H - y(r.model)} fill="#000" />
            </g>
          );
        })}
        <rect x="0" y={H} width={width} height="1" fill="#000" />
      </svg>
      <div className="pz-p5-axis" aria-hidden style={{ width: width * s }}>
        {P5_ROWS.map((r) => (
          <span key={r.vc}>{r.vc} V</span>
        ))}
      </div>
      <figcaption>
        <span className="pz-key pz-key-ref" aria-hidden /> referencia
        <span className="pz-key pz-key-model" aria-hidden /> modelo · µJ por pisada
      </figcaption>
      <table className="pz-table pz-p5-table">
        <caption className="pz-sr">Energía por pisada según V_c</caption>
        <thead>
          <tr>
            <th scope="col">V_c</th>
            {P5_ROWS.map((r) => (
              <th scope="col" key={r.vc}>
                {r.vc} V
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Referencia</th>
            {P5_ROWS.map((r) => (
              <td key={r.vc}>{fmt(r.ref, r.ref < 100 ? 1 : 0)}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">Modelo</th>
            {P5_ROWS.map((r) => (
              <td key={r.vc}>{fmt(r.model, 2)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </figure>
  );
}
