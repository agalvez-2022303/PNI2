/** Exportadores de resultados: CSV y JSON. */
import { triggerDownload } from '../render/ioModel';
import { TileParams, TileResult, BeamParams, BeamResult } from '../sim/types';

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

export function exportTileCSV(params: TileParams, result: TileResult) {
  const s = result.series;
  const csv = csvFromColumns(
    ['t_s', 'F_N', 'Vp_V', 'Vcs_V', 'I_A', 'P_W', 'E_stored_J'],
    [s.t, s.F, s.Vp, s.Vcs, s.I, s.P, s.Estored]
  );
  triggerDownload(new Blob([csv], { type: 'text/csv' }), 'baldosa_series_temporal.csv');
}

export function exportTileSummary(params: TileParams, result: TileResult) {
  exportJSON(
    {
      simulacion: 'Baldosa piezoeléctrica de pisada (modo 33)',
      parametros: params,
      resultados: {
        Cp_F: result.Cp,
        Q_C: result.Q,
        Voc_V: result.Voc,
        energiaPorCiclo_J: result.energyPerCycle,
        energiaCosechada_J: result.energyHarvested,
        potenciaMedia_W: result.avgPower,
        eficienciaTeorica: result.etaTheoretical,
        eficienciaRealista: result.etaRealistic,
        acoplamientoMaximo_k33_2: result.maxCoupling,
        esfuerzoPorDisco_Pa: result.stress,
      },
    },
    'baldosa_resumen.json'
  );
}

export function exportBeamCSV(params: BeamParams, result: BeamResult) {
  const csv = csvFromColumns(
    ['f_Hz', 'P_W', 'V_V'],
    [result.frf.f, result.frf.P, result.frf.V]
  );
  triggerDownload(new Blob([csv], { type: 'text/csv' }), 'viga_frf.csv');
}

export function exportBeamSummary(params: BeamParams, result: BeamResult) {
  exportJSON(
    {
      simulacion: 'Viga bimorfa en voladizo (modo 31, Erturk-Inman)',
      parametros: params,
      resultados: {
        modos_Hz: result.modes.map((m) => m.freq),
        fnSDOF_Hz: result.fnSDOF,
        keq_Npm: result.keq,
        meq_kg: result.meq,
        EI_Nm2: result.EI,
        ejeNeutro_m: result.neutralAxis,
        Cp_F: result.Cp,
        Ropt_ohm: result.Ropt,
        pMaxWilliamsYates_W: result.pMaxWilliamsYates,
        pRealista_W: result.pRealistic,
        pModeloPico_W: result.pModelPeak,
        freqPico_Hz: result.peakFreq,
      },
    },
    'viga_resumen.json'
  );
}
