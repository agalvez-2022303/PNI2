import React, { useRef } from 'react';
import { useApp } from './store';
import { Material } from '../core/materials';
import { exportJSON } from './exporters';
import { Plus, RotateCcw, Download, Upload, Trash2 } from 'lucide-react';

interface Col {
  key: keyof Material;
  label: string;
  scale: number; // SI = display / scale  (display = SI * scale)
  step: number;
  unit: string;
}
const COLS: Col[] = [
  { key: 'd33', label: 'd₃₃', scale: 1e12, step: 1, unit: 'pC/N' },
  { key: 'd31', label: 'd₃₁', scale: 1e12, step: 1, unit: 'pC/N' },
  { key: 'epsR', label: 'ε_r', scale: 1, step: 10, unit: '' },
  { key: 'k33', label: 'k₃₃', scale: 1, step: 0.01, unit: '' },
  { key: 'youngs', label: 'Y', scale: 1e-9, step: 1, unit: 'GPa' },
  { key: 'density', label: 'ρ', scale: 1, step: 10, unit: 'kg/m³' },
  { key: 'poisson', label: 'ν', scale: 1, step: 0.01, unit: '' },
  { key: 'damping', label: 'ζ', scale: 1, step: 0.005, unit: '' },
];

const NumCell: React.FC<{ value: number; scale: number; step: number; onChange: (siValue: number) => void; testId: string }> = ({
  value,
  scale,
  step,
  onChange,
  testId,
}) => (
  <input
    type="number"
    step={step}
    value={Number((value * scale).toPrecision(6))}
    onChange={(e) => onChange(parseFloat(e.target.value) / scale)}
    data-testid={testId}
  />
);

export const MaterialsEditor: React.FC = () => {
  const app = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  const addPiezo = () => {
    const m: Material = {
      id: 'mat_' + Date.now(),
      name: 'Nuevo piezo',
      kind: 'piezo',
      d33: 300e-12,
      d31: -120e-12,
      epsR: 1500,
      k33: 0.65,
      youngs: 60e9,
      density: 7600,
      poisson: 0.31,
      damping: 0.02,
    };
    app.addMaterial(m);
  };
  const addSubstrate = () => {
    const m: Material = {
      id: 'sub_' + Date.now(),
      name: 'Nuevo sustrato',
      kind: 'substrate',
      d33: 0,
      d31: 0,
      epsR: 0,
      k33: 0,
      youngs: 100e9,
      density: 8000,
      poisson: 0.3,
      damping: 0.01,
    };
    app.addMaterial(m);
  };

  const importJSON = async (file: File) => {
    try {
      const arr = JSON.parse(await file.text());
      if (Array.isArray(arr)) app.replaceMaterials(arr);
    } catch {
      alert('JSON de materiales inválido');
    }
  };

  return (
    <div className="page">
      <div className="maxw">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 22, margin: 0 }}>Base de datos de materiales</h1>
            <p className="muted tiny" style={{ margin: '4px 0 0' }}>
              Editable en vivo · persiste en el navegador · unidades SI internamente
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={addPiezo} data-testid="mat-add-piezo">
              <Plus size={13} /> Piezo
            </button>
            <button className="btn sm" onClick={addSubstrate} data-testid="mat-add-sub">
              <Plus size={13} /> Sustrato
            </button>
            <button className="btn sm" onClick={() => exportJSON(app.materials, 'materiales.json')} data-testid="mat-export">
              <Download size={13} /> Exportar
            </button>
            <button className="btn sm" onClick={() => fileRef.current?.click()} data-testid="mat-import">
              <Upload size={13} /> Importar
            </button>
            <button className="btn sm warn" onClick={app.resetMaterials} data-testid="mat-reset">
              <RotateCcw size={13} /> Restablecer
            </button>
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])} />
          </div>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="data" data-testid="materials-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Tipo</th>
                {COLS.map((c) => (
                  <th key={c.key}>
                    {c.label} {c.unit && <span className="muted">{c.unit}</span>}
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {app.materials.map((m) => (
                <tr key={m.id} className={m.kind}>
                  <td className="name" style={{ minWidth: 130 }}>
                    <input type="text" value={m.name} onChange={(e) => app.updateMaterial(m.id, { name: e.target.value })} data-testid={`mat-name-${m.id}`} />
                  </td>
                  <td>
                    <span className={`badge ${m.kind === 'piezo' ? 'piezo' : 'sub'}`}>{m.kind === 'piezo' ? 'piezo' : 'sustrato'}</span>
                  </td>
                  {COLS.map((c) => (
                    <td key={c.key} style={{ minWidth: 92 }}>
                      <NumCell value={m[c.key] as number} scale={c.scale} step={c.step} onChange={(si) => app.updateMaterial(m.id, { [c.key]: si } as any)} testId={`mat-${c.key}-${m.id}`} />
                    </td>
                  ))}
                  <td>
                    <button className="btn sm ghost" onClick={() => app.removeMaterial(m.id)} data-testid={`mat-del-${m.id}`} title="Eliminar">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 12 }}>
          d₃₃, d₃₁ en pC/N · ε_r = ε₃₃ᵀ/ε₀ · Y en GPa · ρ en kg/m³. ε₀ = 8.854×10⁻¹² F/m. Fuentes: hojas de datos APC/PI e IEEE Std 176-1987.
        </p>
      </div>
    </div>
  );
};
