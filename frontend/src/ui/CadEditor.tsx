import React, { useRef, useState } from 'react';
import { useApp } from './store';
import { Viewer3D, ViewerHandle } from './Viewer3D';
import { Section, Slider, Select } from './controls';
import { RANGES } from '../sim/defaults';
import { exportTileCSV, exportTileSummary, exportBeamCSV, exportBeamSummary } from './exporters';
import { Upload, Boxes, Download, FileJson, Trash2 } from 'lucide-react';

export const CadEditor: React.FC = () => {
  const app = useApp();
  const [target, setTarget] = useState<'tile' | 'beam'>('tile');
  const [modeIndex] = useState(0);
  const viewerRef = useRef<ViewerHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const t = app.tileParams;
  const b = app.beamParams;

  return (
    <div className="layout">
      <div className="sidebar" data-testid="cad-sidebar">
        <Section title="Modelo a editar">
          <div className="btn-row">
            <button className={`btn sm ${target === 'tile' ? 'primary' : ''}`} onClick={() => setTarget('tile')} data-testid="cad-target-tile">
              Baldosa
            </button>
            <button className={`btn sm ${target === 'beam' ? 'primary' : ''}`} onClick={() => setTarget('beam')} data-testid="cad-target-beam">
              Viga bimorfa
            </button>
          </div>
          <div className="hint" style={{ marginTop: 8 }}>
            Edita la geometría y observa el modelo 3D actualizarse en vivo. Los cambios se sincronizan con las pestañas de simulación.
          </div>
        </Section>

        {target === 'tile' ? (
          <Section title="Geometría · Baldosa">
            <Slider label="Nº de capas" value={t.nLayers} min={RANGES.tile.nLayers.min} max={RANGES.tile.nLayers.max} step={1} onChange={(v) => app.patchTile({ nLayers: Math.round(v) })} display={`${t.nLayers}`} testId="cad-tile-nlayers" />
            <Slider label="Diámetro disco" value={t.diameter * 1000} min={RANGES.tile.diameterMm.min} max={RANGES.tile.diameterMm.max} step={RANGES.tile.diameterMm.step} onChange={(v) => app.patchTile({ diameter: v / 1000 })} display={`${(t.diameter * 1000).toFixed(1)} mm`} testId="cad-tile-diameter" />
            <Slider label="Espesor disco" value={t.thickness * 1000} min={RANGES.tile.thicknessMm.min} max={RANGES.tile.thicknessMm.max} step={RANGES.tile.thicknessMm.step} onChange={(v) => app.patchTile({ thickness: v / 1000 })} display={`${(t.thickness * 1000).toFixed(2)} mm`} testId="cad-tile-thickness" />
            <Slider label="Factor de escala" value={t.scaleFactor} min={RANGES.tile.scaleFactor.min} max={RANGES.tile.scaleFactor.max} step={1} onChange={(v) => app.patchTile({ scaleFactor: v })} display={`×${t.scaleFactor.toFixed(0)}`} testId="cad-tile-scale" />
          </Section>
        ) : (
          <Section title="Geometría · Viga">
            <Slider label="Longitud L" value={b.length * 1000} min={RANGES.beam.lengthMm.min} max={RANGES.beam.lengthMm.max} step={1} onChange={(v) => app.patchBeam({ length: v / 1000 })} display={`${(b.length * 1000).toFixed(0)} mm`} testId="cad-beam-length" />
            <Slider label="Ancho b" value={b.width * 1000} min={RANGES.beam.widthMm.min} max={RANGES.beam.widthMm.max} step={1} onChange={(v) => app.patchBeam({ width: v / 1000 })} display={`${(b.width * 1000).toFixed(0)} mm`} testId="cad-beam-width" />
            <div className="inline-2">
              <Slider label="Esp. sustrato" value={b.tSub * 1000} min={RANGES.beam.tSubMm.min} max={RANGES.beam.tSubMm.max} step={RANGES.beam.tSubMm.step} onChange={(v) => app.patchBeam({ tSub: v / 1000 })} display={`${(b.tSub * 1000).toFixed(2)}`} testId="cad-beam-tsub" />
              <Slider label="Esp. piezo" value={b.tPiezo * 1000} min={RANGES.beam.tPiezoMm.min} max={RANGES.beam.tPiezoMm.max} step={RANGES.beam.tPiezoMm.step} onChange={(v) => app.patchBeam({ tPiezo: v / 1000 })} display={`${(b.tPiezo * 1000).toFixed(2)}`} testId="cad-beam-tpiezo" />
            </div>
            <Slider label="Masa de punta" value={b.tipMass * 1000} min={RANGES.beam.tipMassG.min} max={RANGES.beam.tipMassG.max} step={RANGES.beam.tipMassG.step} onChange={(v) => app.patchBeam({ tipMass: v / 1000 })} display={`${(b.tipMass * 1000).toFixed(1)} g`} testId="cad-beam-tipmass" />
            <Slider label="Factor de escala" value={b.scaleFactor} min={RANGES.beam.scaleFactor.min} max={RANGES.beam.scaleFactor.max} step={RANGES.beam.scaleFactor.step} onChange={(v) => app.patchBeam({ scaleFactor: v })} display={`×${b.scaleFactor.toFixed(0)}`} testId="cad-beam-scale" />
          </Section>
        )}

        <Section title="Carcasa decorativa (STL / glTF)">
          <div className="dropzone" onClick={() => fileRef.current?.click()} data-testid="cad-dropzone">
            <Upload size={18} style={{ marginBottom: 6 }} />
            <div>Haz clic para importar un modelo STL, glTF o GLB</div>
            <div className="tiny" style={{ marginTop: 4 }}>Se muestra semitransparente como envolvente</div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".stl,.gltf,.glb"
            style={{ display: 'none' }}
            data-testid="cad-file-input"
            onChange={(e) => e.target.files?.[0] && viewerRef.current?.importShell(e.target.files[0])}
          />
          <button className="btn sm ghost" style={{ marginTop: 8, width: '100%' }} onClick={() => viewerRef.current?.clearShell()} data-testid="cad-clear-shell">
            <Trash2 size={13} /> Quitar carcasa
          </button>
        </Section>

        <Section title="Exportar">
          <button className="btn sm" style={{ width: '100%', marginBottom: 8 }} onClick={() => viewerRef.current?.exportSTL(target === 'tile' ? 'baldosa.stl' : 'viga_bimorfa.stl')} data-testid="cad-export-stl">
            <Boxes size={13} /> Geometría → STL
          </button>
          <div className="btn-row">
            <button className="btn sm" onClick={() => (target === 'tile' ? app.tileResult && exportTileCSV(t, app.tileResult) : app.beamResult && exportBeamCSV(b, app.beamResult))} data-testid="cad-export-csv">
              <Download size={13} /> Resultados CSV
            </button>
            <button className="btn sm" onClick={() => (target === 'tile' ? app.tileResult && exportTileSummary(t, app.tileResult) : app.beamResult && exportBeamSummary(b, app.beamResult))} data-testid="cad-export-json">
              <FileJson size={13} /> Resultados JSON
            </button>
          </div>
        </Section>
      </div>

      <div style={{ minWidth: 0, minHeight: 0, display: 'grid' }}>
        {target === 'tile' ? (
          <Viewer3D ref={viewerRef} kind="tile" tileParams={t} tileResult={app.tileResult} />
        ) : (
          <Viewer3D ref={viewerRef} kind="beam" beamParams={b} beamResult={app.beamResult} modeIndex={modeIndex} />
        )}
      </div>
    </div>
  );
};
