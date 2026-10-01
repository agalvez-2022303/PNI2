/**
 * Iconos de 32 × 32 dibujados a píxel entero, en dos colores.
 *
 * Cada icono es una lista de rectángulos sobre una rejilla de 16 × 16 que se
 * escala ×2, de modo que todos comparten el mismo grosor de trazo.
 */
import React from 'react';

type Rect = [x: number, y: number, w: number, h: number];

function Pixels({ rects, fills = [], label }: { rects: Rect[]; fills?: Rect[]; label?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="32"
      height="32"
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="pz-icon"
    >
      {fills.map(([x, y, w, h], i) => (
        <rect key={`f${i}`} x={x} y={y} width={w} height={h} fill="#fff" />
      ))}
      {rects.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill="#000" />
      ))}
    </svg>
  );
}

/** Documento de texto con esquina doblada. */
export function DocIcon() {
  return (
    <Pixels
      fills={[[3, 1, 9, 14]]}
      rects={[
        [3, 1, 7, 1], [3, 1, 1, 14], [3, 14, 10, 1], [12, 4, 1, 11],
        [9, 1, 1, 4], [9, 4, 4, 1], [10, 2, 1, 1], [11, 3, 1, 1],
        [5, 6, 6, 1], [5, 8, 6, 1], [5, 10, 6, 1], [5, 12, 4, 1],
      ]}
    />
  );
}

/** Traza de una pisada sobre papel. */
export function TraceIcon() {
  return (
    <Pixels
      fills={[[1, 2, 14, 12]]}
      rects={[
        [1, 2, 14, 1], [1, 13, 14, 1], [1, 2, 1, 12], [14, 2, 1, 12],
        [2, 11, 3, 1], [5, 10, 1, 1], [6, 8, 1, 2], [7, 6, 1, 2], [8, 5, 1, 1],
        [9, 6, 1, 2], [10, 8, 1, 2], [11, 10, 1, 1], [12, 11, 2, 1],
      ]}
    />
  );
}

/** Stack de discos piezoeléctricos visto de lado. */
export function StackIcon() {
  return (
    <Pixels
      fills={[[4, 2, 8, 12]]}
      rects={[
        [3, 1, 10, 1], [3, 14, 10, 1], [3, 1, 1, 14], [12, 1, 1, 14],
        [4, 4, 8, 1], [4, 6, 8, 1], [4, 8, 8, 1], [4, 10, 8, 1], [4, 12, 8, 1],
        [7, 0, 2, 1], [7, 15, 2, 1],
      ]}
    />
  );
}

/** Carpeta de pruebas con marca de verificación. */
export function TestsIcon() {
  return (
    <Pixels
      fills={[[1, 4, 14, 10]]}
      rects={[
        [1, 3, 5, 1], [1, 3, 1, 11], [6, 4, 8, 1], [5, 3, 1, 1],
        [1, 13, 14, 1], [14, 4, 1, 10], [1, 6, 14, 1],
        [5, 9, 1, 1], [6, 10, 1, 1], [7, 11, 1, 1], [8, 10, 1, 1], [9, 9, 1, 1], [10, 8, 1, 1],
      ]}
    />
  );
}

/** Silueta de persona, para el apartado de equipo. */
export function PersonIcon() {
  return (
    <Pixels
      rects={[
        [6, 1, 4, 1],
        [5, 2, 6, 5],
        [4, 8, 8, 1],
        [3, 9, 10, 6],
      ]}
    />
  );
}

/** Aplicación: la ventana del banco de trabajo con un cubo. */
export function AppIcon() {
  return (
    <Pixels
      fills={[[1, 1, 14, 14]]}
      rects={[
        [1, 1, 14, 1], [1, 4, 14, 1], [1, 14, 14, 1], [1, 1, 1, 14], [14, 1, 1, 14],
        [2, 2, 12, 2],
        [6, 6, 4, 1], [5, 7, 1, 1], [10, 7, 1, 1], [4, 8, 7, 1], [4, 8, 1, 4], [10, 8, 1, 4],
        [4, 12, 7, 1], [7, 8, 1, 5], [11, 7, 1, 4],
      ]}
    />
  );
}

/** Flecha hacia abajo, para enlaces de desplazamiento. */
export function ArrowDown() {
  return (
    <svg viewBox="0 0 8 8" width="12" height="12" shapeRendering="crispEdges" aria-hidden className="pz-arrow">
      <rect x="3" y="0" width="2" height="5" fill="currentColor" />
      <rect x="1" y="4" width="6" height="1" fill="currentColor" />
      <rect x="2" y="5" width="4" height="1" fill="currentColor" />
      <rect x="3" y="6" width="2" height="1" fill="currentColor" />
    </svg>
  );
}

/** Logotipo: disco piezoeléctrico con un rayo de carga. */
export function LogoMark() {
  return (
    <Pixels
      label="PiezoLab"
      fills={[[2, 2, 12, 12]]}
      rects={[
        [5, 1, 6, 1], [3, 2, 2, 1], [11, 2, 2, 1], [2, 3, 1, 2], [13, 3, 1, 2],
        [1, 5, 1, 6], [14, 5, 1, 6], [2, 11, 1, 2], [13, 11, 1, 2],
        [3, 13, 2, 1], [11, 13, 2, 1], [5, 14, 6, 1],
        [8, 3, 2, 1], [7, 4, 2, 1], [6, 5, 2, 2], [6, 7, 5, 1], [8, 8, 2, 2], [7, 10, 2, 1], [6, 11, 2, 1],
      ]}
    />
  );
}
