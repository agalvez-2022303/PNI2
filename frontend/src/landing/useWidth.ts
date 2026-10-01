import { useEffect, useRef, useState } from 'react';

/**
 * Ancho del contenedor en px CSS, actualizado con ResizeObserver.
 * Sirve para elegir una escala de píxel entera para los dibujos de un bit.
 */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.floor(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}

/** Escala entera: 3 px por píxel lógico si cabe, si no 2. */
export function pixelScale(available: number, logicalWidth: number): number {
  return available >= logicalWidth * 3 ? 3 : 2;
}
