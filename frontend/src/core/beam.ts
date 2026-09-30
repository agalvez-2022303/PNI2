/**
 * Viga bimorfa en voladizo (modo 31, dinámica) — modelo de Euler-Bernoulli
 * acoplado electromecánicamente (Erturk & Inman, 2011), truncado a 3 modos.
 *
 * Incluye:
 *  - Sección compuesta por transformación de secciones (eje neutro desplazado, EI, m').
 *  - Ecuación de frecuencias de un voladizo con masa de punta.
 *  - Formas modales normalizadas en masa.
 *  - FRF electromecánica: V(ω) y P(ω) a través de R_load.
 *  - Cota de potencia de Williams & Yates.
 *
 * Referencias: Erturk & Inman (2011), "Piezoelectric Energy Harvesting";
 * Williams & Yates (1996); IEEE Std 176-1987.
 */
import { PHYS, CANTILEVER_EFFECTIVE_MASS_FRACTION as MEFF } from './config';

export interface Layer {
  thickness: number;
  youngs: number;
  density: number;
}

export interface SectionProps {
  /** Posición del eje neutro medida desde la cara inferior [m]. */
  neutralAxis: number;
  /** Rigidez a flexión efectiva EI [N·m²]. */
  EI: number;
  /** Masa por unidad de longitud m' [kg/m]. */
  mLinear: number;
  /** Espesor total [m]. */
  totalThickness: number;
}

/**
 * Propiedades de la sección compuesta por transformación de secciones.
 * b_i* = b · (E_i / E_ref);  ȳ = Σ A_i* z_i / Σ A_i*;
 * EI = E_ref · Σ [ b_i* t_i³/12 + A_i*(z_i - ȳ)² ].
 */
export function compositeSection(layers: Layer[], width: number, Eref: number): SectionProps {
  let y0 = 0;
  const items = layers.map((l) => {
    const zc = y0 + l.thickness / 2;
    const bStar = width * (l.youngs / Eref);
    const aStar = bStar * l.thickness;
    y0 += l.thickness;
    return { l, zc, bStar, aStar };
  });
  const totalThickness = y0;
  const sumA = items.reduce((s, it) => s + it.aStar, 0);
  const na = items.reduce((s, it) => s + it.aStar * it.zc, 0) / sumA;
  const Istar = items.reduce(
    (s, it) => s + (it.bStar * Math.pow(it.l.thickness, 3)) / 12 + it.aStar * Math.pow(it.zc - na, 2),
    0
  );
  const EI = Eref * Istar;
  const mLinear = layers.reduce((s, l) => s + l.density * width * l.thickness, 0);
  return { neutralAxis: na, EI, mLinear, totalThickness };
}

/** Ecuación de frecuencias del voladizo con masa de punta (rotación de la masa despreciada). */
function freqEq(lambda: number, mu: number): number {
  const c = Math.cos(lambda);
  const s = Math.sin(lambda);
  const ch = Math.cosh(lambda);
  const sh = Math.sinh(lambda);
  return 1 + c * ch + lambda * mu * (c * sh - s * ch);
}

/** Encuentra las primeras `n` raíces positivas de la ecuación de frecuencias. */
export function eigenvalues(mu: number, n: number): number[] {
  const roots: number[] = [];
  const step = 0.01;
  let prev = freqEq(step, mu);
  let prevL = step;
  for (let lambda = 2 * step; lambda <= 14 && roots.length < n; lambda += step) {
    const cur = freqEq(lambda, mu);
    if (prev === 0) {
      roots.push(prevL);
    } else if (prev * cur < 0) {
      let a = prevL;
      let b = lambda;
      for (let k = 0; k < 80; k++) {
        const m = 0.5 * (a + b);
        const fm = freqEq(m, mu);
        if (freqEq(a, mu) * fm <= 0) b = m;
        else a = m;
      }
      roots.push(0.5 * (a + b));
    }
    prev = cur;
    prevL = lambda;
  }
  return roots;
}

