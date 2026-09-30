/**
 * Esquema eléctrico en SVG, sincronizado con el visor 3D.
 *
 * Lee del MISMO `StepClock` que el 3D, así que la corriente que recorre el
 * circuito en el esquema es la misma que ilumina el LED en la escena, en el
 * mismo cuadro. La magnitud se muestra junto a cada componente.
 *
 * La selección es bidireccional: pinchar un componente del esquema selecciona
 * la pieza en el 3D, en el árbol y en el BOM (comparten `PartId`).
 */
import React, { useEffect, useRef } from 'react';
import { CIRCUIT, STACK } from '../../core/referenceModel';
import { TileResult } from '../../sim/types';
import { PartId } from '../../bom/bom';
import { StepClock, sampleSeries } from './clock';
import { fmt, fmtSI, T } from './theme';

interface Props {
  result: TileResult | null;
  clock: StepClock;
  selected: PartId | null;
  onSelect: (id: PartId | null) => void;
}

const W = 340;
const H = 200;

/** Trazado del puente de 4 diodos: rombo con los 4 lados population. */
const BRIDGE = { x: 170, y: 74, r: 24 };
const NODE = {
  cs: { x: 62, y: 74 },
  r: { x: 262, y: 74 },
  led: { x: 262, y: 146 },
  stack: { x: 62, y: 146 },
};

