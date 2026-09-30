/**
 * Árbol del ensamble (zona izquierda superior).
 *
 * Cada fila lleva: globo, nombre, casilla de visibilidad y fila seleccionable.
 * La selección es la MISMA que la del visor 3D y la del BOM: un solo `id`
 * viaja por los tres sitios, así que pinchar en cualquier vista resalta las
 * otras dos.
 */
import React from 'react';
import { BOM, TREE_GROUPS, PartId } from '../../bom/bom';

interface Props {
  selected: PartId | null;
  hidden: PartId[];
  onSelect: (id: PartId | null) => void;
  onToggle: (id: PartId) => void;
  onSelectAll: (visible: boolean) => void;
}

export const TreePane: React.FC<Props> = ({ selected, hidden, onSelect, onToggle, onSelectAll }) => {
  const isHidden = (id: PartId) => hidden.includes(id);
  const allVisible = hidden.length === 0;

  return (
    <div className="cad-tree" data-testid="cad-tree">
      <div className="cad-subhead">
        <span>ensamble · módulo de grada</span>
        <button
          type="button"
          className="cad-mini"
          onClick={() => onSelectAll(!allVisible)}
          data-testid="tree-toggle-all"
        >
          {allVisible ? 'ocultar todo' : 'mostrar todo'}
        </button>
      </div>

      {TREE_GROUPS.map((g) => (
        <div key={g.id} className="cad-tree-group">
          <div className="cad-tree-group-head">{g.label}</div>
          {BOM.filter((b) => b.group === g.id).map((b) => {
            const on = selected === b.id;
            const off = isHidden(b.id);
            return (
              <div
                key={b.id}
                className={`cad-tree-row${on ? ' sel' : ''}${off ? ' off' : ''}`}
                onClick={() => onSelect(on ? null : b.id)}
                data-testid={`tree-${b.id}`}
                data-selected={on ? 'yes' : 'no'}
              >
                <input
                  type="checkbox"
                  checked={!off}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggle(b.id)}
                  data-testid={`tree-vis-${b.id}`}
                  aria-label={`visibilidad ${b.desc}`}
                />
                <span className="cad-balloon">{b.balloon}</span>
                <span className="cad-tree-name">{b.desc}</span>
                <span className="cad-tree-qty">
                  {b.qty} {b.unit}
                </span>
              </div>
            );
          })}
        </div>
      ))}

      <div className="cad-tree-hint">los números coinciden con los globos del visor 3D</div>
    </div>
  );
};
