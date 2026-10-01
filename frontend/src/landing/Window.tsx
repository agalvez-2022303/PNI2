/**
 * Ventana de escritorio de un bit: barra de título, contenido y barra de
 * estado opcional. En la portada la barra de título arrastra la ventana con
 * un contorno punteado, como en el escritorio original.
 */
import React, { useRef, useState } from 'react';

export interface WindowProps {
  title: string;
  children: React.ReactNode;
  status?: React.ReactNode;
  className?: string;
  active?: boolean;
  /** Cierra la ventana; sin esta prop no se dibuja la casilla de cierre. */
  onClose?: () => void;
  /** Trae la ventana al frente al pulsarla. */
  onFocus?: () => void;
  /** Permite arrastrar por la barra de título (solo escritorio ancho). */
  draggable?: boolean;
  style?: React.CSSProperties;
  id?: string;
  labelledBy?: string;
  as?: 'section' | 'div' | 'article';
}

interface Drag {
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
  dx: number;
  dy: number;
}

export function Window({
  title,
  children,
  status,
  className = '',
  active = true,
  onClose,
  onFocus,
  draggable = false,
  style,
  id,
  labelledBy,
  as = 'section',
}: WindowProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  const Tag = as;
  const titleId = labelledBy ?? (id ? `${id}-title` : undefined);

  const canDrag = () => draggable && window.matchMedia('(min-width: 1100px)').matches;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    onFocus?.();
    if (!canDrag() || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y, dx: 0, dy: 0 };
    setGhost({ x: 0, y: 0 });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.dx = e.clientX - d.startX;
    d.dy = e.clientY - d.startY;
    setGhost({ x: d.dx, y: d.dy });
  };

  const onPointerUp = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setGhost(null);
    setOffset({ x: d.baseX + d.dx, y: d.baseY + d.dy });
  };

  const translate = offset.x || offset.y ? `translate(${offset.x}px, ${offset.y}px)` : undefined;

  return (
    <Tag
      id={id}
      aria-labelledby={titleId}
      className={`pz-win ${active ? 'is-active' : 'is-inactive'} ${className}`}
      style={{ ...style, transform: translate }}
      onPointerDown={() => onFocus?.()}
    >
      <div
        className={`pz-titlebar ${draggable ? 'is-draggable' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="pz-title" id={titleId}>
          {title}
        </span>
        {onClose && (
          <button type="button" className="pz-close" onClick={onClose} aria-label={`Cerrar ${title}`}>
            <svg viewBox="0 0 7 7" width="14" height="14" shapeRendering="crispEdges" aria-hidden>
              <rect x="1" y="1" width="1" height="1" fill="currentColor" />
              <rect x="2" y="2" width="1" height="1" fill="currentColor" />
              <rect x="3" y="3" width="1" height="1" fill="currentColor" />
              <rect x="4" y="4" width="1" height="1" fill="currentColor" />
              <rect x="5" y="5" width="1" height="1" fill="currentColor" />
              <rect x="5" y="1" width="1" height="1" fill="currentColor" />
              <rect x="4" y="2" width="1" height="1" fill="currentColor" />
              <rect x="2" y="4" width="1" height="1" fill="currentColor" />
              <rect x="1" y="5" width="1" height="1" fill="currentColor" />
            </svg>
          </button>
        )}
      </div>
      <div className="pz-body">{children}</div>
      {status && (
        <div className="pz-status">
          {status}
          <svg className="pz-grip" viewBox="0 0 6 6" width="12" height="12" shapeRendering="crispEdges" aria-hidden>
            <rect x="5" y="1" width="1" height="1" fill="currentColor" />
            <rect x="3" y="3" width="1" height="1" fill="currentColor" />
            <rect x="5" y="3" width="1" height="1" fill="currentColor" />
            <rect x="1" y="5" width="1" height="1" fill="currentColor" />
            <rect x="3" y="5" width="1" height="1" fill="currentColor" />
            <rect x="5" y="5" width="1" height="1" fill="currentColor" />
          </svg>
        </div>
      )}
      {ghost && <div className="pz-ghost" aria-hidden style={{ transform: `translate(${ghost.x}px, ${ghost.y}px)` }} />}
    </Tag>
  );
}
