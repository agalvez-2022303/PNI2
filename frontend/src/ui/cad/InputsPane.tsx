/**
 * Entradas del usuario de la simulación 1 (grada).
 *
 * Sólo tres entradas: F_max, cadencia y número de pisadas. Materiales,
 * geometría, C_s, R y pérdidas NO son entradas: salen del modelo de referencia
 * y se muestran en la tabla de parámetros como solo lectura.
 */
import React from 'react';
import { INPUTS, G } from '../../core/referenceModel';
import { N_STEPS_CHOICES } from '../../sim/defaults';
import { TileInputs } from '../../sim/types';
import { fmt } from './theme';

interface Props {
  inputs: TileInputs;
  onChange: (p: TileInputs) => void;
  solving: boolean;
}

export const InputsPane: React.FC<Props> = ({ inputs, onChange, solving }) => {
  const F = INPUTS.Fmax;
  const C = INPUTS.cadence;
  const set = (patch: Partial<TileInputs>) => onChange({ ...inputs, ...patch });

  return (
    <div className="cad-inputs" data-testid="cad-inputs">
      <div className="cad-subhead">
        <span>entradas</span>
        <span className="dim">{solving ? 'resolviendo…' : 'resuelto'}</span>
      </div>

      <div className="cad-field">
        <label htmlFor="in-fmax">fuerza pico F_max</label>
        <div className="cad-field-row">
          <input
            id="in-fmax"
            type="range"
            min={F.min}
            max={F.max}
            step={F.step}
            value={inputs.Fmax}
            onChange={(e) => set({ Fmax: Number(e.target.value) })}
            data-testid="in-fmax"
          />
          <input
            type="number"
            min={F.min}
            max={F.max}
            step={F.step}
            value={inputs.Fmax}
            onChange={(e) => set({ Fmax: Number(e.target.value) })}
            data-testid="in-fmax-num"
            aria-label="fuerza pico en newtons"
          />
          <span className="unit">N</span>
        </div>
        <div className="cad-field-foot">
          <span>
            {F.min}–{F.max} N · defecto {F.def} N
          </span>
          <span className="dim">
            equivale a {fmt(inputs.Fmax / (G * 1.3), 1)} kg de persona con k_din = 1.3
          </span>
        </div>
      </div>

      <div className="cad-field">
        <label htmlFor="in-cadence">cadencia de pisado</label>
        <div className="cad-field-row">
          <input
            id="in-cadence"
            type="range"
            min={C.min}
            max={C.max}
            step={C.step}
            value={inputs.cadence}
            onChange={(e) => set({ cadence: Number(e.target.value) })}
            data-testid="in-cadence"
          />
          <input
            type="number"
            min={C.min}
            max={C.max}
            step={C.step}
            value={inputs.cadence}
            onChange={(e) => set({ cadence: Number(e.target.value) })}
            data-testid="in-cadence-num"
            aria-label="cadencia en pasos por minuto"
          />
          <span className="unit">pasos/min</span>
        </div>
        <div className="cad-field-foot">
          <span>
            {C.min}–{C.max} pasos/min · defecto {C.def}
          </span>
          <span className="dim">T_p = {fmt(60 / inputs.cadence, 3)} s</span>
        </div>
      </div>

      <div className="cad-field">
        <label htmlFor="in-nsteps">número de pisadas</label>
        <div className="cad-seg" id="in-nsteps" role="radiogroup" aria-label="número de pisadas">
          {N_STEPS_CHOICES.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={inputs.nSteps === n}
              className={inputs.nSteps === n ? 'on' : ''}
              onClick={() => set({ nSteps: n })}
              data-testid={`in-nsteps-${n}`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="cad-field-foot">
          <span>integración corta, media y larga</span>
          <span className="dim">
            {inputs.nSteps === undefined
              ? 'automático hasta régimen estacionario'
              : `${resultNote(inputs.nSteps)}`}
          </span>
        </div>
      </div>
    </div>
  );
};

function resultNote(n: number): string {
  if (n === 1) return 'un solo paso: no alcanza el régimen';
  if (n === 10) return '10 pasos: régimen casi alcanzado';
  return '50 pasos: régimen estacionario alcanzado';
}
