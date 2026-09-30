/**
 * Tokens de diseño de la interfaz CAD.
 *
 * Una sola fuente de verdad para el color, la tipografía y las medidas. Las
 * zonas de la pantalla se separan únicamente con líneas de 1 px: no hay
 * tarjetas, ni sombras, ni bordes redondeados (todo border-radius = 0).
 */

/** Paleta fría de interfaz. */
export const T = {
  /** Fondo general de la aplicación. */
  bg: '#0b0f14',
  /** Superficie de panel y de celda. */
  surface: '#0f151c',
  /** Superficie algo más clara para filas alternas y cabeceras. */
  surfaceAlt: '#131a23',
  /** Línea divisoria de 1 px. */
  line: '#253040',
  /** Texto principal. */
  text: '#c8d3df',
  /** Texto secundario y etiquetas. */
  textDim: '#7d8ea3',
  /** Acento único de la interfaz. */
  accent: '#38bdf8',
  /** Advertencia. */
  warn: '#f5a524',
  /** Fallo o violación. */
  fail: '#ef5350',
  /** "Cumple" en tablas de validación. */
  ok: '#3ddc97',
} as const;

/** Única familia tipográfica, monoespaciada. */
export const FONT = "'IBM Plex Mono', ui-monospace, monospace";

/** Tamaños de fuente admitidos, en px. */
export const FONT_SIZE = { xs: 11, sm: 12, md: 13 } as const;

/** Alturas fijas de las bandas de la pantalla, en px. */
export const ZONE = {
  topbar: 46,
  statusbar: 26,
  chart: 190,
} as const;

/** Color de la rampa de esfuerzo σ, en MPa. */
export const STRESS_RAMP: { mpa: number; hex: string }[] = [
  { mpa: 0, hex: '#1d4e89' },
  { mpa: 25, hex: '#38bdf8' },
  { mpa: 50, hex: '#3ddc97' },
  { mpa: 75, hex: '#f5a524' },
  { mpa: 100, hex: '#ef5350' },
];

/**
 * Rampa de esfuerzo σ. Es una escala de DATOS (MPa reales), no una
 * decoración: por eso no es un único acento.
 */
export function stressColorHex(mpa: number): string {
  const r = STRESS_RAMP;
  if (mpa <= r[0].mpa) return r[0].hex;
  for (let i = 1; i < r.length; i++) {
    if (mpa <= r[i].mpa) {
      const a = r[i - 1];
      const b = r[i];
      const f = (mpa - a.mpa) / (b.mpa - a.mpa);
      return mix(a.hex, b.hex, f);
    }
  }
  return r[r.length - 1].hex;
}

function mix(h1: string, h2: string, f: number): string {
  const a = parseInt(h1.slice(1), 16);
  const b = parseInt(h2.slice(1), 16);
  const ch = (shift: number) => {
    const x = (a >> shift) & 0xff;
    const y = (b >> shift) & 0xff;
    return Math.round(x + (y - x) * f);
  };
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

/** Color de estado: cumple / falla. */
export function statusColor(ok: boolean): string {
  return ok ? T.ok : T.fail;
}

/** Número de bandas discretas de la escala de σ en la interfaz. */
export const SIGMA_BANDS = 10;

/** Límite de la escala en MPa (100 MPa por defecto en `ALERTS`). */
export const SIGMA_LIMIT_MPA = 100;

/**
 * Escala de σ CUANTIFICADA en 10 bandas.
 *
 * La barra de la interfaz se pinta con estas bandas y no con un degradado
 * continuo: cada banda es un intervalo de MPa legible, y el color se puede
 * citar sin ambigüedad ("62 MPa, banda 7 de 10").
 */
export const SIGMA_STOPS: { mpa: number; color: string }[] = Array.from({ length: SIGMA_BANDS + 1 }, (_, i) => {
  const mpa = (SIGMA_LIMIT_MPA * i) / SIGMA_BANDS;
  return { mpa: Math.round(mpa * 10) / 10, color: stressColorHex(mpa) };
});

/**
 * Color de σ cuantizado. Dos valores dentro de la misma banda reciben el
 * mismo color, que es lo que hace falta para poder leer un valor del color.
 */
export function stressStepHex(mpa: number): string {
  const band = Math.round(clamp(mpa / SIGMA_LIMIT_MPA, 0, 1) * SIGMA_BANDS);
  return stressColorHex((band * SIGMA_LIMIT_MPA) / SIGMA_BANDS);
}

/** Banda 1..SIGMA_BANDS en la que cae σ. */
export function stressBand(mpa: number): number {
  return Math.round(clamp(mpa / SIGMA_LIMIT_MPA, 0, 1) * SIGMA_BANDS) + 1;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Formato numérico de la interfaz: notación fija con un número fijo de
 * decimales y sin separador de miles, para que las columnas encajen.
 */
export function fmt(x: number, digits = 2): string {
  if (!isFinite(x)) return '—';
  const v = Math.abs(x) < 10 ** -(digits + 2) ? 0 : x;
  return v.toFixed(digits);
}

/** Igual que `fmt` pero en notación de ingeniería (1.23 µ, 4.56 m). */
export function fmtSI(x: number, unit: string, digits = 2): string {
  const a = Math.abs(x);
  if (a === 0) return `0 ${unit}`;
  const table: [number, string][] = [
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
    [1, ''],
    [1e-3, 'm'],
    [1e-6, 'µ'],
    [1e-9, 'n'],
  ];
  for (const [f, p] of table) {
    if (a >= f) return `${fmt(x / f, digits)} ${p}${unit}`;
  }
  return `${fmt(x / 1e-12, digits)} p${unit}`;
}
