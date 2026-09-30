/**
 * Cliente del solver: envía la petición al Web Worker y cae al hilo principal
 * si el worker no responde en FALLBACK_MS o falla al construirse.
 *
 * Las entradas ya no incluyen materiales ni geometría: el modelo fijo vive en
 * core/referenceModel.ts, así que aquí sólo viajan TileInputs / BeamInputs.
 */
import { runTile } from './tileSim';
import { runBeam } from './beamSim';
import { clampTileInputs, clampBeamInputs } from './defaults';
import { TileInputs, BeamInputs, TileResult, BeamResult, SolverRequest } from './types';

const FALLBACK_MS = 500;

let worker: Worker | null = null;
let workerBroken = false;
let counter = 0;

interface Pending {
  resolve: (v: any) => void;
  fallback: () => any;
  timer: ReturnType<typeof setTimeout>;
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
    worker = new Worker(new URL('../workers/solver.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<any>) => {
      const { id, result, error } = e.data || {};
      if (id == null) return;
      if (error) {
        // El worker no sabe resolver esta entrada: se recalcula en el hilo
        // principal, que lanza la excepción real si el modelo es inválido.
        const p = pending.get(id);
        if (p) {
          pending.delete(id);
          clearTimeout(p.timer);
          p.resolve(p.fallback());
        }
        return;
      }
      if (result !== undefined) resolveWith(id, result);
    };
    worker.onerror = () => {
      workerBroken = true;
      worker = null;
      pending.forEach((p, id) => resolveWith(id, p.fallback()));
    };
    return worker;
  } catch {
    workerBroken = true;
    worker = null;
    return null;
  }
}

function submit<T>(req: SolverRequest, fallback: () => T): Promise<T> {
  const w = getWorker();
  if (!w) return Promise.resolve(fallback());
  const id = ++counter;
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolveWith(id, fallback()), FALLBACK_MS);
    pending.set(id, { resolve, fallback, timer });
    try {
      w.postMessage({ ...req, id });
    } catch {
      resolveWith(id, fallback());
    }
  });
}

export function solveTile(raw: Partial<TileInputs>): Promise<TileResult> {
  const inputs = clampTileInputs(raw);
  return submit({ id: 0, kind: 'tile', inputs }, () => runTile(inputs));
}

export function solveBeam(raw: Partial<BeamInputs>): Promise<BeamResult> {
  const inputs = clampBeamInputs(raw);
  return submit({ id: 0, kind: 'beam', inputs }, () => runBeam(inputs));
}
