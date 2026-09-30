import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { TileInputs, BeamInputs, TileResult, BeamResult } from '../sim/types';
import { DEFAULT_TILE_INPUTS, DEFAULT_BEAM_INPUTS, clampTileInputs, clampBeamInputs } from '../sim/defaults';
import { solveTile, solveBeam } from '../sim/solverClient';
import { saveRun, listRuns, deleteRun, StoredRun } from '../sim/storage';
import { BEAM, INPUTS } from '../core/referenceModel';

export interface TileSnapshot {
  inputs: TileInputs;
  result: TileResult;
  label: string;
}
export interface BeamSnapshot {
  inputs: BeamInputs;
  result: BeamResult;
  label: string;
}

interface AppCtx {
  /** Única entrada editable de la baldosa: F_max y cadencia. */
  tileInputs: TileInputs;
  patchTile: (p: Partial<TileInputs>) => void;
  tileResult: TileResult | null;
  tileBusy: boolean;
  tileCompare: TileSnapshot | null;
  saveTileCompare: () => void;
  clearTileCompare: () => void;

  /** Única entrada editable de la viga: a0 y f_exc. */
  beamInputs: BeamInputs;
  patchBeam: (p: Partial<BeamInputs>) => void;
  beamResult: BeamResult | null;
  beamBusy: boolean;
  beamCompare: BeamSnapshot | null;
  saveBeamCompare: () => void;
  clearBeamCompare: () => void;

  /** Corridas guardadas en IndexedDB (nunca localStorage). */
  runs: StoredRun[];
  reloadRuns: () => Promise<void>;
  archiveCurrent: () => Promise<void>;
  removeRun: (id: number) => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

/** Resumen numérico de una corrida, sin las trazas pesadas. */
const TILE_SUMMARY: (keyof TileResult & string)[] = [
  'Cp',
  'Q',
  'Voc',
  'energyIdeal',
  'U_el',
  'E_harvested',
  'E_LED',
  'stress',
  'strain',
  'compression',
  'VcSteady',
  'ILedPeak',
  'avgPowerLED',
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tileInputs, setTileInputs] = useState<TileInputs>(DEFAULT_TILE_INPUTS);
  const [beamInputs, setBeamInputs] = useState<BeamInputs>(DEFAULT_BEAM_INPUTS);
  const [tileResult, setTileResult] = useState<TileResult | null>(null);
  const [beamResult, setBeamResult] = useState<BeamResult | null>(null);
  const [tileBusy, setTileBusy] = useState(false);
  const [beamBusy, setBeamBusy] = useState(false);
  const [tileCompare, setTileCompare] = useState<TileSnapshot | null>(null);
  const [beamCompare, setBeamCompare] = useState<BeamSnapshot | null>(null);
  const [runs, setRuns] = useState<StoredRun[]>([]);

  const reloadRuns = useCallback(async () => {
    try {
      setRuns(await listRuns());
    } catch {
      setRuns([]);
    }
  }, []);

  useEffect(() => {
    void reloadRuns();
  }, [reloadRuns]);

  // El modelo es fijo: cualquier cambio de entrada dispara un recálculo, sin
  // dependencia de materiales ni geometría.
  const tileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setTileBusy(true);
    if (tileTimer.current) clearTimeout(tileTimer.current);
    tileTimer.current = setTimeout(() => {
      solveTile(tileInputs).then((r) => {
        setTileResult(r);
        setTileBusy(false);
      });
    }, 90);
    return () => {
      if (tileTimer.current) clearTimeout(tileTimer.current);
    };
  }, [tileInputs]);

  const beamTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setBeamBusy(true);
    if (beamTimer.current) clearTimeout(beamTimer.current);
    beamTimer.current = setTimeout(() => {
      solveBeam(beamInputs).then((r) => {
        setBeamResult(r);
        setBeamBusy(false);
      });
    }, 90);
    return () => {
      if (beamTimer.current) clearTimeout(beamTimer.current);
    };
  }, [beamInputs]);

  const archiveCurrent = useCallback(async () => {
    const now = new Date().toISOString();
    if (tileResult) {
      const summary: Record<string, number> = {};
      for (const k of TILE_SUMMARY) {
        const v = tileResult[k];
        if (typeof v === 'number') summary[k] = v;
      }
      await saveRun({
        kind: 'tile',
        createdAt: now,
        inputs: { ...tileInputs },
        summary,
      });
    }
    if (beamResult) {
      await saveRun({
        kind: 'beam',
        createdAt: now,
        inputs: { ...beamInputs },
        summary: {
          EI: beamResult.EI,
          keq: beamResult.keq,
          meq: beamResult.meq,
          fnSDOF: beamResult.fnSDOF,
          Cp: beamResult.Cp,
          Ropt: beamResult.Ropt,
          pModel: beamResult.pModel,
          pBound: beamResult.pBound,
          pRatio: beamResult.pRatio,
          peakFreq: beamResult.peakFreq,
        },
      });
    }
    await reloadRuns();
  }, [tileResult, beamResult, tileInputs, beamInputs, reloadRuns]);

  const removeRun = useCallback(
    async (id: number) => {
      await deleteRun(id);
      await reloadRuns();
    },
    [reloadRuns]
  );

  const value: AppCtx = useMemo(
    () => ({
      tileInputs,
      patchTile: (p) => setTileInputs((s) => clampTileInputs({ ...s, ...p })),
      tileResult,
      tileBusy,
      tileCompare,
      saveTileCompare: () =>
        tileResult &&
        setTileCompare({
          inputs: tileInputs,
          result: tileResult,
          label: `F_max = ${tileInputs.Fmax} N · ${tileInputs.cadence} pasos/min`,
        }),
      clearTileCompare: () => setTileCompare(null),

      beamInputs,
      patchBeam: (p) => setBeamInputs((s) => clampBeamInputs({ ...s, ...p })),
      beamResult,
      beamBusy,
      beamCompare,
      saveBeamCompare: () =>
        beamResult &&
        setBeamCompare({
          inputs: beamInputs,
          result: beamResult,
          label: `a0 = ${beamInputs.a0} m/s² · f_exc = ${beamInputs.fExc} Hz`,
        }),
      clearBeamCompare: () => setBeamCompare(null),

      runs,
      reloadRuns,
      archiveCurrent,
      removeRun,
    }),
    [
      tileInputs,
      tileResult,
      tileBusy,
      tileCompare,
      beamInputs,
      beamResult,
      beamBusy,
      beamCompare,
      runs,
      reloadRuns,
      archiveCurrent,
      removeRun,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp fuera de AppProvider');
  return c;
}

/** Rango de a0 mostrado en la interfaz, en m/s². */
export const A0_RANGE = INPUTS.a0;
/** Modo propio de referencia de la viga, para la etiqueta de la interfaz. */
export const F1_REFERENCE = 72.633;
/** Razón de amortiguamiento mecánica asumida. */
export const ZETA_MEC = BEAM.zetaMec;
