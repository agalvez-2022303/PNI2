/**
 * Cajetín del visor 3D (title block): título, escala, unidades, hash del modelo y
 * versión del proyecto.
 *
 * Va sobre el visor, nunca sobre una tarjeta: queda integrado a la zona central.
 */
import React from 'react';

interface Props {
  modelHash: string;
  units: 'mm';
}

export const TitleBlock: React.FC<Props> = ({ modelHash }) => {
  return (
    <div className="cad-titleblock" data-testid="cad-titleblock">
      <div className="tb-row">
        <span className="tb-title">módulo de grada · simulación 1</span>
        <span className="tb-id">id: {modelHash.slice(0, 8)}</span>
      </div>
      <div className="tb-row dim">
        <span>escala: gráfica</span>
        <span>unidades: mm · SI</span>
        <span>proyecto: PNI2</span>
        <span>fase 2 · cad</span>
      </div>
    </div>
  );
};
