/**
 * Raíz de la aplicación: una sola pantalla, la demo del módulo de grada.
 *
 * La viga, la validación y el informe siguen vivos en el repositorio
 * (`ui/BeamSim.tsx`, `ui/ReportTab.tsx`, `core/beam.ts`), pero ya no se
 * enlazan desde la interfaz: la demo es el alcance completo de esta pantalla.
 */
import React from 'react';
import { TileWorkbench } from './ui/cad/TileWorkbench';

export default function App() {
  return <TileWorkbench />;
}
