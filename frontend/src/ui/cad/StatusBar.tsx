/**
 * Barra de estado: unidades, coordenadas del cursor, solver y hash del modelo.
 *
 * Las coordenadas vienen del rayo del cursor contra el plano de trabajo, en mm,
 * y se leen en el mismo cuadro que el 3D.
 */
import React from 'react';
import { fmt } from './theme';

interface Props {
  cursor: { x: number; y: number; z: number } | null;
  modelHash: string;
  solver: string;
  nStepsRun: number | null;
  nStepsRequested: number | null;
  alerts: number;
  violation: boolean;
}

export const StatusBar: React.FC<Props> = (p) => {
  return (
    <footer className="cad-status" data-testid="cad-status">
      <span className="st" data-testid="st-units">
        unidades: mm
      </span>
      <span className="st" data-testid="st-coords">
        x {p.cursor ? fmt(p.cursor.x, 1) : '—'} · y {p.cursor ? fmt(p.cursor.y, 1) : '—'} · z{' '}
        {p.cursor ? fmt(p.cursor.z, 1) : '—'} mm
      </span>
      <span className="st" data-testid="st-solver">
        solver: {p.solver}
      </span>
      <span className="st" data-testid="st-steps">
        pisadas: {p.nStepsRun ?? '—'}
        {p.nStepsRequested !== null ? ` de ${p.nStepsRequested}` : ' (automático)'}
      </span>
      {p.alerts > 0 && (
        <span className="st warn-t" data-testid="st-alerts">
          avisos: {p.alerts}
        </span>
      )}
      {p.violation && (
        <span className="st bad" data-testid="st-violation">
          viola conservación
        </span>
      )}
      <span className="st grow" />
      <span className="st dim" data-testid="st-hash">
        modelo {p.modelHash}
      </span>
    </footer>
  );
};
