/**
 * Presentación a pantalla completa sobre el escritorio de un bit.
 * `/deck` gana sobre `#simulation`. Cada slide es una ventana.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { MenuBar } from '../landing/MenuBar';
import { Window } from '../landing/Window';
import './deck.css';
import { getSlides } from './slides';

const SLIDES = getSlides();

function isPrintQuery(): boolean {
  return new URLSearchParams(window.location.search).has('print');
}

export function Deck() {
  const last = SLIDES.length - 1;
  const [index, setIndex] = useState(0);
  const [print] = useState(isPrintQuery);
  const slide = SLIDES[index];

  const go = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(last, next)));
    },
    [last],
  );

  useEffect(() => {
    const root = document.documentElement;
    const prevTitle = document.title;
    root.classList.add('pz-landing');
    document.title = print ? 'PiezoLab · deck · imprimir' : 'PiezoLab · deck';
    if (print) root.classList.add('pz-deck-print-root');
    return () => {
      root.classList.remove('pz-landing');
      root.classList.remove('pz-deck-print-root');
      document.title = prevTitle;
    };
  }, [print]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          go(index + 1);
          break;
        case 'ArrowLeft':
        case 'PageUp':
        case 'Backspace':
          e.preventDefault();
          go(index - 1);
          break;
        case 'Home':
          e.preventDefault();
          go(0);
          break;
        case 'End':
          e.preventDefault();
          go(last);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, last]);

  if (print) {
    return (
      <div className="pz-root pz-deck pz-deck-print">
        {SLIDES.map((s, i) => (
          <div className="pz-deck-sheet" key={`${s.title}-${i}`}>
            <div className="pz-deck-frame">
              <Window
                title={s.title}
                className="pz-deck-win"
                status={
                  <span>
                    {i + 1} / {SLIDES.length}
                  </span>
                }
              >
                {s.body}
              </Window>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="pz-root pz-deck">
      <MenuBar mode="deck" />
      <div className="pz-deck-stage">
        <button
          type="button"
          className="pz-deck-hit pz-deck-hit-prev"
          disabled={index === 0}
          onClick={() => go(index - 1)}
          aria-label="Diapositiva anterior"
        />
        <div className="pz-deck-frame">
          <Window
            title={slide.title}
            className="pz-deck-win"
            status={
              <>
                <span>
                  {index + 1} / {SLIDES.length}
                </span>
                <span>← →</span>
              </>
            }
          >
            {slide.body}
            <div className="pz-deck-nav">
              <button type="button" className="pz-btn" disabled={index === 0} onClick={() => go(index - 1)}>
                Anterior
              </button>
              <button type="button" className="pz-btn pz-btn-default" disabled={index === last} onClick={() => go(index + 1)}>
                Siguiente
              </button>
            </div>
          </Window>
        </div>
        <button
          type="button"
          className="pz-deck-hit pz-deck-hit-next"
          disabled={index === last}
          onClick={() => go(index + 1)}
          aria-label="Diapositiva siguiente"
        />
      </div>
    </div>
  );
}
