/**
 * QR de un bit: módulos enteros en SVG, negro sobre blanco, zona de silencio
 * de 4 módulos. Apunta a la URL que le pasen (el origen de la landing).
 */
import React, { useMemo } from 'react';
import { qrMatrix } from './qrMatrix';

const QUIET = 4;

export function QrMark({ href, label }: { href: string; label: string }) {
  const matrix = useMemo(() => qrMatrix(href), [href]);
  const n = matrix.length;
  const box = n + QUIET * 2;
  const modules: React.ReactNode[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!matrix[y][x]) continue;
      modules.push(<rect key={`${x}-${y}`} x={x + QUIET} y={y + QUIET} width={1} height={1} fill="#000" />);
    }
  }
  return (
    <figure className="pz-qr">
      <svg
        viewBox={`0 0 ${box} ${box}`}
        width={box * 4}
        height={box * 4}
        shapeRendering="crispEdges"
        role="img"
        aria-label={label}
      >
        <rect width={box} height={box} fill="#fff" />
        {modules}
      </svg>
      <figcaption>{href}</figcaption>
    </figure>
  );
}
