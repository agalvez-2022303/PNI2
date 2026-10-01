/**
 * Demo del módulo de grada: una sola pantalla, estética CAD industrial.
 *
 *   1. visor 3D con barra de vistas técnicas (perspectiva, ortogonal, corte
 *      transversal y alambre) y «factor de explosión CAD» 0–100 %
 *   2. a 0 % la baldosa está montada: placa apoyada en los resortes que
 *      presionan los 4 stacks; a 100 % la arquitectura se despliega con guías
 *      punteadas y las 9 piezas rotuladas + su BOM
 *   3. esquema eléctrico animado (piezo, puente, capacitor, resistencia, LED)
 *   4. cuatro resultados grandes: voltaje pico, energía por pisada,
 *      energía al LED y pisadas hasta ver el LED encendido
 *   5. balance de energía (tabla corta)
 *   6. vista «escalera»: 15 módulos, energía por persona, por hora y por día
 *
 * Variables del usuario: SOLO el peso de la pisada (40–120 kg) y el flujo de
 * tránsito (personas/hora). Materiales y geometría están bloqueados en el
 * modelo de referencia. La config de interfaz sobrevive en IndexedDB
 * (capa `sim/storage`), sin backend.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { TileResult } from '../../sim/types';
import { PartId } from '../../bom/bom';
import { StepClock } from './clock';
import { ViewerPane } from './ViewerPane';
import { Schematic } from './Schematic';
import { BomTable } from './BomTable';
import { ReportTab } from '../ReportTab';
import { ViewMode } from '../../render/viewer';
import { INPUTS, G } from '../../core/referenceModel';
import { fmt, fmtSI } from './theme';
import { get as loadPrefs, set as savePrefs } from '../../sim/storage';

/** Módulos de la escalera y horas activas asumidas para la vista simple. */
const STAIR_MODULES = 15;
const WORK_HOURS = 12;
/**
 * Corriente a partir de la cual consideramos que el LED rojo se ve (sala
 * oscura). Es un umbral de presentación: el número de pisadas se mide sobre la
 * trama i(t) que devuelve el solver (result.series), nunca con una fórmula
 * aparte. Con el modelo validado el LED conduce desde el paso 1; por debajo de
 * ~450 N el pico real no alcanza este umbral y la KPI muestra «no llega».
 */
const LED_VISIBLE_A = 0.1e-3;
/** Peso [kg] → fuerza pico [N]: F = m·G·1.3, factor dinámico de talón. */
const KG2N = G * 1.3;

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'perspective', label: 'perspectiva' },
  { id: 'orthographic', label: 'ortogonal' },
  { id: 'section', label: 'corte' },
  { id: 'wireframe', label: 'alambre' },
];

