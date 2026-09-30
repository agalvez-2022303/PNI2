import React, { useEffect, useRef, useState } from 'react';
import { TileSim } from '@/ui/TileSim';
import { BeamSim } from '@/ui/BeamSim';
import { ReportTab } from '@/ui/ReportTab';
import { useApp } from '@/ui/store';
import { downloadArchive, importArchive } from '@/sim/storage';
import { Footprints, Activity, FileText, Zap, Cpu, Save, FolderOpen, HardDriveDownload, HardDriveUpload } from 'lucide-react';

type Tab = 'tile' | 'beam' | 'report';

const VALID: Tab[] = ['tile', 'beam', 'report'];
function initialTab(): Tab {
  const h = (typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '') as Tab;
  return VALID.includes(h) ? h : 'tile';
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'tile', label: 'Simulación 1 · Baldosa', icon: <Footprints size={15} /> },
  { id: 'beam', label: 'Simulación 2 · Viga', icon: <Activity size={15} /> },
  { id: 'report', label: 'Reporte', icon: <FileText size={15} /> },
];

export default function App() {
  const [tab, setTabState] = useState<Tab>(initialTab);
  const setTab = (t: Tab) => {
    setTabState(t);
    if (typeof window !== 'undefined') window.location.hash = t;
  };
  const app = useApp();
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#', '') as Tab;
      if (VALID.includes(h)) setTabState(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const busy = (tab === 'tile' && app.tileBusy) || (tab === 'beam' && app.beamBusy);

  const runsFile = useRef<HTMLInputElement>(null);
  const [ioMsg, setIoMsg] = useState('');

  const saveRuns = () => {
    app.archiveCurrent().then(
      () => setIoMsg('Corrida guardada en IndexedDB'),
      () => setIoMsg('No se pudo guardar la corrida')
    );
  };
  const exportRuns = () => {
    downloadArchive().then(
      () => setIoMsg('Corridas exportadas'),
      () => setIoMsg('No se pudieron exportar las corridas')
    );
  };
  const importRuns = async (file: File) => {
    try {
      const { runs, validation } = await importArchive(await file.text());
      await app.reloadRuns();
      setIoMsg(`Importadas ${runs} corrida(s) y ${validation} validación(es)`);
    } catch (e) {
      setIoMsg('No se pudo importar: ' + (e as Error).message);
    }
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo">
            <Zap size={17} />
          </span>
          <span>
            PiezoLab
            <br />
            <small>Simulación 3D · Cosecha piezoeléctrica</small>
          </span>
        </div>
        <nav className="tabs" data-testid="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
              data-testid={`tab-${t.id}`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
        <div className="spacer" />
        <button className="btn sm ghost" onClick={saveRuns} data-testid="runs-save" title="Guardar la corrida actual en IndexedDB">
          <Save size={14} /> Guardar
        </button>
        <button className="btn sm ghost" onClick={exportRuns} data-testid="runs-export" title="Exportar corridas a JSON">
          <HardDriveDownload size={14} /> Exportar
        </button>
        <button className="btn sm ghost" onClick={() => runsFile.current?.click()} data-testid="runs-import" title="Importar corridas desde JSON">
          <FolderOpen size={14} /> Importar
        </button>
        <input
          ref={runsFile}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          data-testid="runs-file"
          onChange={(e) => e.target.files?.[0] && importRuns(e.target.files[0])}
        />
        <span className="pill" data-testid="worker-status">
          <Cpu size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
          {busy ? 'calculando…' : 'solver listo'}
        </span>
        <span className="pill" data-testid="storage-status">
          <HardDriveUpload size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
          IndexedDB · {app.runs.length} corrida{app.runs.length === 1 ? '' : 's'}
        </span>
        <span className="pill">SI · RK4 adaptativo</span>
      </header>

      {ioMsg && (
        <div className="io-status" role="status" data-testid="io-status">
          {ioMsg}
        </div>
      )}

      {tab === 'tile' && <TileSim />}
      {tab === 'beam' && <BeamSim />}
      {tab === 'report' && <ReportTab />}
    </div>
  );
}
