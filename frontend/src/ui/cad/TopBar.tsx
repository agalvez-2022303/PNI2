/**
 * Barra superior: proyecto, simulaciones, vistas, desplegar y exportar.
 *
 * Las cinco simulaciones están siempre visibles. Sólo la 1 está implementada:
 * las demás se muestran como pendientes en lugar de desaparecer, para que se
 * vea el alcance de la herramienta.
 */
import React from 'react';
import { ViewMode } from '../../render/viewer';

interface Props {
  sim: number;
  onSim: (n: number) => void;
  view: ViewMode;
  onView: (v: ViewMode) => void;
  exploded: boolean;
  onExploded: (v: boolean) => void;
  dims: boolean;
  onDims: (v: boolean) => void;
  balloons: boolean;
  onBalloons: (v: boolean) => void;
  playing: boolean;
  onPlaying: (v: boolean) => void;
  section: number;
  onSection: (v: number) => void;
  onExport: () => void;
  modelHash: string;
}

const SIMS: { n: number; label: string }[] = [
  { n: 1, label: 'grada' },
  { n: 2, label: 'viga' },
  { n: 3, label: 'escalera' },
  { n: 4, label: 'validación' },
  { n: 5, label: 'informe' },
];

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'perspective', label: 'perspectiva' },
  { id: 'orthographic', label: 'ortogonal' },
  { id: 'section', label: 'corte' },
  { id: 'wireframe', label: 'alambre' },
];

export const TopBar: React.FC<Props> = (p) => {
  return (
    <header className="cad-top" data-testid="cad-topbar">
      <div className="cad-top-brand">
        <span className="cad-top-proj">PNI2 · Harvesto de energía piezoelectrico</span>
        <span className="cad-top-sim">simulación {p.sim} de 5</span>
      </div>

      <nav className="cad-top-sims" aria-label="simulaciones">
        {SIMS.map((s) => (
          <button
            key={s.n}
            type="button"
            className={`cad-tab${p.sim === s.n ? ' on' : ''}${s.n === 1 ? '' : ' pend'}`}
            onClick={() => s.n === 1 && p.onSim(s.n)}
            disabled={s.n !== 1}
            data-testid={`tab-sim-${s.n}`}
            data-pending={s.n === 1 ? 'no' : 'yes'}
          >
            {s.n} {s.label}
            {s.n !== 1 && <span className="cad-tab-pend">pendiente</span>}
          </button>
        ))}
      </nav>

      <div className="cad-top-tools">
        <div className="cad-group" role="group" aria-label="vista">
          <span className="cad-group-lbl">vista</span>
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`cad-btn${p.view === v.id ? ' on' : ''}`}
              onClick={() => p.onView(v.id)}
              data-testid={`view-${v.id}`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="cad-group" role="group" aria-label="capas">
          <span className="cad-group-lbl">capas</span>
          <button
            type="button"
            className={`cad-btn${p.dims ? ' on' : ''}`}
            onClick={() => p.onDims(!p.dims)}
            data-testid="toggle-dims"
          >
            cotas
          </button>
          <button
            type="button"
            className={`cad-btn${p.balloons ? ' on' : ''}`}
            onClick={() => p.onBalloons(!p.balloons)}
            data-testid="toggle-balloons"
          >
            globos
          </button>
        </div>

        {p.view === 'section' && (
          <label className="cad-group cad-slide" data-testid="section-group">
            <span className="cad-group-lbl">corte z</span>
            <input
              type="range"
              min={-30}
              max={30}
              step={1}
              value={p.section}
              onChange={(e) => p.onSection(Number(e.target.value))}
              data-testid="in-section"
            />
            <span className="num">{p.section} mm</span>
          </label>
        )}

        <div className="cad-group">
          <button
            type="button"
            className={`cad-btn${p.exploded ? ' on' : ''}`}
            onClick={() => p.onExploded(!p.exploded)}
            data-testid="btn-explode"
          >
            {p.exploded ? 'reensamblar' : 'vista desplegada'}
          </button>
          <button
            type="button"
            className={`cad-btn${p.playing ? ' on' : ''}`}
            onClick={() => p.onPlaying(!p.playing)}
            data-testid="btn-play"
          >
            {p.playing ? 'pausar' : 'animar'}
          </button>
          <button type="button" className="cad-btn" onClick={p.onExport} data-testid="btn-export">
            exportar
          </button>
        </div>
      </div>
    </header>
  );
};
