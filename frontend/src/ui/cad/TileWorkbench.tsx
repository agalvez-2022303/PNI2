/**
 * Demo del módulo de grada: una sola pantalla, seis bloques.
 *
 *   1. visor 3D + botón «pisar» + control de fuerza (300–1000 N)
 *   2. botón «desplegar»: 9 piezas rotuladas y su BOM
 *   3. esquema eléctrico animado (piezo, puente, capacitor, resistencia, LED)
 *   4. cuatro resultados grandes: voltaje pico, energía por pisada,
 *      energía al LED y pisadas hasta ver el LED encendido
 *   5. balance de energía (tabla corta)
 *   6. vista «escalera»: 15 módulos, energía por persona y por día
 *
 * El cálculo NO se hace aquí: se reutiliza el solver del store (el mismo
 * camino que verifican las pruebas P1–P12). La física no cambia; sólo la
 * interfaz se reduce a la demo.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { TileResult } from '../../sim/types';
import { PartId } from '../../bom/bom';
import { StepClock } from './clock';
import { ViewerPane } from './ViewerPane';
import { Schematic } from './Schematic';
import { BomTable } from './BomTable';
import { INPUTS, G } from '../../core/referenceModel';
import { fmt, fmtSI } from './theme';

/** Módulos de la escalera y flujo diario asumido para la vista simple. */
const STAIR_MODULES = 15;
const PEOPLE_PER_DAY = 500;
/**
 * Corriente a partir de la cual consideramos que el LED rojo se ve (sala
 * oscura). Es un umbral de presentación: el número de pisadas se mide sobre la
 * trama i(t) que devuelve el solver (result.series), nunca con una fórmula
 * aparte. Con el modelo validado el LED conduce desde el paso 1; por debajo de
 * ~450 N el pico real no alcanza este umbral y la KPI muestra «no llega».
 */
const LED_VISIBLE_A = 0.1e-3;

export const TileWorkbench: React.FC = () => {
  const app = useApp();
  const inputs = app.tileInputs;
  const result = app.tileResult;
  const solving = app.tileBusy;

  const [selected, setSelected] = useState<PartId | null>(null);
  const [exploded, setExploded] = useState(false);

  // El reloj se crea una sola vez: su periodo se ajusta en el efecto de abajo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const clock = useMemo(() => new StepClock(60 / inputs.cadence), []);
  useEffect(() => {
    clock.setPeriod(60 / inputs.cadence);
  }, [inputs.cadence, clock]);

  // El «pisar» vuelve al inicio de la pisada: el visor y el esquema arrancan
  // el ciclo desde el golpe, sincronizados por el mismo reloj.
  const pisar = useCallback(() => {
    clock.rewind();
  }, [clock]);

  const period = 60 / inputs.cadence;
  const stepsToVisible = useMemo(() => (result ? stepsToLedOn(result, period) : null), [result, period]);

  return (
    <div className="demo-shell" data-testid="demo-shell">
      {/* barra mínima: título, pisar y desplegar */}
      <header className="demo-bar">
        <span className="demo-title">módulo de grada · demo</span>
        <div className="demo-bar-actions">
          <button type="button" className="cad-btn" onClick={pisar} data-testid="btn-pisar">
            pisar
          </button>
          <button
            type="button"
            className={`cad-btn${exploded ? ' on' : ''}`}
            onClick={() => setExploded((e) => !e)}
            data-testid="btn-desplegar"
          >
            {exploded ? 'reensamblar' : 'desplegar'}
          </button>
        </div>
      </header>

      <div className="demo-body">
        {/* 1 + 2 · visor 3D con la fuerza y, al desplegar, el BOM de las 9 piezas */}
        <section className="demo-viewer-col" data-testid="demo-viewer-col">
          <div className="demo-viewer">
            <ViewerPane
              inputs={inputs}
              result={result}
              clock={clock}
              exaggeration={result?.renderExaggeration ?? 1}
              view="perspective"
              exploded={exploded}
              dims={false}
              balloons={exploded}
              section={0}
              selected={selected}
              hidden={[]}
              onSelect={setSelected}
              onHover={() => undefined}
            />
          </div>
          {exploded ? (
            <div className="demo-bom" data-testid="demo-bom">
              <BomTable selected={selected} onSelect={setSelected} />
            </div>
          ) : (
            <div className="demo-force" data-testid="demo-force">
              <label htmlFor="demo-fmax">fuerza de la pisada</label>
              <input
                id="demo-fmax"
                type="range"
                min={INPUTS.Fmax.min}
                max={INPUTS.Fmax.max}
                step={INPUTS.Fmax.step}
                value={inputs.Fmax}
                onChange={(e) => app.patchTile({ Fmax: Number(e.target.value) })}
                data-testid="demo-fmax"
              />
              <b>{inputs.Fmax} N</b>
              <span className="dim">
                {INPUTS.Fmax.min}–{INPUTS.Fmax.max} N · {fmt(inputs.Fmax / (G * 1.3), 1)} kg de persona
              </span>
            </div>
          )}
        </section>

        {/* 3–6 · resultados, esquema, balance y escalera */}
        <aside className="demo-side" data-testid="demo-side">
          {/* 4 · los cuatro números grandes */}
          <div className="demo-kpis" data-testid="demo-kpis">
            <Kpi
              label="voltaje pico"
              value={result ? `${fmt(result.Voc, 1)} V` : solving ? '…' : '—'}
              note="en vacío, con F_max"
            />
            <Kpi
              label="energía por pisada"
              value={result ? fmtSI(result.E_harvested, 'J', 1) : solving ? '…' : '—'}
              note="cosechada por el módulo"
            />
            <Kpi
              label="energía al LED"
              value={result ? fmtSI(result.E_LED, 'J', 1) : solving ? '…' : '—'}
              note="por pisada, en régimen"
            />
            <Kpi
              label="pisadas para ver el LED"
              value={stepsToVisible === null ? 'no llega' : stepsToVisible === 1 ? '1' : `${stepsToVisible}`}
              note={
                result
                  ? `i_led ≥ ${fmt(LED_VISIBLE_A * 1e3, 1)} mA · pico real ${fmt(result.ILedPeak * 1e3, 3)} mA`
                  : `i_led ≥ ${fmt(LED_VISIBLE_A * 1e3, 1)} mA`
              }
            />
          </div>

          {/* 3 · esquema animado, sincronizado con el 3D */}
          <Schematic result={result} clock={clock} selected={selected} onSelect={setSelected} />

          {/* 5 · balance de energía, tabla corta */}
          <div className="demo-balance" data-testid="demo-balance">
            <div className="cad-subhead">
              <span>balance de energía por pisada</span>
              <span className="dim">{inputs.Fmax} N · {inputs.cadence} pasos/min</span>
            </div>
            <BalanceTable result={result} />
          </div>

          {/* 6 · vista escalera */}
          <div className="demo-stairs" data-testid="demo-stairs">
            <div className="cad-subhead">
              <span>escalera de {STAIR_MODULES} módulos</span>
              <span className="dim">{PEOPLE_PER_DAY} personas/día</span>
            </div>
            <div className="demo-stairs-row" aria-hidden="true">
              {Array.from({ length: STAIR_MODULES }, (_, i) => (
                <span key={i} className="demo-stair-cell">
                  {i + 1}
                </span>
              ))}
            </div>
            <StairsFacts result={result} />
          </div>
        </aside>
      </div>
    </div>
  );
};

