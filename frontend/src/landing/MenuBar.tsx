/**
 * Barra de menú del escritorio: marca, apartados y el botón de entrada.
 * En la simulación el botón se sustituye por «Inicio» para volver a la landing
 * sin tocar el banco de trabajo.
 */
import React, { useCallback, useRef, useState } from 'react';
import { LogoMark } from './PixelIcons';

export const SIMULATION_HASH = '#simulation';

const ZOOM_FRAMES = 9;
const ZOOM_STEP_MS = 28;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const NAV_LINKS = [
  { href: '#cadena', label: 'Circuito' },
  { href: '#modelo', label: 'Modelo' },
  { href: '#pruebas', label: 'Pruebas' },
  { href: '#limites', label: 'Límites' },
  { href: '#equipo', label: 'Equipo' },
] as const;

export function useLaunch() {
  const [frames, setFrames] = useState<Box[]>([]);
  const busy = useRef(false);

  const launch = useCallback((from: HTMLElement) => {
    if (busy.current) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      window.location.hash = SIMULATION_HASH;
      return;
    }
    busy.current = true;
    const r = from.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const boxes: Box[] = [];
    for (let i = 0; i <= ZOOM_FRAMES; i++) {
      const k = i / ZOOM_FRAMES;
      const e = 1 - Math.pow(1 - k, 2);
      boxes.push({
        x: Math.round(r.left * (1 - e)),
        y: Math.round(r.top * (1 - e)),
        w: Math.round(r.width + (vw - r.width) * e),
        h: Math.round(r.height + (vh - r.height) * e),
      });
    }
    let i = 0;
    const tick = () => {
      i += 1;
      setFrames(boxes.slice(Math.max(0, i - 3), i));
      if (i < boxes.length) {
        window.setTimeout(tick, ZOOM_STEP_MS);
      } else {
        window.setTimeout(() => {
          setFrames([]);
          busy.current = false;
          window.location.hash = SIMULATION_HASH;
        }, ZOOM_STEP_MS * 2);
      }
    };
    tick();
  }, []);

  const overlay =
    frames.length > 0 ? (
      <div className="pz-zoom" aria-hidden>
        {frames.map((b, i) => (
          <span key={i} style={{ left: b.x, top: b.y, width: b.w, height: b.h }} />
        ))}
      </div>
    ) : null;

  return { launch, overlay };
}

export function SimulationButton({
  launch,
  variant = 'default',
}: {
  launch: (el: HTMLElement) => void;
  variant?: 'default' | 'menu';
}) {
  return (
    <a
      href={SIMULATION_HASH}
      className={variant === 'menu' ? 'pz-btn pz-btn-menu' : 'pz-btn pz-btn-default'}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        launch(e.currentTarget);
      }}
    >
      Simulation
    </a>
  );
}

interface MenuBarProps {
  mode: 'landing' | 'simulation' | 'deck';
  launch?: (el: HTMLElement) => void;
}

function homeHref(mode: MenuBarProps['mode']): string {
  switch (mode) {
    case 'deck':
      return '/';
    case 'landing':
    case 'simulation':
      return '#top';
    default: {
      const _never: never = mode;
      return _never;
    }
  }
}

export function MenuBar({ mode, launch }: MenuBarProps) {
  const home = homeHref(mode);
  return (
    <header className="pz-menubar">
      <a className="pz-brand" href={home} aria-label="PiezoLab, volver al inicio">
        <LogoMark />
        <span>PiezoLab</span>
      </a>
      {mode === 'deck' ? (
        <nav aria-label="Deck">
          <ul>
            <li>
              <a href={`/${SIMULATION_HASH}`}>Simulation</a>
            </li>
          </ul>
        </nav>
      ) : (
        <nav aria-label="Apartados">
          <ul>
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {mode === 'landing' && launch ? (
        <SimulationButton launch={launch} variant="menu" />
      ) : (
        <a className="pz-btn pz-btn-menu" href={home}>
          Inicio
        </a>
      )}
    </header>
  );
}
