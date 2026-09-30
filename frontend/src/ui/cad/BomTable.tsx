/**
 * Tabla de materiales (BOM) de las nueve piezas.
 *
 * Filas siempre visibles, sin paginado ni plegado. La fila seleccionada es la
 * misma que la del visor 3D y la del árbol.
 */
import React from 'react';
import { BOM, PartId } from '../../bom/bom';

interface Props {
  selected: PartId | null;
  onSelect: (id: PartId | null) => void;
}

export const BomTable: React.FC<Props> = ({ selected, onSelect }) => {
  const totalUds = BOM.reduce((a, b) => a + b.qty, 0);
  return (
    <div className="cad-bom" data-testid="cad-bom">
      <div className="cad-subhead">
        <span>lista de materiales</span>
        <span className="dim">
          {BOM.length} referencias · {totalUds} unidades
        </span>
      </div>
      <table className="cad-table">
        <thead>
          <tr>
            <th className="num">globo</th>
            <th>pieza</th>
            <th>especificación</th>
            <th className="num">cant.</th>
          </tr>
        </thead>
        <tbody>
          {BOM.map((b) => {
            const on = selected === b.id;
            return (
              <tr
                key={b.id}
                className={on ? 'sel' : ''}
                onClick={() => onSelect(on ? null : b.id)}
                data-testid={`bom-${b.id}`}
                data-selected={on ? 'yes' : 'no'}
              >
                <td className="num">
                  <span className="cad-balloon">{b.balloon}</span>
                </td>
                <td>{b.desc}</td>
                <td className="dim spec">{b.spec}</td>
                <td className="num">
                  {b.qty} {b.unit}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