/** Un resultado grande: etiqueta, valor y una nota corta. */
const Kpi: React.FC<{ label: string; value: string; note: string }> = ({ label, value, note }) => (
  <div className="demo-kpi">
    <span className="demo-kpi-label">{label}</span>
    <span className="demo-kpi-value">{value}</span>
    <span className="demo-kpi-note">{note}</span>
  </div>
);

/** Tabla corta: cada eslabón con su porcentaje respecto al ANTERIOR. */
const BalanceTable: React.FC<{ result: TileResult | null }> = ({ result }) => {
  if (!result) {
    return <p className="cad-empty">resolviendo…</p>;
  }
  const c = result.chain;
  const rows: { k: string; label: string; E: number; prev: number | null; note: string }[] = [
    { k: 'u', label: 'energía elástica en la cerámica', E: c.U_el, prev: null, note: 'trabajo mecánico almacenado' },
    { k: 'i', label: 'eléctrica disponible (E_ideal)', E: c.E_ideal, prev: c.U_el, note: 'circuito abierto, ½·Cp·Voc²' },
    { k: 'x', label: 'extraída', E: c.E_extracted, prev: c.E_ideal, note: 'pasa por el puente' },
    { k: 's', label: 'almacenada', E: c.E_stored, prev: c.E_extracted, note: `puente −${fmtSI(result.E_bridgeLoss, 'J', 1)}` },
    { k: 'led', label: 'LED', E: c.E_LED, prev: c.E_stored, note: `R −${fmtSI(result.E_R, 'J', 1)}` },
  ];
  return (
    <table className="cad-table">
      <thead>
        <tr>
          <th>eslabón</th>
          <th className="num">energía</th>
          <th className="num">% del anterior</th>
          <th className="dim">nota</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.k} data-testid={`bal-${r.k}`}>
            <td>{r.label}</td>
            <td className="num val">{fmtSI(r.E, 'J', 1)}</td>
            <td className="num dim">{r.prev === null || r.prev <= 0 ? '—' : `${fmt((r.E / r.prev) * 100, 1)} %`}</td>
            <td className="dim">{r.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/** Tres cifras de la escalera: por pisada, por persona y por día. */
const StairsFacts: React.FC<{ result: TileResult | null }> = ({ result }) => {
  if (!result) return <p className="cad-empty">resolviendo…</p>;
  const perStep = result.E_harvested;
  const perPerson = perStep * STAIR_MODULES;
  const perDay = perPerson * PEOPLE_PER_DAY;
  return (
    <table className="cad-table">
      <tbody>
        <tr data-testid="stairs-step">
          <td>por pisada (1 módulo)</td>
          <td className="num val">{fmtSI(perStep, 'J', 1)}</td>
        </tr>
        <tr data-testid="stairs-person">
          <td>por persona ({STAIR_MODULES} módulos)</td>
          <td className="num val">{fmtSI(perPerson, 'J', 1)}</td>
        </tr>
        <tr data-testid="stairs-day">
          <td>por día ({PEOPLE_PER_DAY} personas)</td>
          <td className="num val">{fmtSI(perDay, 'J', 1)}</td>
        </tr>
      </tbody>
    </table>
  );
};

/**
 * Pisadas necesarias hasta que el pico de corriente del LED alcanza el umbral
 * de visibilidad. Se lee de la trama temporal del solver, ciclo a ciclo: no se
 * añade física nueva, sólo se cuenta cuándo empieza a brillar.
 */
function stepsToLedOn(result: TileResult, period: number): number | null {
  const { t, I } = result.series;
  let cycle = -1;
  let peak = 0;
  for (let i = 0; i < t.length; i++) {
    const c = Math.floor(t[i] / period);
    if (c !== cycle) {
      if (cycle >= 0 && peak >= LED_VISIBLE_A) return cycle + 1;
      cycle = c;
      peak = 0;
    }
    const a = Math.abs(I[i]);
    if (a > peak) peak = a;
  }
  return peak >= LED_VISIBLE_A ? cycle + 1 : null;
}