export const Schematic: React.FC<Props> = ({ result, clock, selected, onSelect }) => {
  const live = useRef({ result, clock, selected });
  live.current = { result, clock, selected };

  // Grupo de animación: mueve la marca de corriente y el brillo del LED.
  const dotRef = useRef<SVGCircleElement>(null);
  const ledRef = useRef<SVGCircleElement>(null);
  const iRef = useRef<SVGTextElement>(null);
  const pRef = useRef<SVGTextElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const L = live.current;
      if (!L.result) return;
      const { series } = L.result;
      const i = sampleSeries(series.t, series.I, L.clock.t);

      // Recorrido del portador: una vuelta completa por el bucle cerrado por
      // cada pisada, en el sentido real de conducción (Cs → puente → R → LED).
      if (dotRef.current) {
        const p = pointOnLoop(L.clock.phase);
        dotRef.current.setAttribute('cx', String(p[0]));
        dotRef.current.setAttribute('cy', String(p[1]));
        dotRef.current.setAttribute('opacity', i > 1e-7 ? '1' : '0.15');
      }
      if (ledRef.current) {
        const k = Math.min(1, i / (L.result.ILedPeak || 1e-12));
        ledRef.current.setAttribute('fill-opacity', String(0.15 + k * 0.85));
        ledRef.current.setAttribute('r', String(5 + k * 3.5));
      }
      if (iRef.current) iRef.current.textContent = `${fmt(i * 1e3, 3)} mA`;
      if (pRef.current) pRef.current.textContent = `${fmt(i * CIRCUIT.Vf * 1e3, 3)} mW`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const sel = (id: PartId) => (selected === id ? ' sel' : '');
  const stroke = T.line;
  const wire = T.textDim;

  return (
    <div className="cad-schem" data-testid="cad-schematic">
      <div className="cad-subhead">
        <span>esquema eléctrico</span>
        <span className="dim">
          {STACK.nStacks} stacks en paralelo → rectificador → Cs → R → led
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="cad-schem-svg" role="img" aria-label="esquema eléctrico del módulo">
        {/* pistas del circuito */}
        <g stroke={stroke} strokeWidth="1.5" fill="none">
          {/* Cs a puente */}
          <path d={`M ${NODE.cs.x + 14} ${NODE.cs.y} L ${BRIDGE.x - BRIDGE.r} ${BRIDGE.y}`} />
          {/* puente a R */}
          <path d={`M ${BRIDGE.x + BRIDGE.r} ${BRIDGE.y} L ${NODE.r.x - 14} ${NODE.r.y}`} />
          {/* R a led */}
          <path d={`M ${NODE.r.x} ${NODE.r.y + 8} L ${NODE.led.x} ${NODE.led.y - 8}`} />
          {/* led a stack */}
          <path d={`M ${NODE.led.x - 8} ${NODE.led.y} L ${NODE.stack.x + 14} ${NODE.stack.y}`} />
          {/* stack a Cs */}
          <path d={`M ${NODE.stack.x} ${NODE.stack.y - 14} L ${NODE.stack.x} ${NODE.cs.y + 14}`} />
          {/* retorno inferior, el bucle cerrado por donde circula i(t) */}
          <path
            d={`M ${NODE.cs.x - 14} ${NODE.cs.y} L 20 ${NODE.cs.y} L 20 ${H - 16} L ${W - 20} ${H - 16} L ${W - 20} ${NODE.led.y} L ${NODE.led.x + 14} ${NODE.led.y}`}
            stroke={wire}
            strokeDasharray="3 3"
          />
        </g>

        {/* nodos */}
        {Object.values(NODE).map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r="2.4" fill={wire} />
        ))}

        {/* Cs: condensador */}
        <g
          className={`cad-comp${sel('cs')}`}
          onClick={() => onSelect(selected === 'cs' ? null : 'cs')}
          data-testid="sch-cs"
        >
          <line x1={NODE.cs.x - 14} y1={NODE.cs.y} x2={NODE.cs.x + 14} y2={NODE.cs.y} stroke={stroke} strokeWidth="1.5" />
          <line x1={NODE.cs.x - 9} y1={NODE.cs.y - 12} x2={NODE.cs.x - 9} y2={NODE.cs.y + 12} stroke={T.accent} strokeWidth="2.5" />
          <line x1={NODE.cs.x + 9} y1={NODE.cs.y - 12} x2={NODE.cs.x + 9} y2={NODE.cs.y + 12} stroke={T.accent} strokeWidth="2.5" />
          <text x={NODE.cs.x} y={NODE.cs.y - 20} className="cad-sch-lbl">Cs</text>
          <text x={NODE.cs.x} y={NODE.cs.y + 28} className="cad-sch-val">{fmtSI(CIRCUIT.Cs, 'F')}</text>
        </g>

        {/* puente rectificador */}
        <g
          className={`cad-comp${sel('puente')}`}
          onClick={() => onSelect(selected === 'puente' ? null : 'puente')}
          data-testid="sch-puente"
        >
          <polygon
            points={`${BRIDGE.x},${BRIDGE.y - BRIDGE.r} ${BRIDGE.x + BRIDGE.r},${BRIDGE.y} ${BRIDGE.x},${BRIDGE.y + BRIDGE.r} ${BRIDGE.x - BRIDGE.r},${BRIDGE.y}`}
            fill="none"
            stroke={T.accent}
            strokeWidth="1.5"
          />
          {[0, 90, 180, 270].map((a) => {
            const rad = (a * Math.PI) / 180;
            const cx = BRIDGE.x + Math.cos(rad) * 10;
            const cy = BRIDGE.y + Math.sin(rad) * 10;
            return (
              <polygon
                key={a}
                points={`${cx},${cy - 4} ${cx + 5},${cy + 4} ${cx - 5},${cy + 4}`}
                fill={T.warn}
                stroke={T.warn}
                strokeWidth="0.8"
                transform={`rotate(${a} ${cx} ${cy})`}
              />
            );
          })}
          <text x={BRIDGE.x} y={BRIDGE.y + BRIDGE.r + 14} className="cad-sch-lbl">puente</text>
          <text x={BRIDGE.x} y={BRIDGE.y + BRIDGE.r + 27} className="cad-sch-val">
            4 × {CIRCUIT.diodeModel}
          </text>
        </g>

        {/* R de carga */}
        <g
          className={`cad-comp${sel('resistencia')}`}
          onClick={() => onSelect(selected === 'resistencia' ? null : 'resistencia')}
          data-testid="sch-resistencia"
        >
          <line x1={NODE.r.x - 14} y1={NODE.r.y} x2={NODE.r.x + 14} y2={NODE.r.y} stroke={stroke} strokeWidth="1.5" />
          <rect x={NODE.r.x - 6} y={NODE.r.y - 9} width="12" height="18" fill="#0f151c" stroke={T.accent} strokeWidth="1.5" />
          <text x={NODE.r.x} y={NODE.r.y - 16} className="cad-sch-lbl">R</text>
          <text x={NODE.r.x} y={NODE.r.y + 26} className="cad-sch-val">{CIRCUIT.Rload} Ω</text>
        </g>

        {/* LED */}
        <g
          className={`cad-comp${sel('led')}`}
          onClick={() => onSelect(selected === 'led' ? null : 'led')}
          data-testid="sch-led"
        >
          <circle ref={ledRef} cx={NODE.led.x} cy={NODE.led.y} r="5" fill={T.fail} fillOpacity="0.2" />
          <polygon
            points={`${NODE.led.x - 8},${NODE.led.y + 5} ${NODE.led.x + 8},${NODE.led.y + 5} ${NODE.led.x},${NODE.led.y - 8}`}
            fill="none"
            stroke={T.accent}
            strokeWidth="1.5"
          />
          <line x1={NODE.led.x} y1={NODE.led.y - 2} x2={NODE.led.x - 4} y2={NODE.led.y - 12} stroke={T.accent} strokeWidth="1.2" />
          <line x1={NODE.led.x + 1} y1={NODE.led.y - 2} x2={NODE.led.x + 5} y2={NODE.led.y - 12} stroke={T.accent} strokeWidth="1.2" />
          <text x={NODE.led.x + 12} y={NODE.led.y + 4} className="cad-sch-lbl">LED</text>
          <text x={NODE.led.x + 12} y={NODE.led.y + 16} className="cad-sch-val">Vf {fmt(CIRCUIT.Vf, 1)} V</text>
        </g>

        {/* stack piezo */}
        <g
          className={`cad-comp${sel('stacks')}`}
          onClick={() => onSelect(selected === 'stacks' ? null : 'stacks')}
          data-testid="sch-stacks"
        >
          <rect
            x={NODE.stack.x - 12}
            y={NODE.stack.y - 12}
            width="24"
            height="24"
            fill="#0f151c"
            stroke={T.accent}
            strokeWidth="1.5"
          />
          {[-6, 0, 6].map((o) => (
            <line key={o} x1={NODE.stack.x - 12} y1={NODE.stack.y + o} x2={NODE.stack.x + 12} y2={NODE.stack.y + o} stroke={stroke} strokeWidth="0.8" />
          ))}
          <text x={NODE.stack.x} y={NODE.stack.y - 18} className="cad-sch-lbl">piezo</text>
          <text x={NODE.stack.x} y={NODE.stack.y + 28} className="cad-sch-val">
            {STACK.nStacks} × {STACK.nLayers} capas
          </text>
        </g>

        {/* marca de corriente i(t) */}
        <circle ref={dotRef} cx="0" cy="0" r="3.2" fill={T.warn} opacity="0" />

        {/* lecturas vivas */}
        <text ref={iRef} x={8} y={16} className="cad-sch-live" data-testid="sch-i">
          0.000 mA
        </text>
        <text ref={pRef} x={W - 8} y={16} className="cad-sch-live" textAnchor="end" data-testid="sch-p">
          0.000 mW
        </text>
        {/* sentido de conducción: tres flechas sobre el bucle de retorno */}
        {[0.16, 0.5, 0.84].map((f) => {
          const a = pointOnLoop(f - 0.012);
          const b = pointOnLoop(f + 0.012);
          const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
          return (
            <polygon
              key={f}
              points="0,-4 7,0 0,4"
              fill={T.warn}
              transform={`translate(${a[0]} ${a[1]}) rotate(${ang})`}
            />
          );
        })}
        <text x={8} y={H - 4} className="cad-sch-note">
          el punto ámbar recorre el bucle una vez por pisada, en el sentido de conducción
        </text>
      </svg>
    </div>
  );
};

