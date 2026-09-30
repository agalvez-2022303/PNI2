/**
 * Ensamblado de la pantalla de la simulación 1 (grada).
 *
 * ocupa toda la ventana, sin scroll de página, con las seis zonas del
 * enunciado siempre visibles a la vez:
 *
 *   a) barra superior        e) seis gráficas simultáneas
 *   b) izquierda             f) barra de estado
 *   c) visor 3D
 *   d) derecha
 *
 * La selección de pieza es un único `PartId` que comparten el visor 3D, el
 * árbol, el BOM y el esquema: pinchar en cualquiera de ellos la resalta en las
 * otras tres.
 *
 * El cálculo NO se hace aquí: se reutiliza el solver del store (Web Worker con
 * repliegue al hilo principal), de modo que la pantalla y las pruebas usan
 * exactamente el mismo camino de resolución.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { TileInputs } from '../../sim/types';
import { PartId } from '../../bom/bom';
import { ViewMode } from '../../render/viewer';
import { StepClock } from './clock';
import { TopBar } from './TopBar';
import { TreePane } from './TreePane';
import { ParamsTable } from './ParamsTable';
import { ViewerPane, ViewerHandle } from './ViewerPane';
import { TitleBlock } from './TitleBlock';
import { InputsPane } from './InputsPane';
import { ResultsPane } from './ResultsPane';
import { EnergyBalance } from './EnergyBalance';
import { Schematic } from './Schematic';
import { BomTable } from './BomTable';
import { Charts } from './Charts';
import { StatusBar } from './StatusBar';
import { exportTileCSV, exportTileSummary, exportJSON } from '../exporters';
import { STACK, CIRCUIT, PULSE } from '../../core/referenceModel';

/** Huella del modelo de referencia, para la barra de estado. */
const MODEL_HASH = (() => {
  const s = [
    STACK.nStacks,
    STACK.nLayers,
    STACK.diameterMm,
    STACK.layerThicknessMm,
    CIRCUIT.Cs,
    CIRCUIT.Rload,
    CIRCUIT.Vf,
    CIRCUIT.Vdiode,
    PULSE.Tp,
  ].join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
})();

export const TileWorkbench: React.FC = () => {
  const app = useApp();
  const inputs = app.tileInputs;
  const result = app.tileResult;
  const solving = app.tileBusy;

  const [selected, setSelected] = useState<PartId | null>(null);
  const [hidden, setHidden] = useState<PartId[]>([]);

  const [view, setView] = useState<ViewMode>('perspective');
  const [exploded, setExploded] = useState(false);
  const [dims, setDims] = useState(true);
  const [balloons, setBalloons] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [section, setSection] = useState(0);
  const [cursor, setCursor] = useState<{ x: number; y: number; z: number } | null>(null);

  const viewerRef = useRef<ViewerHandle>(null);
  const clock = useMemo(() => new StepClock(PULSE.Tp), []);

  // La cadencia fija el periodo de la pisada, y con él la animación.
  useEffect(() => {
    clock.setPeriod(60 / inputs.cadence);
    clock.rewind();
  }, [inputs.cadence, clock]);

  useEffect(() => {
    clock.running = playing;
  }, [playing, clock]);

  const patch = useCallback(
    (p: TileInputs) => app.patchTile(p),
    [app]
  );

  const toggleHidden = useCallback((id: PartId) => {
    setHidden((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]));
  }, []);

  // Al ocultar la pieza seleccionada, la selección pasa a nulo: no se puede
  // seleccionar algo que no se ve.
  useEffect(() => {
    if (selected && hidden.includes(selected)) setSelected(null);
  }, [hidden, selected]);

  const onExport = useCallback(() => {
    if (!result) return;
    exportTileCSV(inputs, result);
    exportTileSummary(inputs, result);
    exportJSON(
      {
        project: 'PNI2',
        sim: 1,
        modelHash: MODEL_HASH,
        inputs,
        result,
      },
      `pni2_grada_${inputs.Fmax}N_${inputs.cadence}ppm.json`
    );
  }, [inputs, result]);

  const violation = result ? !conserves(result.chain) : false;

  return (
    <div className="cad-shell" data-testid="cad-shell">
      <TopBar
        sim={1}
        onSim={() => undefined}
        view={view}
        onView={setView}
        exploded={exploded}
        onExploded={setExploded}
        dims={dims}
        onDims={setDims}
        balloons={balloons}
        onBalloons={setBalloons}
        playing={playing}
        onPlaying={setPlaying}
        section={section}
        onSection={setSection}
        onExport={onExport}
        modelHash={MODEL_HASH}
      />

      <div className="cad-body">
        {/* (b) izquierda: árbol y parámetros de solo lectura */}
        <aside className="cad-left" data-testid="cad-left">
          <TreePane
            selected={selected}
            hidden={hidden}
            onSelect={setSelected}
            onToggle={toggleHidden}
            onSelectAll={(visible) => setHidden(visible ? [] : BOM_IDS)}
          />
          <div className="cad-scroll">
            <ParamsTable />
            <BomTable selected={selected} onSelect={setSelected} />
          </div>
        </aside>

        {/* (c) centro: visor 3D con cajetín y lecturas */}
        <main className="cad-center" data-testid="cad-center">
          <ViewerPane
            ref={viewerRef}
            inputs={inputs}
            result={result}
            clock={clock}
            exaggeration={result?.renderExaggeration ?? 1}
            view={view}
            exploded={exploded}
            dims={dims}
            balloons={balloons}
            section={section}
            selected={selected}
            hidden={hidden}
            onSelect={setSelected}
            onHover={setCursor}
          />
          <TitleBlock modelHash={MODEL_HASH} units="mm" />
        </main>

        {/* (d) derecha: entradas, resultados, balance y esquema */}
        <aside className="cad-right" data-testid="cad-right">
          <div className="cad-scroll">
            <InputsPane inputs={inputs} onChange={patch} solving={solving} />
            <ResultsPane result={result} solving={solving} />
            <EnergyBalance result={result} />
            <Schematic result={result} clock={clock} selected={selected} onSelect={setSelected} />
          </div>
        </aside>
      </div>

      {/* (e) las seis gráficas, siempre a la vista */}
      <Charts result={result} clock={clock} />

      {/* (f) barra de estado */}
      <StatusBar
        cursor={cursor}
        modelHash={MODEL_HASH}
        solver="RK4 adaptativo · 200 subpasos/pisada"
        nStepsRun={result?.nStepsRun ?? null}
        nStepsRequested={result?.nStepsRequested ?? null}
        alerts={result?.alerts.length ?? 0}
        violation={violation}
      />
    </div>
  );
};

/** Ids de las piezas, para "ocultar todo". */
const BOM_IDS: PartId[] = [
  'placa',
  'resortes',
  'stacks',
  'marco',
  'pcb',
  'puente',
  'cs',
  'resistencia',
  'led',
];

/** Comprueba la monótonía de la cadena sin lanzar: la UI informa, no rompe. */
function conserves(chain: { U_el: number; E_ideal: number; E_extracted: number; E_stored: number; E_LED: number }): boolean {
  const ks = ['U_el', 'E_ideal', 'E_extracted', 'E_stored', 'E_LED'] as const;
  for (let i = 1; i < ks.length; i++) {
    if (chain[ks[i]] > chain[ks[i - 1]] * (1 + 1e-6) + 1e-18) return false;
  }
  return true;
}
