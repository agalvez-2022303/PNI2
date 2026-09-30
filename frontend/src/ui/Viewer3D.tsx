import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { SceneViewer, ViewMode } from '../render/viewer';
import { buildTileModel, TileMesh, stressColor, DEFAULT_EXAGGERATION } from '../render/tileModel';
import { buildBeamModel3D, BeamMesh } from '../render/beamModel';
import { importShell, exportSTL } from '../render/ioModel';
import { stepForce } from '../core/tile';
import { PULSE, ALERTS } from '../core/referenceModel';
import { stackStress } from '../core/tile';
import { TileInputs, BeamInputs, TileResult, BeamResult } from '../sim/types';
import { Play, Pause, RotateCcw, Box, Square, Scissors, Grid3x3 } from 'lucide-react';

export interface ViewerHandle {
  exportSTL: (name: string) => void;
  importShell: (file: File) => void;
  clearShell: () => void;
}

interface Props {
  kind: 'tile' | 'beam';
  tileInputs?: TileInputs;
  tileResult?: TileResult | null;
  beamInputs?: BeamInputs;
  beamResult?: BeamResult | null;
  modeIndex?: number;
  hud?: { k: string; v: string }[];
  beamDriveRef?: React.MutableRefObject<{ on: boolean; ampNorm: number }>;
}

const VIEWS: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
  { id: 'perspective', icon: <Box size={14} />, label: 'Perspectiva' },
  { id: 'orthographic', icon: <Square size={14} />, label: 'Ortogonal' },
  { id: 'section', icon: <Scissors size={14} />, label: 'Corte' },
  { id: 'wireframe', icon: <Grid3x3 size={14} />, label: 'Alambre' },
];

