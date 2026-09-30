/**
 * Balance de energía de un pisada en régimen estacionario.
 *
 * Tabla plana, siempre visible, con el porcentaje respecto al eslabón anterior
 * y la fórmula de cada magnitud. El desglose incluye la pérdida en el puente
 * porque es lo que separa E_extraída de E_almacenada: sin ella, los
 * porcentajes de la cadena no cuadran.
 *
 * Si algún eslabón supera al anterior, la fila se pinta en rojo y aparece el
 * aviso `viola conservación`: es el fallo de C11, visible y no silencioso.
 */
import React from 'react';
import { CIRCUIT } from '../../core/referenceModel';
import { TileResult } from '../../sim/types';
import { fmt, fmtSI } from './theme';

interface Props {
  result: TileResult | null;
}

interface Link {
  key: string;
  label: string;
  /** Valor en joules por pisada. */
  E: number;
  /** Fórmula shown en la tercera columna. */
  formula: string;
  /** Eslabón padre: undefined para la raíz de la cadena. */
  parent?: string;
  /** `sub` = desglose dentro del padre; `main` = eslabón de la cadena. */
  kind: 'main' | 'sub';
}

export const EnergyBalance: React.FC<Props> = ({ result }) => {
  if (!result) {
    return (
      <div className="cad-balance" data-testid="cad-balance">
        <div className="cad-subhead">
          <span>balance de energía por pisada</span>
        </div>
        <p className="cad-empty">resolviendo…</p>
      </div>
    );
  }

  const c = result.chain;
  const links: Link[] = [
    {
      key: 'U_el',
      label: 'electricidad total del elemento',
      E: c.U_el,
      formula: 'U = S_max·F_max·T_p·3/8',
      kind: 'main',
    },
    {
      key: 'E_ideal',
      label: 'energía ideal en circuito abierto',
      E: c.E_ideal,
      formula: 'E_ideal = ½·C_total·V_oc²',
      kind: 'main',
    },
    {
      key: 'E_extracted',
      label: 'energía extraída (sale del piezo al puente)',
      E: c.E_extracted,
      formula: '∮ (V_p − 2·V_d)·i dt',
      kind: 'main',
    },
    {
      key: 'E_bridge',
      label: `pérdida en el puente (2 × ${CIRCUIT.diodeModel})`,
      E: result.E_bridgeLoss,
      formula: 'E = 2·V_d·∮|i| dt',
      parent: 'E_extracted',
      kind: 'sub',
    },
    {
      key: 'E_stored',
      label: 'energía almacenada en el nodo C_s + R',
      E: c.E_stored,
      formula: 'E_almacenada = E_extraída − E_puente',
      kind: 'main',
    },
    {
      key: 'E_R',
      label: `disipada en R (${CIRCUIT.Rload} Ω)`,
      E: result.E_R,
      formula: 'E = ∮ i²·R dt',
      parent: 'E_stored',
      kind: 'sub',
    },
    {
      key: 'E_LED',
      label: 'consumida en el LED',
      E: c.E_LED,
      formula: 'E = ∮ V_f·i dt',
      kind: 'main',
    },
  ];

  const byKey = new Map(links.map((l) => [l.key, l.E]));

  // Cierre del balance: la suma de salidas debe igualar la energía eléctrica
  // entregada por el piezo. Es la comprobación que delata un modelo roto.
  const cierre = byKey.get('E_LED')! + byKey.get('E_R')! + byKey.get('E_bridge')!;
  const relCierre = cierre > 0 ? Math.abs(cierre - c.U_el) / c.U_el : 0;
  const okCierre = relCierre < 1e-6;

  // Monotonía de la cadena principal.
  let violada = '';
  for (let i = 1; i < links.length; i++) {
    const l = links[i];
    if (l.kind !== 'main') continue;
    const prev = links.slice(0, i).reverse().find((p) => p.kind === 'main')!;
    if (l.E > prev.E * (1 + 1e-6) + 1e-18) {
      violada = l.key;
      break;
    }
  }

  return (
    <div className="cad-balance" data-testid="cad-balance">
      <div className="cad-subhead">
        <span>balance de energía por pisada</span>
        <span className="dim">régimen estacionario</span>
      </div>

      <table className="cad-table">
        <thead>
          <tr>
            <th>magnitud</th>
            <th className="num">valor</th>
            <th className="num">% anterior</th>
            <th>fórmula</th>
          </tr>
        </thead>
        <tbody>
          {links.map((l) => {
            const ref = l.parent ? byKey.get(l.parent)! : prevMain(links, l.key);
            const pct = ref && ref > 0 ? (l.E / ref) * 100 : null;
            const bad = l.kind === 'main' && violada === l.key;
            return (
              <tr
                key={l.key}
                className={`${l.kind === 'sub' ? 'sub' : ''}${bad ? ' bad' : ''}`}
                data-testid={`bal-${l.key}`}
              >
                <td className={l.kind === 'sub' ? 'sub-name' : ''}>{l.label}</td>
                <td className="num val">
                  {fmtSI(l.E, 'J', 3)}
                  {bad && <span className="flag"> viola conservación</span>}
                </td>
                <td className="num dim">{pct === null ? '—' : `${fmt(pct, 1)} %`}</td>
                <td className="dim src">{l.formula}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="cad-balance-foot" data-testid="bal-close">
        <span className={okCierre ? 'ok' : 'bad'}>
          cierre: Σ salidas {fmtSI(cierre, 'J', 3)} frente a U_el {fmtSI(c.U_el, 'J', 3)} ·{' '}
          {okCierre ? 'conserva' : 'no conserva'} ({fmt(relCierre * 100, 4)} %)
        </span>
        <span className="dim">
          E_almacenada es un flujo hacia el nodo C_s + R, no el contenido instantáneo ½·C_s·V_c²
        </span>
      </div>

      {violada && (
        <div className="cad-alert" data-testid="bal-violation">
          <span className="sq bad" /> viola conservación: {violada} supera al eslabón anterior
        </div>
      )}
      {result.alerts.map((a) => (
        <div className="cad-alert" key={a.code} data-testid={`alert-${a.code}`}>
          <span className="sq warn" /> {a.message}
        </div>
      ))}
    </div>
  );
};

/** Eslabón principal inmediatamente anterior a `key` en la lista. */
function prevMain(links: Link[], key: string): number | null {
  const i = links.findIndex((l) => l.key === key);
  for (let k = i - 1; k >= 0; k--) {
    if (links[k].kind === 'main') return links[k].E;
  }
  return null;
}