export const TileWorkbench: React.FC = () => {
  const app = useApp();
  const inputs = app.tileInputs;
  const result = app.tileResult;
  const solving = app.tileBusy;

  const [selected, setSelected] = useState<PartId | null>(null);
  const [screen, setScreen] = useState<'modulo' | 'reporte'>('modulo');
  const [view, setView] = useState<ViewMode>('perspective');
  const [section, setSection] = useState(0);
  const [explodeFactor, setExplodeFactor] = useState(0);
  const [flow, setFlow] = useState(100);

  // La config de interfaz se recupera de IndexedDB: nada de backend.
  useEffect(() => {
    let alive = true;
    loadPrefs()
      .then((p) => {
        if (!alive) return;
        const known = VIEWS.map((v) => v.id) as string[];
        if (p.view && known.includes(p.view)) setView(p.view as ViewMode);
        setSection(p.section ?? 0);
        setExplodeFactor(p.explodeFactor ?? 0);
        setFlow(p.flowPerHour ?? 100);
      })
      .catch(() => {
        /* Sin almacenamiento local disponible: se quedan los valores por defecto. */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    savePrefs({ view, section, explodeFactor, flowPerHour: flow }).catch(() => {
      /* Si la BD local aún se está saneando, la próxima escritura reintenta. */
    });
  }, [view, section, explodeFactor, flow]);

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

  const kg = Math.round(inputs.Fmax / KG2N);
  const pct = Math.round(explodeFactor * 100);

  return (
    <div className="demo-shell" data-testid="demo-shell">
      {/* barra CAD: vistas, factor de explosión, pisar y tabs */}
      <header className="demo-bar">
        <span className="demo-title">módulo de grada piezoeléctrica</span>
        <div className="cad-seg demo-tabs" data-testid="demo-tabs">
          <button type="button" className={screen === 'modulo' ? 'on' : ''} onClick={() => setScreen('modulo')}>
            módulo
          </button>
          <button type="button" className={screen === 'reporte' ? 'on' : ''} onClick={() => setScreen('reporte')}>
            reporte técnico
          </button>
        </div>

        {screen === 'modulo' && (
          <>
            <div className="demo-bar-group" data-testid="view-toolbar">
              <span className="demo-bar-label">vista</span>
              <div className="cad-seg">
                {VIEWS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={view === v.id ? 'on' : ''}
                    onClick={() => setView(v.id)}
                    data-testid={`view-${v.id}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              {view === 'section' && (
                <label className="demo-mini">
                  offset
                  <input
                    type="range"
                    min={-48}
                    max={48}
                    step={1}
                    value={section}
                    onChange={(e) => setSection(Number(e.target.value))}
                    data-testid="section-offset"
                  />
                  <b>{section} mm</b>
                </label>
              )}
            </div>

            <div className="demo-bar-group demo-explode" data-testid="explode-ctl">
              <span className="demo-bar-label">factor de explosión CAD</span>
              <button type="button" className="cad-btn" onClick={() => setExplodeFactor(0)} data-testid="btn-ensamblar">
                ensamblar
              </button>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={pct}
                onChange={(e) => setExplodeFactor(Number(e.target.value) / 100)}
                data-testid="explode-slider"
              />
              <b className="demo-explode-pct">{pct} %</b>
              <button type="button" className="cad-btn" onClick={() => setExplodeFactor(1)} data-testid="btn-desplegar">
                desplegar
              </button>
            </div>

            <div className="demo-bar-actions">
              <button type="button" className="cad-btn" onClick={pisar} data-testid="btn-pisar">
                pisar
              </button>
            </div>
          </>
        )}
      </header>

      {screen === 'reporte' ? (
        <div className="demo-report" data-testid="demo-report">
          <ReportTab flowPerHour={flow} />
        </div>
      ) : (
        <div className="demo-body">
          {/* 1 + 2 · visor 3D; al desplegar, el BOM de las 9 piezas */}
          <section className="demo-viewer-col" data-testid="demo-viewer-col">
            <div className="demo-viewer">
              <ViewerPane
                inputs={inputs}
                result={result}
                clock={clock}
                exaggeration={result?.renderExaggeration ?? 1}
                view={view}
                explodeFactor={explodeFactor}
                dims={false}
                balloons={explodeFactor > 0.5}
                section={section}
                selected={selected}
                hidden={[]}
                onSelect={setSelected}
                onHover={() => undefined}
              />
            </div>
            {explodeFactor >= 0.55 ? (
              <div className="demo-bom" data-testid="demo-bom">
                <BomTable selected={selected} onSelect={setSelected} />
              </div>
            ) : (
              <div className="demo-force" data-testid="demo-force">
                <label htmlFor="demo-kg">peso de la pisada</label>
                <input
                  id="demo-kg"
                  type="range"
                  min={40}
                  max={120}
                  step={1}
                  value={kg}
                  onChange={(e) => app.patchTile({ Fmax: Math.round((Number(e.target.value) * KG2N) / 10) * 10 })}
                  data-testid="demo-kg"
                />
                <b>{kg} kg</b>
                <span className="dim">
                  {inputs.Fmax} N · F = m·g·1.3 · {INPUTS.Fmax.min}–1530 N
                </span>
                <span className="demo-force-sep" aria-hidden="true" />
                <label htmlFor="demo-flow">flujo de tránsito</label>
                <input
                  id="demo-flow"
                  type="range"
                  min={20}
                  max={400}
                  step={10}
                  value={flow}
                  onChange={(e) => setFlow(Number(e.target.value))}
                  data-testid="demo-flow"
                />
                <b>{flow} pers/h</b>
                <span className="dim">única variable de uso: peso y flujo; nada más es editable</span>
              </div>
            )}
          </section>

          {/* 3–6 · resultados, esquema, balance y escalera */}
          <aside className="demo-side" data-testid="demo-side">
            {/* 4 · los cuatro números grandes */}
            <div className="cad-subhead">
              <span>resultados por pisada</span>
              <span className="dim">PZT-5A · modo 33</span>
            </div>
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
            <div className="cad-subhead">
              <span>esquema del circuito</span>
              <span className="dim">sincronizado con el 3D</span>
            </div>
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
                <span className="dim">{flow} personas/h · {WORK_HOURS} h activas/día</span>
              </div>
              <div className="demo-stairs-row" aria-hidden="true">
                {Array.from({ length: STAIR_MODULES }, (_, i) => (
                  <span key={i} className="demo-stair-cell">
                    {i + 1}
                  </span>
                ))}
              </div>
              <StairsFacts result={result} flow={flow} />
            </div>
          </aside>
        </div>
      )}
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

/** Cuatro cifras de la escalera: por pisada, persona, hora y día. */
const StairsFacts: React.FC<{ result: TileResult | null; flow: number }> = ({ result, flow }) => {
  if (!result) return <p className="cad-empty">resolviendo…</p>;
  const perStep = result.E_harvested;
  const perPerson = perStep * STAIR_MODULES;
  const perHour = perPerson * flow;
  const perDay = perHour * WORK_HOURS;
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
        <tr data-testid="stairs-hour">
          <td>por hora ({flow} personas)</td>
          <td className="num val">{fmtSI(perHour, 'J', 1)}</td>
        </tr>
        <tr data-testid="stairs-day">
          <td>por día ({WORK_HOURS} h activas)</td>
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
