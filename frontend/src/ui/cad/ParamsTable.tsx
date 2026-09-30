/**
 * Parámetros del modelo de referencia, en modo SOLO LECTURA.
 *
 * La fase 2 no abre geometrías, materiales, Cs, R ni pérdidas a edición: son
 * parte del modelo de referencia (`core/referenceModel.ts`) y se muestran aquí
 * para que la pantalla sea autocontenida, con su procedencia explícita.
 *
 * Se lee el módulo de referencia directamente: no se duplica ningún valor, así
 * que la tabla no puede quedar desfasada respecto al solver.
 */
import React from 'react';
import { PZT5A, STACK, CIRCUIT, PULSE, ALERTS } from '../../core/referenceModel';
import { fmt, fmtSI } from './theme';

interface Row {
  grupo: string;
  nombre: string;
  valor: string;
  /** Origen del dato dentro del modelo de referencia. */
  ref: string;
}

const ROWS: Row[] = [
  { grupo: 'piezo', nombre: 'material', valor: 'PZT-5A', ref: 'PZT5A' },
  { grupo: 'piezo', nombre: 'd33', valor: `${fmt(PZT5A.d33 * 1e12, 0)} pC/N`, ref: 'PZT5A.d33' },
  { grupo: 'piezo', nombre: 'ε33ᵀ/ε0', valor: fmt(PZT5A.eps33TOverEps0, 0), ref: 'PZT5A.eps33TOverEps0' },
  { grupo: 'piezo', nombre: 's33ᴱ', valor: `${fmt(PZT5A.s33E * 1e12, 1)} pm/V`, ref: 'PZT5A.s33E' },
  { grupo: 'piezo', nombre: 'Y = 1/s33ᴱ', valor: fmtSI(1 / PZT5A.s33E, 'Pa'), ref: 'derivado' },
  { grupo: 'stack', nombre: 'stacks', valor: `${STACK.nStacks} ud`, ref: 'STACK.nStacks' },
  { grupo: 'stack', nombre: 'capas por stack', valor: `${STACK.nLayers}`, ref: 'STACK.nLayers' },
  { grupo: 'stack', nombre: 'espesor de capa', valor: `${STACK.layerThicknessMm} mm`, ref: 'STACK.layerThickness' },
  { grupo: 'stack', nombre: 'diámetro', valor: `ø ${STACK.diameterMm} mm`, ref: 'STACK.diameter' },
  { grupo: 'stack', nombre: 'altura total T', valor: `${STACK.totalThicknessMm} mm`, ref: 'STACK.totalThickness' },
  { grupo: 'pulsada', nombre: 'T_p (modelo)', valor: `${fmt(PULSE.Tp, 2)} s`, ref: 'PULSE.Tp' },
  {
    grupo: 'pulsada',
    nombre: 'perfil',
    valor: 'F = F_max·sin²(πt/T_p)',
    ref: 'core/tile.ts',
  },
  { grupo: 'circuito', nombre: 'puente', valor: `${CIRCUIT.nDiodes} × ${CIRCUIT.diodeModel}`, ref: 'CIRCUIT.diodeModel' },
  { grupo: 'circuito', nombre: 'V_diodo', valor: `${fmt(CIRCUIT.Vdiode, 2)} V`, ref: 'CIRCUIT.Vdiode' },
  { grupo: 'circuito', nombre: 'C_s', valor: fmtSI(CIRCUIT.Cs, 'F'), ref: 'CIRCUIT.Cs' },
  { grupo: 'circuito', nombre: 'R_load', valor: `${CIRCUIT.Rload} Ω`, ref: 'CIRCUIT.Rload' },
  { grupo: 'circuito', nombre: 'V_f del LED', valor: `${fmt(CIRCUIT.Vf, 2)} V`, ref: 'CIRCUIT.Vf' },
  { grupo: 'límites', nombre: 'esfuerzo', valor: `${ALERTS.sigmaLimit / 1e6} MPa`, ref: 'ALERTS.sigmaLimit' },
  { grupo: 'límites', nombre: 'tensión', valor: `${ALERTS.voltageLimit} V`, ref: 'ALERTS.voltageLimit' },
];

const GROUPS = ['piezo', 'stack', 'pulsada', 'circuito', 'límites'] as const;

export const ParamsTable: React.FC = () => {
  return (
    <div className="cad-params" data-testid="cad-params">
      <div className="cad-subhead">
        <span>parámetros del modelo</span>
        <span className="cad-tag-ro">solo lectura</span>
      </div>
      <table className="cad-table">
        <thead>
          <tr>
            <th>parámetro</th>
            <th className="num">valor</th>
            <th>origen</th>
          </tr>
        </thead>
        {GROUPS.map((g) => (
          <tbody key={g}>
            {ROWS.filter((r) => r.grupo === g).map((r) => (
              <tr key={r.nombre} data-testid={`param-${r.nombre}`}>
                <td className="dim">{r.nombre}</td>
                <td className="num val">{r.valor}</td>
                <td className="dim src">{r.ref}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
};
