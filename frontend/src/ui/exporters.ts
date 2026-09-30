/** Exportadores de resultados: CSV y JSON (sin datos de materiales ni geometría). */
import { triggerDownload } from '../render/ioModel';
import { TileInputs, TileResult, BeamInputs, BeamResult } from '../sim/types';

export function exportJSON(obj: any, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  triggerDownload(blob, filename);
}

function csvFromColumns(headers: string[], columns: number[][]): string {
  const n = Math.max(...columns.map((c) => c.length));
  const rows = [headers.join(',')];
  for (let i = 0; i < n; i++) {
    rows.push(columns.map((c) => (c[i] !== undefined ? c[i] : '')).join(','));
  }
  return rows.join('\n');
}

export function exportTileCSV(inputs: TileInputs, result: TileResult) {
  const s = result.series;
  const csv = csvFromColumns(
    ['t_s', 'F_N', 'Vp_V', 'Vcs_V', 'I_A', 'P_W', 'E_stored_J'],
    [s.t, s.F, s.Vp, s.Vcs, s.I, s.P, s.Estored]
  );
  triggerDownload(new Blob([csv], { type: 'text/csv' }), 'baldosa_series_temporal.csv');
}

export function exportTileSummary(inputs: TileInputs, result: TileResult) {
  exportJSON(
    {
      simulacion: 'Baldosa piezoeléctrica de pisada (modo 33)',
      modelo: 'PZT-5H · referencia fija (core/referenceModel.ts)',
      entradas: inputs,
      resultados: {
        Cp_F: result.Cp,
        CpStack_F: result.CpStack,
        Q_C: result.Q,
        Voc_V: result.Voc,
        energiaIdeal_J: result.energyIdeal,
        U_el_J: result.U_el,
        energiaCosechada_J: result.E_harvested,
        energiaLED_J: result.E_LED,
        cadenaEnergia_J: result.chain,
        tensionCondensador_V: result.VcSteady,
        rizado_Vc_V: result.VcRipple,
        corrientePicoLED_A: result.ILedPeak,
        potenciaMediaLED_W: result.avgPowerLED,
        acoplamientoElemento_k2: result.k2Elemento,
        eficienciaCerámica: result.etaCeramic,
        eficienciaMódulo: result.etaModulo,
        esfuerzoPorStack_Pa: result.stress,
        deformacionUniaxial: result.strain,
        aplastamiento_m: result.compression,
      },
    },
    'baldosa_resumen.json'
  );
}

export function exportBeamCSV(inputs: BeamInputs, result: BeamResult) {
  const csv = csvFromColumns(
    ['f_Hz', 'P_W', 'V_V'],
    [result.frf.f, result.frf.P, result.frf.V]
  );
  triggerDownload(new Blob([csv], { type: 'text/csv' }), 'viga_frf.csv');
}

export function exportBeamSummary(inputs: BeamInputs, result: BeamResult) {
  exportJSON(
    {
      simulacion: 'Viga bimorfa en voladizo (modo 31)',
      modelo: 'PZT-5H sobre latón · referencia fija (core/referenceModel.ts)',
      entradas: inputs,
      resultados: {
        modos_Hz: result.modes.map((m) => m.freq),
        fnSDOF_Hz: result.fnSDOF,
        keq_Npm: result.keq,
        meq_kg: result.meq,
        EI_Nm2: result.EI,
        ejeNeutro_m: result.neutralAxis,
        Cp_F: result.Cp,
        Ropt_ohm: result.Ropt,
        cotaWilliamsYates_W: result.pBound,
        pModelo_W: result.pModel,
        razonModeloCota: result.pRatio,
        freqPico_Hz: result.peakFreq,
        frfVsTiempo: result.frfVsTime,
      },
    },
    'viga_resumen.json'
  );
}
