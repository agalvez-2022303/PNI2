/**
 * Raíz de la aplicación.
 *
 * Sólo se implementa la simulación 1 (grada), que ocupa toda la ventana. Las
 * demás conservan su entrada en la barra superior, marcada como pendiente, para
 * que el alcance de la herramienta quede a la vista sin enlaces roto.
 *
 * El hash `#beam` y `#report` siguen montando las vistas ya existentes para no
 * perder trabajo previo: no forman parte de la pantalla CAD.
 */
import React, { useEffect, useRef, useState } from 'react';
import { TileWorkbench } from './ui/cad/TileWorkbench';
import { BeamSim } from './ui/BeamSim';
import { ReportTab } from './ui/ReportTab';
import { useApp } from './ui/store';
import { importArchive } from './sim/storage';

type View = 'cad' | 'beam' | 'report';

const VALID: View[] = ['cad', 'beam', 'report'];

function initialView(): View {
  const h = (typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '') as View;
  if (h === 'beam' || h === 'report') return h;
  return 'cad';
}

export default function App() {
  const app = useApp();
  const [view, setView] = useState<View>(initialView);
  const [ioMsg, setIoMsg] = useState('');
  const runsFile = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#', '') as View;
      if (VALID.includes(h)) setView(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const importRuns = async (file: File) => {
    try {
      const { runs, validation } = await importArchive(await file.text());
      await app.reloadRuns();
      setIoMsg(`importadas ${runs} corrida(s) y ${validation} validación(es)`);
    } catch (e) {
      setIoMsg('no se pudo importar: ' + (e as Error).message);
    }
  };

  if (view === 'beam') {
    return (
      <div className="legacy">
        <LegacyBar onBack={() => setView('cad')} onImport={() => runsFile.current?.click()} />
        <BeamSim />
        <input
          ref={runsFile}
          type="file"
          accept=".json"
          hidden
          onChange={(e) => e.target.files?.[0] && importRuns(e.target.files[0])}
        />
      </div>
    );
  }

  if (view === 'report') {
    return (
      <div className="legacy">
        <LegacyBar onBack={() => setView('cad')} onImport={() => runsFile.current?.click()} />
        <ReportTab />
        <input
          ref={runsFile}
          type="file"
          accept=".json"
          hidden
          onChange={(e) => e.target.files?.[0] && importRuns(e.target.files[0])}
        />
      </div>
    );
  }

  return <TileWorkbench />;
}

/**
 * Barra mínima para las vistas heredadas. La pantalla CAD no la usa: la fase 2
 * quita la barra de pestañas y deja la pantalla completa para el modelo.
 */
const LegacyBar: React.FC<{ onBack: () => void; onImport: () => void }> = ({ onBack, onImport }) => (
  <div className="cad-top legacy-bar">
    <button type="button" className="cad-btn" onClick={onBack} data-testid="back-cad">
      volver a la pantalla cad
    </button>
    <span className="cad-group-lbl">vistas heredadas: no forman parte de la fase 2</span>
    <span className="grow" />
    <button type="button" className="cad-btn" onClick={onImport} data-testid="legacy-import">
      importar corridas
    </button>
  </div>
);
