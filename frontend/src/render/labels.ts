/**
 * Etiquetas de texto y globos numerados para el visor CAD.
 *
 * Se dibujan como sprites sobre lienzo: son SIEMPRE legibles (depthTest off) y
 * no dependen de la resolución de pantalla. El texto va en la única familia
 * monoespaciada de la aplicación.
 */
import * as THREE from 'three';
import { FONT } from '../ui/cad/theme';

export interface LabelOpts {
  /** Color del texto. */
  color?: string;
  /** Tamaño de fuente en px dentro del lienzo. */
  size?: number;
  /** Dibuja un fondo de panel detrás del texto. */
  bg?: boolean;
  /** Color del fondo del panel. */
  bgColor?: string;
  /** Grosor del borde del panel. */
  border?: string;
}

const PAD = 7;

/** Sprite con una línea de texto. */
export function textSprite(text: string, o: LabelOpts = {}): THREE.Sprite {
  const size = o.size ?? 34;
  const color = o.color ?? '#1f2d3d';
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = `${size}px ${FONT}`;
  const w = Math.ceil(probe.measureText(text).width) + PAD * 2;
  const h = size + PAD * 2;

  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  if (o.bg !== false) {
    ctx.fillStyle = o.bgColor ?? '#f8fafc';
    ctx.fillRect(0, 0, w, h);
    if (o.border) {
      ctx.strokeStyle = o.border;
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    }
  }
  ctx.font = `${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true })
  );
  // Escala en unidades de escena: 1 px de lienzo ≈ 0.055 mm.
  spr.userData.pxScale = 0.055;
  spr.userData.canvas = { w, h };
  spr.renderOrder = 1000;
  updateSpriteScale(spr);
  return spr;
}

/** Ajusta la escala del sprite a partir del tamaño de su lienzo. */
export function updateSpriteScale(spr: THREE.Sprite) {
  const c = spr.userData.canvas;
  if (!c) return;
  const s = spr.userData.pxScale as number;
  spr.scale.set(c.w * s, c.h * s, 1);
}

/** Globo numerado: disco claro con aro y número oscuros, estilo plano. */
export function balloonSprite(n: number, color: string = '#1f2d3d'): THREE.Sprite {
  const S = 84;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  // Disco claro con borde oscuro: legible sobre el fondo claro del visor.
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.font = `600 46px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), S / 2, S / 2 + 2);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true })
  );
  spr.userData.pxScale = 0.11;
  spr.userData.canvas = { w: S, h: S };
  spr.renderOrder = 1001;
  updateSpriteScale(spr);
  return spr;
}

/** Línea guía del globo: punteada, une el globo con la pieza a la que apunta. */
export function leaderLine(from: THREE.Vector3, to: THREE.Vector3, color: string = '#1f2d3d'): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(
    geo,
    new THREE.LineDashedMaterial({ color, dashSize: 2, gapSize: 1.4, depthTest: false, transparent: true, opacity: 0.9 })
  );
  line.computeLineDistances();
  line.userData.nonPick = true;
  line.renderOrder = 999;
  return line;
}

/** Etiqueta de eje de la tríada. */
export function axisLabel(text: string, color: string): THREE.Sprite {
  const spr = textSprite(text, { color, size: 44, bg: false });
  spr.userData.pxScale = 0.05;
  updateSpriteScale(spr);
  return spr;
}
