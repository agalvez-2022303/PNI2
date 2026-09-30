/**
 * Resultados de la simulación 1, en vivo.
 *
 * Cada fila lleva magnitud, valor, unidad, la fórmula con la que se ha
 * calculado y el valor de referencia con su desviación, para que cada número
 * sea comprobable sin salir de la pantalla.
 */
import React from 'react';
import { CIRCUIT, STACK, ALERTS, G } from '../../core/referenceModel';
import { stackCapacitance } from '../../core/tile';
import { TileResult } from '../../sim/types';
import { fmt } from './theme';

interface Props {
  result: TileResult | null;
  solving: boolean;
}

interface Ref {
  value: number;
  unit: string;
}

export const ResultsPane: React.FC<Props> = ({ result, solving }) => {
  if (!result) {
    return (
      <div className="cad-results" data-testid="cad-results">
        <div className="cad-subhead">
          <span>resultados</span>
        </div>
        <p className="cad-empty">{solving ? 'resolviendo…' : 'sin resultados'}</p>
      </div>
    );
  }

  const r = result;
  // Referencia de la capacidad: 4 stacks idénticos en paralelo.
  const cpRef = 4 * stackCapacitance(STACK.nLayers) * 1e9;

  const rows: { name: string; v: number; unit: string; formula: string; ref?: Ref }[] = [
    {
      name: 'capacidad total C_total',
      v: r.Cp * 1e9,
      unit: 'nF',
      formula: 'C = n·ε·A/t',
      ref: { value: cpRef, unit: 'nF' },
    },
    { name: 'carga de pico Q', v: r.Q * 1e6, unit: 'µC', formula: 'Q = d33·F_max' },
    { name: 'tensión en vacío V_oc', v: r.Voc, unit: 'V', formula: 'V_oc = Q/C_total' },
    {
      name: 'esfuerzo por stack σ',
      v: r.stress / 1e6,
      unit: 'MPa',
      formula: 'σ = F_max/(n·A)',
      ref: { value: ALERTS.sigmaLimit / 1e6, unit: 'MPa' },
    },
    { name: 'deformación S', v: r.strain * 1e6, unit: 'µstrain', formula: 'S = σ·s33ᴱ' },
    {
      name: 'aplastamiento δ del stack',
      v: r.compression * 1e6,
      unit: 'µm',
      formula: 'δ = S·T',
    },
    {
      name: 'tensión de C_s en régimen',
      v: r.VcSteady,
      unit: 'V',
      formula: 'máximo del rizado en el paso',
      ref: { value: ALERTS.voltageLimit, unit: 'V' },
    },
    {
      name: 'corriente pico del LED',
      v: r.ILedPeak * 1e3,
      unit: 'mA',
      formula: 'I_LED = (V_c − V_f)/R',
      ref: { value: 20, unit: 'mA' },
    },
    {
      name: 'potencia media al LED',
      v: r.avgPowerLED * 1e6,
      unit: 'µW',
      formula: 'P = E_LED/T_p',
    },
    {
      name: 'energía disipada en el puente',
      v: r.E_bridgeLoss * 1e6,
      unit: 'µJ',
      formula: 'E = 2·V_d·∮|i| dt',
    },
    {
      name: 'energía disipada en R',
      v: r.E_R * 1e6,
      unit: 'µJ',
      formula: 'E = ∮ i²·R dt',
    },
    {
      name: 'energía entregada al LED',
      v: r.E_LED * 1e6,
      unit: 'µJ',
      formula: 'E = ∮ V_f·i dt',
    },
    {
      name: 'energía cosechada por pisada',
      v: r.E_harvested * 1e6,
      unit: 'µJ',
      formula: 'E = E_LED + E_R',
      ref: { value: 700 / (G * 1.3), unit: 'kg' },
    },
    {
      name: 'acoplamiento del elemento k2_ef',
      v: r.k2Elemento,
      unit: '—',
      formula: 'k33²',
      ref: { value: 0.494, unit: '—' },
    },
    { name: 'η_cerámica', v: r.etaCeramic, unit: '—', formula: 'E_cosechada/U_el' },
    { name: 'η_módulo', v: r.etaModulo, unit: '—', formula: 'E_cosechada/∮F dδ' },
  ];

  return (
    <div className="cad-results" data-testid="cad-results">
      <div className="cad-subhead">
        <span>resultados</span>
        <span className="dim">
          {r.nStepsRequested === null
            ? `régimen alcanzado en ${r.nStepsRun} pisadas`
            : `${r.nStepsRun} de ${r.nStepsRequested} pisadas pedidos`}
        </span>
      </div>
      <table className="cad-table">
        <thead>
          <tr>
            <th>magnitud</th>
            <th className="num">valor</th>
            <th>unidad</th>
            <th>fórmula</th>
            <th className="num">referencia</th>
            <th className="num">desv.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSigma = row.name.startsWith('esfuerzo');
            const isV = row.name.startsWith('tensión de C');
            const over = isSigma ? row.v > ALERTS.sigmaLimit / 1e6 : isV ? row.v > ALERTS.voltageLimit : false;
            const dev =
              row.ref && row.ref.value !== 0 ? ((row.v - row.ref.value) / Math.abs(row.ref.value)) * 100 : null;
            return (
              <tr key={row.name} data-testid={`res-${row.name}`}>
                <td>{row.name}</td>
                <td className={`num val${over ? ' bad' : ''}`}>{fmt(row.v, 3)}</td>
                <td className="dim">{row.unit}</td>
                <td className="dim src">{row.formula}</td>
                <td className="num dim">
                  {row.ref ? `${fmt(row.ref.value, 3)} ${row.ref.unit}` : '—'}
                </td>
                <td
                  className={`num ${dev === null ? 'dim' : Math.abs(dev) < 1 ? 'ok' : 'warn-t'}`}
                >
                  {dev === null ? '—' : `${dev >= 0 ? '+' : ''}${fmt(dev, 2)} %`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="cad-foot-note">
        Los resultados se reportan sobre el último pisada completo. Variación relativa entre los dos
        últimos: {fmt(r.steadyRelVariation * 100, 3)} %. Modelo de referencia: {STACK.nLayers} capas
        por stack, C_s = {CIRCUIT.Cs * 1e6} µF, R = {CIRCUIT.Rload} Ω.
      </p>
    </div>
  );
};