export const Viewer3D = forwardRef<ViewerHandle, Props>(function Viewer3D(props, ref) {
  const { kind, tileInputs, tileResult, beamResult, modeIndex = 0, hud, beamDriveRef } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<SceneViewer | null>(null);
  const tileMesh = useRef<TileMesh | null>(null);
  const beamMesh = useRef<BeamMesh | null>(null);
  const shellRef = useRef<THREE.Object3D | null>(null);
  const timeRef = useRef(0);
  const playingRef = useRef(true);
  const [playing, setPlaying] = useState(true);
  const [view, setView] = useState<ViewMode>('perspective');

  const liveRef = useRef({ tileInputs, tileResult, beamResult, modeIndex, beamDriveRef });
  liveRef.current = { tileInputs, tileResult, beamResult, modeIndex, beamDriveRef };

  // C8: el factor de exageración lo fija el solver y no depende del usuario.
  const exaggeration = tileResult?.renderExaggeration ?? DEFAULT_EXAGGERATION;

  useEffect(() => {
    if (!wrapRef.current) return;
    const v = new SceneViewer(wrapRef.current);
    viewerRef.current = v;
    v.onFrame = (dt) => {
      if (playingRef.current) timeRef.current += dt;
      const t = timeRef.current;
      const L = liveRef.current;
      if (kind === 'tile' && tileMesh.current && L.tileInputs) {
        // La cadencia viene del usuario, así que la animación va en tiempo real
        // al ritmo de pisado que se está viendo.
        const p = L.tileInputs;
        const F = stepForce(t, p.Fmax, PULSE.Tp);
        tileMesh.current.update(F, exaggeration);
      }
      if (kind === 'beam' && beamMesh.current && L.beamResult) {
        // Frecuencia visual lenta (1.1 Hz) para apreciar la forma modal; la
        // física ya está resuelta por el solver, esto es sólo animación.
        const drv = L.beamDriveRef?.current;
        const amp = drv?.on ? drv.ampNorm : 1;
        beamMesh.current.update(amp, 2 * Math.PI * 1.1 * t, exaggeration);
      }
    };
    return () => {
      v.dispose();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  // El modelo de baldosa es de geometría fija: se construye una sola vez.
  useEffect(() => {
    if (kind !== 'tile' || !viewerRef.current) return;
    const mesh = buildTileModel();
    tileMesh.current = mesh;
    const g = new THREE.Group();
    g.add(mesh.group);
    if (shellRef.current) g.add(shellRef.current);
    viewerRef.current.setModel(g);
    viewerRef.current.frameCamera(mesh.radius, mesh.center);
    viewerRef.current.setViewMode(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  // El modelo de viga sólo depende de la forma modal que se muestre.
  useEffect(() => {
    if (kind !== 'beam' || !viewerRef.current || !beamResult) return;
    const mesh = buildBeamModel3D(beamResult);
    if (beamResult.modeShapes[modeIndex]) mesh.setShape(beamResult.modeShapes[modeIndex]);
    beamMesh.current = mesh;
    const g = new THREE.Group();
    g.add(mesh.group);
    if (shellRef.current) g.add(shellRef.current);
    viewerRef.current.setModel(g);
    viewerRef.current.frameCamera(mesh.radius, mesh.center);
    viewerRef.current.setViewMode(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, beamResult]);

  // Cambio de forma modal (viga)
  useEffect(() => {
    if (kind === 'beam' && beamMesh.current && beamResult?.modeShapes[modeIndex]) {
      beamMesh.current.setShape(beamResult.modeShapes[modeIndex]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeIndex]);

  const changeView = (v: ViewMode) => {
    setView(v);
    viewerRef.current?.setViewMode(v);
  };
  const togglePlay = () => {
    playingRef.current = !playingRef.current;
    setPlaying(playingRef.current);
  };
  const reset = () => {
    timeRef.current = 0;
    playingRef.current = true;
    setPlaying(true);
    viewerRef.current?.resetView();
    setView('perspective');
  };

  useImperativeHandle(ref, () => ({
    exportSTL: (name: string) => {
      const target = kind === 'tile' ? tileMesh.current?.group : beamMesh.current?.group;
      if (target) exportSTL(target, name);
    },
    importShell: async (file: File) => {
      try {
        const obj = await importShell(file);
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const target = kind === 'tile' ? tileMesh.current : beamMesh.current;
        const scaleTo = (target?.radius || 60) * 1.4;
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        obj.scale.setScalar(scaleTo / maxDim);
        shellRef.current = obj;
        const g = new THREE.Group();
        if (kind === 'tile' && tileMesh.current) g.add(tileMesh.current.group);
        if (kind === 'beam' && beamMesh.current) g.add(beamMesh.current.group);
        g.add(obj);
        viewerRef.current?.setModel(g);
        viewerRef.current?.setViewMode(view);
      } catch (e) {
        alert('No se pudo importar: ' + (e as Error).message);
      }
    },
    clearShell: () => {
      shellRef.current = null;
      const g = new THREE.Group();
      if (kind === 'tile' && tileMesh.current) g.add(tileMesh.current.group);
      if (kind === 'beam' && beamMesh.current) g.add(beamMesh.current.group);
      viewerRef.current?.setModel(g);
      viewerRef.current?.setViewMode(view);
    },
  }));

  return (
    <div className="viewer-wrap">
      <div className="viewer-canvas" ref={wrapRef} data-testid="viewer-3d" />
      <div className="view-toolbar" data-testid="view-toolbar">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            className={view === v.id ? 'active' : ''}
            onClick={() => changeView(v.id)}
            data-testid={`view-${v.id}`}
            title={v.label}
          >
            {v.icon}
            <span style={{ fontSize: 11 }}>{v.label}</span>
          </button>
        ))}
      </div>

      {hud && hud.length > 0 && (
        <div className="hud">
          {hud.map((h, i) => (
            <div className="hud-item" key={i}>
              <div className="k">{h.k}</div>
              <div className="v">{h.v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="playbar">
        <button className="btn primary sm" onClick={togglePlay} data-testid="btn-play">
          {playing ? <Pause size={14} /> : <Play size={14} />}
          {playing ? 'Pausar' : 'Simular'}
        </button>
        <button className="btn sm" onClick={reset} data-testid="btn-reset">
          <RotateCcw size={13} /> Reiniciar
        </button>
      </div>

      {kind === 'tile' && (
        <div className="legend" data-testid="tile-legend">
          <div className="legend-title">
            σ real · 0 → {ALERTS.sigmaLimit / 1e6} MPa · deformación ×{exaggeration} (fijo)
          </div>
          <div className="legend-bar">
            <span className="dot" style={{ background: `#${stressColor(0).getHexString()}` }} />
            <span style={{ background: `linear-gradient(90deg, #${stressColor(0).getHexString()}, #${stressColor(
              ALERTS.sigmaLimit / 2
            ).getHexString()}, #${stressColor(ALERTS.sigmaLimit).getHexString()})` }} />
            <span className="dot" style={{ background: `#${stressColor(ALERTS.sigmaLimit).getHexString()}` }} />
          </div>
          <div className="legend-scale">
            <span>0</span>
            <span>{formatStress(tileInputs?.Fmax ?? 0)}</span>
            <span>100 MPa</span>
          </div>
        </div>
      )}
    </div>
  );
});

function formatStress(Fmax: number): string {
  const MPa = stackStress(Fmax) / 1e6;
  return `${MPa.toFixed(1)} MPa a F_max`;
}
