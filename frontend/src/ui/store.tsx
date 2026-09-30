import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Material, DEFAULT_MATERIALS } from '../core/materials';
import { TileParams, BeamParams, TileResult, BeamResult } from '../sim/types';
import { DEFAULT_TILE, DEFAULT_BEAM } from '../sim/defaults';
import { solveTile, solveBeam } from '../sim/solverClient';

const LS_MATERIALS = 'piezolab.materials.v1';
const LS_TILE = 'piezolab.tile.v1';
const LS_BEAM = 'piezolab.beam.v1';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...(fallback as any), ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}
function loadArr(key: string, fallback: Material[]): Material[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length ? arr : fallback;
  } catch {
    return fallback;
  }
}

export interface TileSnapshot {
  params: TileParams;
  result: TileResult;
  label: string;
}
export interface BeamSnapshot {
  params: BeamParams;
  result: BeamResult;
  label: string;
}

interface AppCtx {
  materials: Material[];
  piezos: Material[];
  substrates: Material[];
  addMaterial: (m: Material) => void;
  updateMaterial: (id: string, patch: Partial<Material>) => void;
  removeMaterial: (id: string) => void;
  resetMaterials: () => void;
  replaceMaterials: (list: Material[]) => void;

  tileParams: TileParams;
  patchTile: (p: Partial<TileParams>) => void;
  tileResult: TileResult | null;
  tileBusy: boolean;
  tileCompare: TileSnapshot | null;
  saveTileCompare: () => void;
  clearTileCompare: () => void;

  beamParams: BeamParams;
  patchBeam: (p: Partial<BeamParams>) => void;
  beamResult: BeamResult | null;
  beamBusy: boolean;
  beamCompare: BeamSnapshot | null;
  saveBeamCompare: () => void;
  clearBeamCompare: () => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [materials, setMaterials] = useState<Material[]>(() => loadArr(LS_MATERIALS, DEFAULT_MATERIALS));
  const [tileParams, setTileParams] = useState<TileParams>(() => load(LS_TILE, DEFAULT_TILE));
  const [beamParams, setBeamParams] = useState<BeamParams>(() => load(LS_BEAM, DEFAULT_BEAM));
  const [tileResult, setTileResult] = useState<TileResult | null>(null);
  const [beamResult, setBeamResult] = useState<BeamResult | null>(null);
  const [tileBusy, setTileBusy] = useState(false);
  const [beamBusy, setBeamBusy] = useState(false);
  const [tileCompare, setTileCompare] = useState<TileSnapshot | null>(null);
  const [beamCompare, setBeamCompare] = useState<BeamSnapshot | null>(null);

  useEffect(() => localStorage.setItem(LS_MATERIALS, JSON.stringify(materials)), [materials]);
  useEffect(() => localStorage.setItem(LS_TILE, JSON.stringify(tileParams)), [tileParams]);
  useEffect(() => localStorage.setItem(LS_BEAM, JSON.stringify(beamParams)), [beamParams]);

  const piezos = useMemo(() => materials.filter((m) => m.kind === 'piezo'), [materials]);
  const substrates = useMemo(() => materials.filter((m) => m.kind === 'substrate'), [materials]);

  const tileTimer = useRef<any>(null);
  useEffect(() => {
    const piezo = materials.find((m) => m.id === tileParams.piezoId) || piezos[0];
    if (!piezo) return;
    setTileBusy(true);
    clearTimeout(tileTimer.current);
    tileTimer.current = setTimeout(() => {
      solveTile(tileParams, piezo).then((r) => {
        setTileResult(r);
        setTileBusy(false);
      });
    }, 90);
    return () => clearTimeout(tileTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileParams, materials]);

  const beamTimer = useRef<any>(null);
  useEffect(() => {
    const piezo = materials.find((m) => m.id === beamParams.piezoId) || piezos[0];
    const sub = materials.find((m) => m.id === beamParams.substrateId) || substrates[0];
    if (!piezo || !sub) return;
    setBeamBusy(true);
    clearTimeout(beamTimer.current);
    beamTimer.current = setTimeout(() => {
      solveBeam(beamParams, piezo, sub).then((r) => {
        setBeamResult(r);
        setBeamBusy(false);
      });
    }, 90);
    return () => clearTimeout(beamTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beamParams, materials]);

  const value: AppCtx = {
    materials,
    piezos,
    substrates,
    addMaterial: (m) => setMaterials((xs) => [...xs, m]),
    updateMaterial: (id, patch) =>
      setMaterials((xs) => xs.map((m) => (m.id === id ? { ...m, ...patch } : m))),
    removeMaterial: (id) => setMaterials((xs) => xs.filter((m) => m.id !== id)),
    resetMaterials: () => setMaterials(DEFAULT_MATERIALS),
    replaceMaterials: (list) => setMaterials(list),

    tileParams,
    patchTile: (p) => setTileParams((s) => ({ ...s, ...p })),
    tileResult,
    tileBusy,
    tileCompare,
    saveTileCompare: () =>
      tileResult &&
      setTileCompare({
        params: tileParams,
        result: tileResult,
        label: `${materials.find((m) => m.id === tileParams.piezoId)?.name} · N=${tileParams.nLayers}`,
      }),
    clearTileCompare: () => setTileCompare(null),

    beamParams,
    patchBeam: (p) => setBeamParams((s) => ({ ...s, ...p })),
    beamResult,
    beamBusy,
    beamCompare,
    saveBeamCompare: () =>
      beamResult &&
      setBeamCompare({
        params: beamParams,
        result: beamResult,
        label: `${materials.find((m) => m.id === beamParams.piezoId)?.name} · ${(beamParams.tipMass * 1000).toFixed(1)} g`,
      }),
    clearBeamCompare: () => setBeamCompare(null),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp fuera de AppProvider');
  return c;
}
