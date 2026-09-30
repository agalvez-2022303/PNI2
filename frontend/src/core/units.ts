/**
 * Formateo de magnitudes SI con prefijos (p, n, µ, m, k, M, G...).
 * Internamente TODO se maneja en SI; esta capa es solo presentación.
 */
const PREFIXES = [
  { e: -12, s: 'p' },
  { e: -9, s: 'n' },
  { e: -6, s: 'µ' },
  { e: -3, s: 'm' },
  { e: 0, s: '' },
  { e: 3, s: 'k' },
  { e: 6, s: 'M' },
  { e: 9, s: 'G' },
  { e: 12, s: 'T' },
];

/** Formatea un valor SI eligiendo el prefijo adecuado. Ej: formatSI(1.48e-7,'J') -> "148 nJ". */
export function formatSI(value: number, unit = '', sig = 3): string {
  if (value === 0) return unit ? `0 ${unit}` : '0';
  if (!isFinite(value)) return '—';
  const neg = value < 0;
  const abs = Math.abs(value);
  const exp = Math.floor(Math.log10(abs));
  let p = PREFIXES[4];
  for (let i = PREFIXES.length - 1; i >= 0; i--) {
    if (exp >= PREFIXES[i].e) {
      p = PREFIXES[i];
      break;
    }
  }
  const scaled = abs / Math.pow(10, p.e);
  const mant = Number(scaled.toPrecision(sig));
  const sign = neg ? '-' : '';
  const suffix = `${p.s}${unit}`;
  return suffix ? `${sign}${mant} ${suffix}` : `${sign}${mant}`;
}

/** Notación científica compacta, ej: 3.74e-8. */
export function sci(value: number, sig = 3): string {
  if (value === 0) return '0';
  if (!isFinite(value)) return '—';
  return value.toExponential(sig - 1);
}

/** Redondeo a N cifras significativas (para tablas de resultados). */
export function toSig(value: number, sig = 4): number {
  if (value === 0 || !isFinite(value)) return value;
  return Number(value.toPrecision(sig));
}

/** Conversores útiles de UI a SI. */
export const conv = {
  mmToM: (mm: number) => mm * 1e-3,
  mToMm: (m: number) => m * 1e3,
  gToKg: (g: number) => g * 1e-3,
  kgToG: (kg: number) => kg * 1e3,
  nfToF: (nf: number) => nf * 1e-9,
  fToNf: (f: number) => f * 1e9,
};
