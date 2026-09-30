/* eslint-disable no-restricted-globals */
/**
 * Web Worker del solver: ejecuta la física fuera del hilo de UI.
 *
 * Recibe sólo TileInputs / BeamInputs (el modelo es fijo y shared con el hilo
 * principal), y devuelve el resultado ya calculado. Si la entrada no se puede
 * recortar al rango, devuelve el error para que el cliente lo reintente allí.
 */
import { runTile } from '../sim/tileSim';
import { runBeam } from '../sim/beamSim';
import { clampTileInputs, clampBeamInputs } from '../sim/defaults';
import { SolverRequest } from '../sim/types';

const ctx: Worker = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent<SolverRequest>) => {
  const msg = e.data;
  try {
    if (msg.kind === 'tile') {
      const result = runTile(clampTileInputs(msg.inputs));
      ctx.postMessage({ id: msg.id, kind: 'tile', result });
    } else {
      const result = runBeam(clampBeamInputs(msg.inputs));
      ctx.postMessage({ id: msg.id, kind: 'beam', result });
    }
  } catch (err: any) {
    ctx.postMessage({ id: msg.id, error: String(err?.message || err) });
  }
};

export {};