/** σ_r para el voladizo: σ = (cosh λ + cos λ)/(sinh λ + sin λ). */
function sigma(lambda: number): number {
  return (Math.cosh(lambda) + Math.cos(lambda)) / (Math.sinh(lambda) + Math.sin(lambda));
}

export interface Mode {
  lambda: number;
  beta: number;
  omega: number;
  freq: number;
  /** Constante de normalización en masa. */
  norm: number;
  /** Participación modal γ_r = m'∫φ dx + M_t φ(L). */
  gamma: number;
  /** Pendiente modal en el extremo φ'(L). */
  slopeL: number;
  /** Término de acoplamiento θ_r [N/V]. */
  theta: number;
  phiL: number;
}

interface ShapeFns {
  phi: (x: number) => number;
  phiP: (x: number) => number;
}

function shapeFns(beta: number, lambda: number): ShapeFns {
  const sig = sigma(lambda);
  const phi = (x: number) => {
    const bx = beta * x;
    return Math.cosh(bx) - Math.cos(bx) - sig * (Math.sinh(bx) - Math.sin(bx));
  };
  const phiP = (x: number) => {
    const bx = beta * x;
    return beta * (Math.sinh(bx) + Math.sin(bx) - sig * (Math.cosh(bx) - Math.cos(bx)));
  };
  return { phi, phiP };
}

/** Integral de Simpson de f en [0,L] con m subintervalos (par). */
function simpson(f: (x: number) => number, L: number, m = 400): number {
  const h = L / m;
  let sum = f(0) + f(L);
  for (let i = 1; i < m; i++) {
    sum += (i % 2 === 0 ? 2 : 4) * f(i * h);
  }
  return (sum * h) / 3;
}

export interface BeamModel {
  section: SectionProps;
  modes: Mode[];
  Cp: number;
  /** Rigidez equivalente SDOF k_eq = 3EI/L³ [N/m]. */
  keq: number;
  /** Masa equivalente SDOF m_eq = 0.2427·m'L + M_t [kg]. */
  meq: number;
  /** Frecuencia natural SDOF f_n = (1/2π)√(k_eq/m_eq) [Hz]. */
  fnSDOF: number;
  L: number;
  vartheta: number;
}

export interface BeamGeom {
  length: number;
  width: number;
  tSub: number;
  tPiezo: number;
  tipMass: number;
  Ep: number;
  Es: number;
  rhoP: number;
  rhoS: number;
  epsR: number;
  d31: number;
  k31: number;
}

/** Construye el modelo modal completo de la viga bimorfa (sustrato central, piezo arriba/abajo). */
export function buildBeamModel(g: BeamGeom, nModes: number): BeamModel {
  const { length: L, width: b, tSub, tPiezo, tipMass, Ep, Es, rhoP, rhoS } = g;
  const layers: Layer[] = [
    { thickness: tPiezo, youngs: Ep, density: rhoP },
    { thickness: tSub, youngs: Es, density: rhoS },
    { thickness: tPiezo, youngs: Ep, density: rhoP },
  ];
  const section = compositeSection(layers, b, Es);
  const mp = section.mLinear;
  const mu = tipMass / (mp * L);
  const lambdas = eigenvalues(mu, nModes);

  // Acoplamiento por pendiente modal (bimorfo en serie), Erturk & Inman (2011).
  const e31 = Ep * g.d31; // e31 ≈ Y_p · d31 [C/m²]
  const na = section.neutralAxis;
  const yTopInner = tPiezo + tSub - na + 0; // borde interno de la piezo superior respecto a eje neutro
  // distancias (respecto al eje neutro) de las caras de la capa piezo superior
  const zInner = tPiezo + tSub - na; // cara interna (junto al sustrato)
  const zOuter = tPiezo + tSub + tPiezo - na; // cara externa
  void yTopInner;
  const coupIntegral = 0.5 * (zOuter * zOuter - zInner * zInner); // ∫ z dz sobre la capa piezo
  const vartheta = -(e31 * b * coupIntegral) / tPiezo;

  const modes: Mode[] = lambdas.map((lambda) => {
    const beta = lambda / L;
    const omega = beta * beta * Math.sqrt(section.EI / mp);
    const { phi, phiP } = shapeFns(beta, lambda);
    const phiL = phi(L);
    const rawNorm = mp * simpson((x) => phi(x) * phi(x), L) + tipMass * phiL * phiL;
    const nc = Math.sqrt(rawNorm);
    const gamma = (mp * simpson((x) => phi(x), L) + tipMass * phiL) / nc;
    const slopeL = phiP(L) / nc;
    const theta = vartheta * slopeL;
    return {
      lambda,
      beta,
      omega,
      freq: omega / (2 * Math.PI),
      norm: nc,
      gamma,
      slopeL,
      theta,
      phiL: phiL / nc,
    };
  });

  // Capacitancia bimorfo en serie: C_p = ε33^T · b · L / (2 t_p).
  const eps = g.epsR * PHYS.EPS0;
  const Cp = (eps * b * L) / (2 * tPiezo);

  const keq = (3 * section.EI) / Math.pow(L, 3);
  const meq = MEFF * mp * L + tipMass;
  const fnSDOF = (1 / (2 * Math.PI)) * Math.sqrt(keq / meq);

  return { section, modes, Cp, keq, meq, fnSDOF, L, vartheta };
}

