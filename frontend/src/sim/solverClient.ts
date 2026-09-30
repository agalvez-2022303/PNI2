/** Cliente del solver: usa un Web Worker y cae a hilo principal con rapidez si no responde. */
import { Material } from '../core/materials';
import { runTile } from './tileSim';
import { runBeam } from './beamSim';
import { TileParams, BeamParams, TileResult, BeamResult } from './types';

const FALLBACK_MS = 500;

let worker: Worker | null = null;
let workerBroken = false;
let counter = 0;
interface Pending {
  resolve: (v: any) => void;
  fallback: () => any;
  timer: any;
}
const pending = new Map<number, Pending>();

function resolveWith(id: number, value: any) {
  const p = pending.get(id);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(id);
  p.resolve(value);
}

function getWorker(): Worker | null {
  if (workerBroken) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../workers/solver.worker.ts', import.meta.url));
    worker.onmessage = (e: MessageEvent<any>) => {
      const { id, result } = e.data || {};
      if (id != null && result !== undefined) resolveWith(id, result);
    };
    worker.onerror = () => {
      workerBroken = true;
      worker = null;
      // resuelve lo pendiente en el hilo principal
      pending.forEach((p, id) => resolveWith(id, p.fallback()));
    };
    return worker;
  } catch {
    workerBroken = true;
    worker = null;
    return null;
  }
}

function submit<T>(kind: 'tile' | 'beam', payload: any, fallback: () => T): Promise<T> {
  const w = getWorker();
  if (!w) return Promise.resolve(fallback());
  const id = ++counter;
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolveWith(id, fallback()), FALLBACK_MS);
    pending.set(id, { resolve, fallback, timer });
    try {
      w.postMessage({ id, kind, ...payload });
    } catch {
      resolveWith(id, fallback());
    }
  });
}

export function solveTile(params: TileParams, piezo: Material): Promise<TileResult> {
  return submit('tile', { params, piezo }, () => runTile(params, piezo));
}

export function solveBeam(params: BeamParams, piezo: Material, substrate: Material): Promise<BeamResult> {
  return submit('beam', { params, piezo, substrate }, () => runBeam(params, piezo, substrate));
}
