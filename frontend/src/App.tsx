/**
 * Raíz de la aplicación.
 *
 * `/` muestra la landing; `/#simulation` abre el banco de trabajo del módulo
 * de grada, sin cambios de interfaz. Encima se mantiene la barra de menú de
 * PiezoLab para volver a la landing. El banco se carga aparte para que la
 * landing no descargue Three.js hasta que alguien pulse «Simulation».
 *
 * La viga, la validación y el informe siguen vivos en el repositorio
 * (`ui/BeamSim.tsx`, `ui/ReportTab.tsx`, `core/beam.ts`), pero ya no se
 * enlazan desde la interfaz.
 */
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Landing } from './landing/Landing';
import { MenuBar, SIMULATION_HASH } from './landing/MenuBar';
import './landing/landing.css';

const TileWorkbench = lazy(() =>
  import('./ui/cad/TileWorkbench').then((m) => ({ default: m.TileWorkbench })),
);

function isSimulationHash(): boolean {
  return window.location.hash === SIMULATION_HASH;
}

export default function App() {
  const [simulation, setSimulation] = useState(isSimulationHash);

  useEffect(() => {
    const onHash = () => setSimulation(isSimulationHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!simulation) return <Landing />;
  return (
    <div className="pz-sim-shell">
      <MenuBar mode="simulation" />
      <div className="pz-sim-stage">
        <Suspense fallback={null}>
          <TileWorkbench />
        </Suspense>
      </div>
    </div>
  );
}
