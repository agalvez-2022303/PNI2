import React, { useEffect, useRef, useState } from 'react';
import { TileSim } from '@/ui/TileSim';
import { BeamSim } from '@/ui/BeamSim';
import { CadEditor } from '@/ui/CadEditor';
import { MaterialsEditor } from '@/ui/MaterialsEditor';
import { ReportTab } from '@/ui/ReportTab';
import { useApp } from '@/ui/store';
import { exportJSON } from '@/ui/exporters';
import { Footprints, Activity, Boxes, Database, FileText, Zap, Cpu, Save, FolderOpen } from 'lucide-react';

type Tab = 'tile' | 'beam' | 'cad' | 'materials' | 'report';

const VALID: Tab[] = ['tile', 'beam', 'cad', 'materials', 'report'];
function initialTab(): Tab {
  const h = (typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '') as Tab;
  return VALID.includes(h) ? h : 'tile';
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'tile', label: 'Simulación 1 · Baldosa', icon: <Footprints size={15} /> },
  { id: 'beam', label: 'Simulación 2 · Viga', icon: <Activity size={15} /> },
  { id: 'cad', label: 'Editor CAD', icon: <Boxes size={15} /> },
  { id: 'materials', label: 'Materiales', icon: <Database size={15} /> },
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

  const projFile = useRef<HTMLInputElement>(null);
  const saveProject = () => {
    exportJSON(
      {
        app: 'PiezoLab',
        version: 1,
        savedAt: new Date().toISOString(),
        materials: app.materials,
        tile: app.tileParams,
        beam: app.beamParams,
      },
      'proyecto_piezolab.json'
    );
  };
  const loadProject = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'PiezoLab') throw new Error('Formato de proyecto no reconocido');
      if (Array.isArray(data.materials)) app.replaceMaterials(data.materials);
      if (data.tile) app.patchTile(data.tile);
      if (data.beam) app.patchBeam(data.beam);
    } catch (e) {
      alert('No se pudo abrir el proyecto: ' + (e as Error).message);
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
        <button className="btn sm ghost" onClick={saveProject} data-testid="project-save" title="Guardar proyecto (JSON)">
          <Save size={14} /> Guardar
        </button>
        <button className="btn sm ghost" onClick={() => projFile.current?.click()} data-testid="project-open" title="Abrir proyecto (JSON)">
          <FolderOpen size={14} /> Abrir
        </button>
        <input
          ref={projFile}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          data-testid="project-file"
          onChange={(e) => e.target.files?.[0] && loadProject(e.target.files[0])}
        />
        <span className="pill" data-testid="worker-status">
          <Cpu size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
          {busy ? 'calculando…' : 'solver listo'}
        </span>
        <span className="pill">SI · RK4 adaptativo</span>
      </header>

      {tab === 'tile' && <TileSim />}
      {tab === 'beam' && <BeamSim />}
      {tab === 'cad' && <CadEditor />}
      {tab === 'materials' && <MaterialsEditor />}
      {tab === 'report' && <ReportTab />}
    </div>
  );
}
