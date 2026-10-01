/**
 * Zona central del visor CAD: escena 3D, ViewCube, cotas, globos, corte y
 * barra de sigma.
 *
 * La pieza central del requisito: el 3D es la referencia, no una miniatura.
 * Por eso los controles viven en la barra superior y aquí sólo queda la
 * escala de datos y el indicador de deformación, que son parte de la lectura
 * de la imagen.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { SceneViewer, ViewMode } from '../../render/viewer';
import { buildAssembly, AssemblyModel } from '../../render/assembly';
import { buildBalloons, buildDimensions, BALLOON_PARTS, stackDetailLabel } from '../../render/dims';
import { exportSTL } from '../../render/ioModel';
import { stepForce } from '../../core/tile';
import { PULSE, STACK, ALERTS } from '../../core/referenceModel';
import { TileInputs, TileResult } from '../../sim/types';
import { PartId } from '../../bom/bom';
import { StepClock, sampleSeries } from './clock';
import { SIGMA_STOPS, fmt } from './theme';

export interface ViewerHandle {
  exportSTL: (name: string) => void;
  resetView: () => void;
}

interface Props {
  inputs: TileInputs;
  result: TileResult | null;
  clock: StepClock;
  exaggeration: number;
  view: ViewMode;
  /** Factor de explosión CAD 0..1: 0 = ensamblado, 1 = desplegado. */
  explodeFactor: number;
  dims: boolean;
  balloons: boolean;
  section: number;
  selected: PartId | null;
  hidden: PartId[];
  onSelect: (id: PartId | null) => void;
  onHover: (pt: { x: number; y: number; z: number } | null) => void;
  onExplodeEnd?: () => void;
}

/** Duración de la transición al 100 % del factor; se escala con el recorrido. */
const EXPLODE_SECONDS = 1.0;

