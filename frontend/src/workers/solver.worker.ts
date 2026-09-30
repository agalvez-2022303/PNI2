/* eslint-disable no-restricted-globals */
/** Web Worker del solver: ejecuta la física fuera del hilo de UI. */
import { runTile } from '../sim/tileSim';
import { runBeam } from '../sim/beamSim';
import { SolverRequest } from '../sim/types';

const ctx: Worker = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent<SolverRequest>) => {
  const msg = e.data;
  try {
    if (msg.kind === 'tile') {
      const result = runTile(msg.params, msg.piezo);
      ctx.postMessage({ id: msg.id, kind: 'tile', result });
    } else {
      const result = runBeam(msg.params, msg.piezo, msg.substrate);
      ctx.postMessage({ id: msg.id, kind: 'beam', result });
    }
  } catch (err: any) {
    ctx.postMessage({ id: msg.id, error: String(err?.message || err) });
  }
};

export {};