/** Punto del bucle cerrado del circuito para la fase 0..1 de la pisada. */
function pointOnLoop(phase: number): [number, number] {
  // Recorrido: Cs → puente → R → LED → retorno inferior.
  const path: [number, number][] = [
    [NODE.cs.x + 14, NODE.cs.y],
    [BRIDGE.x - BRIDGE.r, BRIDGE.y],
    [BRIDGE.x + BRIDGE.r, BRIDGE.y],
    [NODE.r.x - 14, NODE.r.y],
    [NODE.r.x, NODE.r.y + 8],
    [NODE.led.x, NODE.led.y - 8],
    [NODE.led.x + 14, NODE.led.y],
    [W - 20, NODE.led.y],
    [W - 20, H - 16],
    [20, H - 16],
    [20, NODE.cs.y],
    [NODE.cs.x - 14, NODE.cs.y],
  ];
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    segs.push(d);
    total += d;
  }
  let target = (phase % 1) * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i]) {
      const f = segs[i] === 0 ? 0 : target / segs[i];
      return [
        path[i][0] + (path[i + 1][0] - path[i][0]) * f,
        path[i][1] + (path[i + 1][1] - path[i][1]) * f,
      ];
    }
    target -= segs[i];
  }
  return [path[0][0], path[0][1]];
}