export const ViewerPane = forwardRef<ViewerHandle, Props>(function ViewerPane(props, ref) {
  const { inputs, result, clock, exaggeration, view, explodeFactor, dims, balloons, section, hidden } = props;

  const wrapRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<SceneViewer | null>(null);
  const asmRef = useRef<AssemblyModel | null>(null);
  const balloonsRef = useRef<ReturnType<typeof buildBalloons> | null>(null);
  const timeRef = useRef(0);
  const explodeRef = useRef({ from: 0, to: 0, current: 0, t0: 0, dur: 1000, running: false });
  const lastFrame = useRef({ sig: NaN, led: NaN, ex: NaN });
  /** Leyenda de σ visible SOLO con el mapa de esfuerzo encendido. */
  const [stressMap, setStressMap] = useState(false);

  const live = useRef(props);
  live.current = props;

  // ---- escena ---------------------------------------------------------------
  useEffect(() => {
    if (!wrapRef.current) return;
    const v = new SceneViewer(wrapRef.current);
    viewerRef.current = v;

    const asm = buildAssembly();
    asmRef.current = asm;

    const bal = buildBalloons(asm.anchorOf);
    balloonsRef.current = bal;

    const g = new THREE.Group();
    g.add(asm.group);
    g.add(buildDimensions());
    g.add(stackDetailLabel(STACK.nLayers, STACK.layerThickness));
    g.add(bal.group);
    v.setModel(g);
    v.frameCamera(asm.radius, asm.center);

    v.onPick = (pick) => live.current.onSelect(pick ? (pick.id as PartId) : null);
    v.onHover = (pt) =>
      live.current.onHover(pt ? { x: pt.x, y: pt.y, z: pt.z } : null);
    v.onStressMap = (on) => setStressMap(on);

    v.onFrame = (dt) => {
      const L = live.current;
      // La animación corre al ritmo real de la cadencia elegida.
      clock.advance(dt);
      const t = clock.t;
      timeRef.current = t;

      // Fuerza instantánea de la pisada: alimenta deformación y color.
      const F = stepForce(t, L.inputs.Fmax, PULSE.Tp);

      // Corriente del LED leída de la serie del solver (no aproximada).
      const iL = L.result ? sampleSeries(L.result.series.t, L.result.series.I, t) : 0;

      // Transición del factor de explosión: duración proporcional al recorrido
      // (los botones ensamblar/desplegar animan ~1 s; el slider responde casi
      // en tiempo real).
      const ex = explodeRef.current;
      let explodeAmt = ex.to;
      if (ex.running) {
        let k = Math.min(1, (performance.now() - ex.t0) / ex.dur);
        k = k * k * (3 - 2 * k); // smoothstep
        explodeAmt = ex.from + (ex.to - ex.from) * k;
        ex.current = explodeAmt;
        if (k >= 1) {
          ex.running = false;
          ex.current = ex.to;
          L.onExplodeEnd?.();
        }
      }

      // Sólo se toca la escena si algo cambió de verdad. La primera vez
      // (`sig = NaN`) se fuerza el refresco: sin esto, `NaN` hace que la
      // comparación sea siempre `false` y el ensamble jamás se anime.
      const key = F * 1e3 + iL * 1e6 + explodeAmt * 1e3;
      if (!Number.isFinite(lastFrame.current.sig) || Math.abs(key - lastFrame.current.sig) > 0.5) {
        lastFrame.current.sig = key;
        asm.apply({
          Fmax: F,
          forceNorm: L.inputs.Fmax > 0 ? Math.max(0, Math.min(1, F / L.inputs.Fmax)) : 0,
          exaggeration: L.exaggeration,
          ILed: iL,
          ILedRef: L.result?.ILedPeak || 1e-3,
          explode: explodeAmt,
        });
        // El globo 3 (stacks) gira con la compresión; los puntos guía siguen a
        // la pieza ya desplazada.
        bal.update((id) => asm.explodedAnchorOf(id));
      }
    };

    return () => {
      bal.dispose();
      asm.dispose();
      v.dispose();
      viewerRef.current = null;
      asmRef.current = null;
      balloonsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- vista ----------------------------------------------------------------
  useEffect(() => {
    viewerRef.current?.setViewMode(view);
  }, [view]);

  useEffect(() => {
    viewerRef.current?.setSectionOffset(section);
  }, [section]);

  useEffect(() => {
    viewerRef.current?.setDimensionsVisible(dims);
    if (balloonsRef.current) balloonsRef.current.group.visible = balloons;
  }, [dims, balloons]);

  // ---- visibilidad por pieza -----------------------------------------------
  useEffect(() => {
    const asm = asmRef.current;
    if (!asm) return;
    const h = new Set<PartId>(hidden);
    (BALLOON_PARTS.map((b) => b.id) as PartId[]).forEach((id) => asm.setVisible(id, !h.has(id)));
  }, [hidden]);

  // ---- resaltado por selección ---------------------------------------------
  useEffect(() => {
    viewerRef.current?.select(props.selected);
  }, [props.selected]);

  // ---- factor de explosión CAD ----------------------------------------------
  useEffect(() => {
    const ex = explodeRef.current;
    const target = Math.max(0, Math.min(1, explodeFactor));
    if (ex.to === target && !ex.running) return;
    const from = ex.running ? ex.current : ex.to;
    const dist = Math.abs(target - from);
    if (dist < 0.02) {
      // El slider fino llega casi en tiempo real: sin animación.
      ex.current = target;
      ex.to = target;
      ex.running = false;
      return;
    }
    ex.from = from;
    ex.current = from;
    ex.to = target;
    ex.t0 = performance.now();
    ex.dur = EXPLODE_SECONDS * 1000 * dist;
    ex.running = true;
  }, [explodeFactor]);

  useImperativeHandle(ref, () => ({
    exportSTL: (name: string) => {
      if (asmRef.current) exportSTL(asmRef.current.group, name);
    },
    resetView: () => viewerRef.current?.resetView(),
  }));

  // ---- escala de sigma: barra POR PASOS, sin degradado ---------------------
  const sigmaMPa = result ? result.stress / 1e6 : 0;
  const limitMPa = ALERTS.sigmaLimit / 1e6;

  return (
    <div className="cad-canvas" ref={wrapRef} data-testid="cad-viewer">
      <div className="cad-readout" data-testid="cad-readout">
        {stressMap && (
          <>
            <div className="cad-readout-row">
              <span>σ</span>
              <b className={sigmaMPa > limitMPa ? 'bad' : ''}>{fmt(sigmaMPa, 2)} MPa</b>
              <span className="muted">límite {limitMPa} MPa</span>
            </div>
            <div className="cad-scale" data-testid="sigma-scale">
              {SIGMA_STOPS.map((s) => (
                <span key={s.mpa} className="cad-scale-stop" style={{ background: s.color }} title={`${s.mpa} MPa`} />
              ))}
            </div>
            <div className="cad-scale-ticks">
              {SIGMA_STOPS.map((s) => (
                <span key={s.mpa}>{s.mpa}</span>
              ))}
            </div>
          </>
        )}
        <div className="cad-readout-row">
          <span>deformación</span>
          <b>×{exaggeration}</b>
          <span className="muted">δ = σ·s33E·T, factor fijo</span>
        </div>
        <div className="cad-readout-row">
          <span>i_LED</span>
          <b>{fmt((result?.ILedPeak || 0) * 1e3, 3)} mA</b>
          <span className="muted">pico por pisada</span>
        </div>
      </div>

      <div className="cad-corner-note">
        <span>arrastrar: orbitar</span>
        <span>rueda: zoom</span>
        <span>clic: seleccionar pieza</span>
      </div>
    </div>
  );
});
