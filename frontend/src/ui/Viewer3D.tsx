import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { SceneViewer, ViewMode } from '../render/viewer';
import { buildTileModel, TileMesh } from '../render/tileModel';
import { buildBeamModel3D, BeamMesh } from '../render/beamModel';
import { importShell, exportSTL } from '../render/ioModel';
import { stepForce } from '../core/tile';
import { TileParams, BeamParams, TileResult, BeamResult } from '../sim/types';
import { Play, Pause, RotateCcw, Box, Square, Scissors, Grid3x3 } from 'lucide-react';

export interface ViewerHandle {
  exportSTL: (name: string) => void;
  importShell: (file: File) => void;
  clearShell: () => void;
}

interface Props {
  kind: 'tile' | 'beam';
  tileParams?: TileParams;
  tileResult?: TileResult | null;
  beamParams?: BeamParams;
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
  const { kind, tileParams, tileResult, beamParams, beamResult, modeIndex = 0, hud, beamDriveRef } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<SceneViewer | null>(null);
  const tileMesh = useRef<TileMesh | null>(null);
  const beamMesh = useRef<BeamMesh | null>(null);
  const shellRef = useRef<THREE.Object3D | null>(null);
  const timeRef = useRef(0);
  const playingRef = useRef(true);
  const [playing, setPlaying] = useState(true);
  const [view, setView] = useState<ViewMode>('perspective');

  const liveRef = useRef({ tileParams, tileResult, beamParams, beamResult, modeIndex, beamDriveRef });
  liveRef.current = { tileParams, tileResult, beamParams, beamResult, modeIndex, beamDriveRef };

  useEffect(() => {
    if (!wrapRef.current) return;
    const v = new SceneViewer(wrapRef.current);
    viewerRef.current = v;
    v.onFrame = (dt) => {
      if (playingRef.current) timeRef.current += dt;
      const t = timeRef.current;
      const L = liveRef.current;
      if (kind === 'tile' && tileMesh.current && L.tileParams) {
        const p = L.tileParams;
        const freq = p.walkMode ? p.walkFreq : 1 / p.T;
        const spacing = 1 / freq;
        const nSteps = p.walkMode ? p.walkSteps : 1;
        const tEnd = p.walkMode ? (nSteps - 1) * spacing + p.T : p.T;
        const loopT = tEnd + 0.25;
        const lt = t % loopT;
        let F = 0;
        for (let k = 0; k < nSteps; k++) F += stepForce(lt - k * spacing, p.Fmax, p.T);
        tileMesh.current.update(F / p.Fmax, p.scaleFactor);
      }
      if (kind === 'beam' && beamMesh.current && L.beamParams) {
        const p = L.beamParams;
        const modeFreqDisplay = 1.1; // Hz visual (cámara lenta) para apreciar la forma modal
        const drv = L.beamDriveRef?.current;
        const amp = drv?.on ? drv.ampNorm : 1;
        beamMesh.current.update(amp, 2 * Math.PI * modeFreqDisplay * t, p.scaleFactor);
      }
    };
    return () => {
      v.dispose();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  // (Re)construir modelo de baldosa al cambiar geometría
  useEffect(() => {
    if (kind !== 'tile' || !viewerRef.current || !tileParams) return;
    const mesh = buildTileModel(tileParams);
    tileMesh.current = mesh;
    const g = new THREE.Group();
    g.add(mesh.group);
    if (shellRef.current) g.add(shellRef.current);
    viewerRef.current.setModel(g);
    viewerRef.current.frameCamera(mesh.radius, mesh.center);
    viewerRef.current.setViewMode(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, tileParams?.diameter, tileParams?.thickness, tileParams?.nLayers]);

  // (Re)construir modelo de viga al cambiar geometría o resultado
  useEffect(() => {
    if (kind !== 'beam' || !viewerRef.current || !beamParams || !beamResult) return;
    const mesh = buildBeamModel3D(beamParams, beamResult);
    if (beamResult.modeShapes[modeIndex]) mesh.setShape(beamResult.modeShapes[modeIndex]);
    beamMesh.current = mesh;
    const g = new THREE.Group();
    g.add(mesh.group);
    if (shellRef.current) g.add(shellRef.current);
    viewerRef.current.setModel(g);
    viewerRef.current.frameCamera(mesh.radius, mesh.center);
    viewerRef.current.setViewMode(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    kind,
    beamParams?.length,
    beamParams?.width,
    beamParams?.tSub,
    beamParams?.tPiezo,
    beamParams?.tipMass,
    beamResult,
  ]);

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
        // reconstruir escena con la carcasa
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
        <div className="legend">
          <span>
            <span className="dot" style={{ background: '#2b6cff' }} /> esfuerzo bajo
          </span>
          <span>
            <span className="dot" style={{ background: '#ff5d5d' }} /> esfuerzo alto
          </span>
        </div>
      )}
    </div>
  );
});
