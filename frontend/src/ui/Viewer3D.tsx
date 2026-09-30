import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { SceneViewer, ViewMode } from '../render/viewer';
import { buildBeamModel3D, BeamMesh } from '../render/beamModel';
import { importShell, exportSTL } from '../render/ioModel';
import { BeamInputs, BeamResult } from '../sim/types';
import { Play, Pause, RotateCcw } from 'lucide-react';

/** C8: el factor de exageración lo fija el solver, no el usuario. */
const DEFAULT_EXAGGERATION = 5000;

export interface ViewerHandle {
  exportSTL: (name: string) => void;
  importShell: (file: File) => void;
  clearShell: () => void;
}

interface Props {
  beamInputs?: BeamInputs;
  beamResult?: BeamResult | null;
  modeIndex?: number;
  hud?: { k: string; v: string }[];
  beamDriveRef?: React.MutableRefObject<{ on: boolean; ampNorm: number }>;
}

/**
 * Visor de la viga.
 *
 * La grada ya no pasa por aquí: su visor es `ui/cad/ViewerPane.tsx`, que monta
 * el ensamble completo con globos, cotas y vista desplegada. Este componente
 * queda sólo para la simulación 2, que es una vista heredada de la fase 1.
 */
export const Viewer3D = forwardRef<ViewerHandle, Props>(function Viewer3D(props, ref) {
  const { beamResult, modeIndex = 0, hud, beamDriveRef } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<SceneViewer | null>(null);
  const beamMesh = useRef<BeamMesh | null>(null);
  const shellRef = useRef<THREE.Object3D | null>(null);
  const timeRef = useRef(0);
  const playingRef = useRef(true);
  const [playing, setPlaying] = useState(true);
  const [view, setView] = useState<ViewMode>('perspective');

  const liveRef = useRef({ beamResult, modeIndex, beamDriveRef });
  liveRef.current = { beamResult, modeIndex, beamDriveRef };

  useEffect(() => {
    if (!wrapRef.current) return;
    const v = new SceneViewer(wrapRef.current);
    viewerRef.current = v;
    v.onFrame = (dt) => {
      if (playingRef.current) timeRef.current += dt;
      const t = timeRef.current;
      const L = liveRef.current;
      if (beamMesh.current && L.beamResult) {
        // Frecuencia visual lenta (1.1 Hz) para apreciar la forma modal; la
        // física ya está resuelta por el solver, esto es sólo animación.
        const drv = L.beamDriveRef?.current;
        const amp = drv?.on ? drv.ampNorm : 1;
        beamMesh.current.update(amp, 2 * Math.PI * 1.1 * t, DEFAULT_EXAGGERATION);
      }
    };
    return () => {
      v.dispose();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El modelo de viga sólo depende de la forma modal que se muestre.
  useEffect(() => {
    if (!viewerRef.current || !beamResult) return;
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
  }, [beamResult]);

  // Cambio de forma modal (viga)
  useEffect(() => {
    if (beamMesh.current && beamResult?.modeShapes[modeIndex]) {
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
      if (beamMesh.current) exportSTL(beamMesh.current.group, name);
    },
    importShell: async (file: File) => {
      try {
        const obj = await importShell(file);
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const scaleTo = (beamMesh.current?.radius || 60) * 1.4;
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        obj.scale.setScalar(scaleTo / maxDim);
        shellRef.current = obj;
        const g = new THREE.Group();
        if (beamMesh.current) g.add(beamMesh.current.group);
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
      if (beamMesh.current) g.add(beamMesh.current.group);
      viewerRef.current?.setModel(g);
      viewerRef.current?.setViewMode(view);
    },
  }));

  return (
    <div className="viewer-wrap">
      <div className="viewer-canvas" ref={wrapRef} data-testid="viewer-3d" />
      <div className="view-toolbar" data-testid="view-toolbar">
        {(['perspective', 'orthographic', 'section', 'wireframe'] as ViewMode[]).map((v) => (
          <button
            key={v}
            className={view === v ? 'active' : ''}
            onClick={() => changeView(v)}
            data-testid={`view-${v}`}
          >
            {v}
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

    </div>
  );
});