/** Complejo mínimo. */
type Cx = { re: number; im: number };
const cadd = (a: Cx, b: Cx): Cx => ({ re: a.re + b.re, im: a.im + b.im });
const cmul = (a: Cx, b: Cx): Cx => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cdiv = (a: Cx, b: Cx): Cx => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
const cabs2 = (a: Cx): number => a.re * a.re + a.im * a.im;

/**
 * Voltaje complejo de la FRF multimodal a frecuencia ω para aceleración de base a0:
 * V = -iω Σ θ_r F_r G_r / [ (1/R + iωC_p) + iω Σ θ_r² G_r ],
 * con G_r = 1/(ω_r² - ω² + i·2ζ_r ω_r ω) y F_r = -γ_r a0.
 */
export function voltageFRF(
  model: BeamModel,
  omega: number,
  a0: number,
  R: number,
  zeta: number
): Cx {
  let numTheta: Cx = { re: 0, im: 0 };
  let sumTheta2: Cx = { re: 0, im: 0 };
  for (const m of model.modes) {
    const Fr = -m.gamma * a0;
    const denom: Cx = { re: m.omega * m.omega - omega * omega, im: 2 * zeta * m.omega * omega };
    const G = cdiv({ re: 1, im: 0 }, denom);
    numTheta = cadd(numTheta, cmul({ re: m.theta * Fr, im: 0 }, G));
    sumTheta2 = cadd(sumTheta2, cmul({ re: m.theta * m.theta, im: 0 }, G));
  }
  const num = cmul({ re: 0, im: -omega }, numTheta);
  const elec: Cx = { re: 1 / R, im: omega * model.Cp };
  const den = cadd(elec, cmul({ re: 0, im: omega }, sumTheta2));
  return cdiv(num, den);
}

/** Potencia media entregada a R: P = |V|²/(2R) [W]. */
export function powerFRF(model: BeamModel, omega: number, a0: number, R: number, zeta: number): number {
  const V = voltageFRF(model, omega, a0, R, zeta);
  return cabs2(V) / (2 * R);
}

/** Resistencia de carga óptima: R_opt ≈ 1/(ω_n · C_p) [Ω]. */
export function optimalResistance(omega: number, Cp: number): number {
  return 1 / (omega * Cp);
}

/** Cota de potencia máxima (Williams & Yates): P_max = m·a²/(8·ζ_T·ω_n) [W]. */
export function williamsYatesPmax(m: number, a: number, zetaT: number, omegaN: number): number {
  return (m * a * a) / (8 * zetaT * omegaN);
}
