/**
 * Landing de PiezoLab: un escritorio de un bit.
 *
 * La portada es un escritorio con ventanas superpuestas que se pueden traer al
 * frente, arrastrar y cerrar; los iconos las vuelven a abrir. Debajo, cada
 * apartado es una ventana más. «Simulation» abre el banco de trabajo con el
 * rectángulo de zoom del escritorio original. El apartado de equipo queda al
 * final, con los tres integrantes.
 */
import React, { useCallback, useEffect, useState } from 'react';
import './landing.css';
import { Window } from './Window';
import { TraceWindow } from './TraceWindow';
import { P5Chart } from './P5Chart';
import { AppIcon, ArrowDown, DocIcon, PersonIcon, StackIcon, TestsIcon, TraceIcon } from './PixelIcons';
import { CADENCE, FMAX, TP, fmt } from './physics';
import { CIRCUIT, PZT5A, PZT5A_DERIVED, STACK } from '../core/referenceModel';
import { MenuBar, SimulationButton, useLaunch } from './MenuBar';

export { SIMULATION_HASH } from './MenuBar';

type HeroWin = 'readme' | 'trace' | 'module';

interface DeskIconProps {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onOpen: () => void;
}

function DeskIcon({ label, icon, selected, onOpen }: DeskIconProps) {
  return (
    <li>
      <button type="button" className={`pz-deskicon ${selected ? 'is-selected' : ''}`} onClick={onOpen}>
        {icon}
        <span>{label}</span>
      </button>
    </li>
  );
}

export function Landing() {
  const { launch, overlay } = useLaunch();
  const [order, setOrder] = useState<HeroWin[]>(['trace', 'module', 'readme']);
  const [closed, setClosed] = useState<Set<HeroWin>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);

  const focus = useCallback((w: HeroWin) => {
    setOrder((o) => (o[o.length - 1] === w ? o : [...o.filter((x) => x !== w), w]));
  }, []);
  const open = (w: HeroWin) => {
    setClosed((c) => {
      const n = new Set(c);
      n.delete(w);
      return n;
    });
    focus(w);
    setSelected(w);
    if (!window.matchMedia('(min-width: 1100px)').matches) {
      window.requestAnimationFrame(() => document.getElementById(`w-${w}`)?.scrollIntoView({ block: 'start' }));
    }
  };
  const close = (w: HeroWin) => {
    setClosed((c) => new Set(c).add(w));
    setSelected(null);
  };

  const visible = order.filter((w) => !closed.has(w));
  const top = visible[visible.length - 1];
  const z = (w: HeroWin) => ({ zIndex: 10 + order.indexOf(w) });

  useEffect(() => {
    const root = document.documentElement;
    const prevTitle = document.title;
    root.classList.add('pz-landing');
    document.title = 'PiezoLab · cosecha de energía piezoeléctrica, cifra por cifra';
    if (window.location.hash && window.location.hash !== '#simulation') {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    }
    return () => {
      root.classList.remove('pz-landing');
      document.title = prevTitle;
    };
  }, []);

  return (
    <div className="pz-root">
      <a className="pz-skip" href="#contenido">
        Saltar al contenido
      </a>

      <MenuBar mode="landing" launch={launch} />

      <main id="contenido">
        <div className="pz-desktop" id="top">
          <ul className="pz-deskicons" aria-label="Ventanas del escritorio">
            <DeskIcon label="Léame" icon={<DocIcon />} selected={selected === 'readme'} onOpen={() => open('readme')} />
            <DeskIcon label="Pisada.trz" icon={<TraceIcon />} selected={selected === 'trace'} onOpen={() => open('trace')} />
            <DeskIcon label="Módulo" icon={<StackIcon />} selected={selected === 'module'} onOpen={() => open('module')} />
            <DeskIcon
              label="Pruebas"
              icon={<TestsIcon />}
              selected={selected === 'tests'}
              onOpen={() => {
                setSelected('tests');
                document.getElementById('pruebas')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
            <li>
              <a
                href="#simulation"
                className="pz-deskicon"
                onClick={(e) => {
                  e.preventDefault();
                  launch(e.currentTarget);
                }}
              >
                <AppIcon />
                <span>Simulation</span>
              </a>
            </li>
          </ul>

          <div className="pz-desk-left">
            {!closed.has('readme') && (
              <Window
                title="Léame"
                id="w-readme"
                className="pz-readme"
                as="article"
                active={top === 'readme'}
                onFocus={() => focus('readme')}
                onClose={() => close('readme')}
                draggable
                style={z('readme')}
                status={
                  <>
                    <span>modelo congelado</span>
                    <span>core/referenceModel.ts</span>
                  </>
                }
              >
                <h1 className="pz-h1">
                  Cada pisada,
                  <br />
                  con cifra.
                </h1>
                <p className="pz-lede">
                  PiezoLab simula cuánta energía entrega una baldosa piezoeléctrica cuando alguien la pisa. Material,
                  geometría y circuito viven en un solo archivo congelado: puedes cambiar la pisada, no la física.
                </p>
                <div className="pz-actions">
                  <SimulationButton launch={launch} />
                  <a className="pz-link" href="#cadena">
                    Ver cómo funciona <ArrowDown />
                  </a>
                </div>
              </Window>
            )}

            {!closed.has('module') && (
              <Window
                title="Módulo"
                id="w-module"
                className="pz-module"
                active={top === 'module'}
                onFocus={() => focus('module')}
                onClose={() => close('module')}
                draggable
                style={z('module')}
                status={<span>4 stacks en paralelo eléctrico</span>}
              >
                <dl className="pz-info">
                  <div>
                    <dt>Cerámico</dt>
                    <dd>PZT-5A</dd>
                  </div>
                  <div>
                    <dt>Stacks</dt>
                    <dd>{STACK.nStacks}</dd>
                  </div>
                  <div>
                    <dt>Discos por stack</dt>
                    <dd>{STACK.nLayers}</dd>
                  </div>
                  <div>
                    <dt>Disco</dt>
                    <dd>
                      Ø{STACK.diameterMm} × {fmt(STACK.layerThicknessMm, 1)} mm
                    </dd>
                  </div>
                  <div>
                    <dt>Altura del stack</dt>
                    <dd>{STACK.totalThicknessMm} mm</dd>
                  </div>
                  <div>
                    <dt>d33</dt>
                    <dd>{fmt(PZT5A.d33 * 1e12, 0)} pC/N</dd>
                  </div>
                </dl>
              </Window>
            )}
          </div>

          {!closed.has('trace') && (
            <TraceWindow
              active={top === 'trace'}
              onFocus={() => focus('trace')}
              onClose={() => close('trace')}
              style={z('trace')}
            />
          )}

          {visible.length === 0 && (
            <p className="pz-empty">Todas las ventanas están cerradas. Ábrelas desde los iconos.</p>
          )}
        </div>

        <div className="pz-flow">
          <Window title="Cadena.txt" id="cadena" className="pz-sec pz-sec-chain">
            <h2 className="pz-h2">De la pisada al LED</h2>
            <p className="pz-text">
              La fuerza del pie se reparte entre cuatro stacks de discos. Cada disco convierte la compresión en carga, y
              el circuito de cosecha la lleva a un condensador que enciende un LED. El simulador integra esa cadena en
              el tiempo y la mide en la última pisada del régimen estacionario, no en el arranque.
            </p>
            <ol className="pz-chain">
              <li>
                <span className="pz-node">Pisada</span>
                <span className="pz-eq">F(t) = F_max · sin²(πt/T_p)</span>
                <span className="pz-note">T_p = {fmt(TP, 1)} s</span>
              </li>
              <li>
                <span className="pz-node">Stack PZT-5A</span>
                <span className="pz-eq">i = n_stacks · n · d33 · dF/dt</span>
                <span className="pz-note">fuente de corriente en paralelo con C_p</span>
              </li>
              <li>
                <span className="pz-node">Puente {CIRCUIT.diodeModel}</span>
                <span className="pz-eq">
                  umbral {CIRCUIT.nDiodes} × {fmt(CIRCUIT.Vdiode, 1)} V
                </span>
                <span className="pz-note">ambas polaridades</span>
              </li>
              <li>
                <span className="pz-node">C_s</span>
                <span className="pz-eq">{fmt(CIRCUIT.Cs * 1e6, 0)} µF</span>
                <span className="pz-note">almacena la carga rectificada</span>
              </li>
              <li>
                <span className="pz-node">LED + R</span>
                <span className="pz-eq">
                  I = (V_c − {fmt(CIRCUIT.Vf, 1)} V) / {CIRCUIT.Rload} Ω
                </span>
                <span className="pz-note">solo mientras V_c &gt; V_f</span>
              </li>
            </ol>
            <p className="pz-small">
              Integración con Runge-Kutta 4 adaptativo y control de error por step-doubling, en un Web Worker para que
              la interfaz no se bloquee.
            </p>
          </Window>

          <Window title="Modelo — lista" id="modelo" className="pz-sec pz-sec-model">
            <h2 className="pz-h2">Lo que mueves y lo que no</h2>
            <p className="pz-text">
              Cualquier cifra del simulador se puede reproducir porque solo hay tres controles. Todo lo demás es el
              modelo de referencia, y se lee en un único archivo.
            </p>
            <div className="pz-split">
              <table className="pz-table">
                <caption>Entradas del banco de trabajo</caption>
                <thead>
                  <tr>
                    <th scope="col">Entrada</th>
                    <th scope="col">Rango</th>
                    <th scope="col">Defecto</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Fuerza pico F_max</th>
                    <td>
                      {fmt(FMAX.min, 0)}–{fmt(FMAX.max, 0)} N
                    </td>
                    <td>{fmt(FMAX.def, 0)} N</td>
                  </tr>
                  <tr>
                    <th scope="row">Cadencia</th>
                    <td>
                      {CADENCE.min}–{CADENCE.max} pasos/min
                    </td>
                    <td>{CADENCE.def}</td>
                  </tr>
                  <tr>
                    <th scope="row">Pisadas por corrida</th>
                    <td>1, 10 o 50</td>
                    <td>hasta régimen</td>
                  </tr>
                </tbody>
              </table>
              <table className="pz-table">
                <caption>Fijo en el modelo</caption>
                <thead>
                  <tr>
                    <th scope="col">Magnitud</th>
                    <th scope="col">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">d33 / d31</th>
                    <td>
                      {fmt(PZT5A.d33 * 1e12, 0)} / {fmt(PZT5A.d31 * 1e12, 0)} pC/N
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">k33² (calculado)</th>
                    <td>{fmt(PZT5A_DERIVED.k33Sq, 4)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Stacks</th>
                    <td>
                      {STACK.nStacks} × {STACK.nLayers} discos Ø{STACK.diameterMm} × {fmt(STACK.layerThicknessMm, 1)} mm
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Circuito</th>
                    <td>
                      {CIRCUIT.diodeModel}, C_s {fmt(CIRCUIT.Cs * 1e6, 0)} µF, R {CIRCUIT.Rload} Ω, LED {fmt(CIRCUIT.Vf, 1)} V
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Pulso</th>
                    <td>sin², T_p = {fmt(TP, 1)} s</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Window>

          <Window title="Pruebas P1–P12" id="pruebas" className="pz-sec pz-sec-tests">
            <h2 className="pz-h2">Contrastado con el enunciado</h2>
            <p className="pz-text">
              Los casos de referencia P1–P12 están escritos como pruebas Vitest en <code>tests/</code>. Cada fila
              compara el valor del enunciado con el que calcula el modelo.
            </p>
            <div className="pz-tests-grid">
              <table className="pz-table pz-table-tests">
                <caption>Selección de casos de la baldosa (modo 33)</caption>
                <thead>
                  <tr>
                    <th scope="col">Caso</th>
                    <th scope="col">Magnitud</th>
                    <th scope="col">Referencia</th>
                    <th scope="col">Modelo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">P1</th>
                    <td>C_p, disco Ø20 × 1 mm</td>
                    <td>4,73 nF</td>
                    <td>4,729 nF</td>
                  </tr>
                  <tr>
                    <th scope="row">P1</th>
                    <td>V_oc a 100&nbsp;N</td>
                    <td>7,9 V</td>
                    <td>7,909 V</td>
                  </tr>
                  <tr>
                    <th scope="row">P2</th>
                    <td>V_oc del módulo a 700&nbsp;N</td>
                    <td>43,3 V</td>
                    <td>43,254 V</td>
                  </tr>
                  <tr>
                    <th scope="row">P4</th>
                    <td>E_ideal · k33²</td>
                    <td>0,34 mJ · 0,49</td>
                    <td>0,3397 mJ · 0,4943</td>
                  </tr>
                  <tr>
                    <th scope="row">P6</th>
                    <td>E_LED por pisada a 700&nbsp;N</td>
                    <td>~50 µJ</td>
                    <td>48,22 µJ</td>
                  </tr>
                  <tr>
                    <th scope="row">P6</th>
                    <td>I_LED pico a 700&nbsp;N</td>
                    <td>~0,16 mA</td>
                    <td>0,1636 mA</td>
                  </tr>
                  <tr>
                    <th scope="row">P12</th>
                    <td>variación de E, dos últimas pisadas</td>
                    <td>&lt; 1 %</td>
                    <td>0,0029 %</td>
                  </tr>
                </tbody>
              </table>
              <div className="pz-p5-wrap">
                <h3 className="pz-h3">P5 · la energía no crece sin límite</h3>
                <p className="pz-small">
                  Con V_c fijo, la energía por pisada sube hasta 15 V (60,8 % de E_ideal) y luego cae.
                </p>
                <P5Chart />
              </div>
            </div>
            <p className="pz-small">
              Para reproducirlo: <code>cd tests &amp;&amp; yarn test</code>. El informe completo, con error relativo y
              tolerancia por línea, sale de <code>yarn report</code>.
            </p>
          </Window>

          <div className="pz-endrow">
            <Window title="Límites.txt" id="limites" className="pz-sec pz-sec-limits">
              <h2 className="pz-h2">Lo que el modelo asume</h2>
              <ul className="pz-list">
                <li>Modelo cuasiestático de discos idénticos, en serie mecánica y en paralelo eléctrico.</li>
                <li>
                  La energía al LED se mide en la última pisada estacionaria. ½·C_s·V_c² es un estado del condensador, no
                  un flujo comparable.
                </li>
                <li>
                  El límite de esfuerzo de 100 MPa y la tensión de trabajo de 100 V del condensador son supuestos de
                  alerta, no valores de catálogo.
                </li>
                <li>La deformación del visor 3D se exagera con un factor fijo: las reales son de micras.</li>
              </ul>
            </Window>

            <div className="pz-dialog-wrap">
              <Window title="Abrir" className="pz-dialog" as="div" labelledBy="pz-dialog-title">
                <div className="pz-dialog-body">
                  <AppIcon />
                  <div>
                    <h2 className="pz-h2" id="pz-dialog-title">
                      ¿Abrir el banco de trabajo?
                    </h2>
                    <p className="pz-text">
                      Entradas, visor 3D del módulo, circuito y balance de energía de la baldosa, con el mismo modelo que
                      acabas de leer.
                    </p>
                  </div>
                </div>
                <div className="pz-dialog-actions">
                  <a className="pz-btn" href="#top">
                    Volver arriba
                  </a>
                  <SimulationButton launch={launch} />
                </div>
              </Window>
            </div>
          </div>

          <Window title="Equipo.txt" id="equipo" className="pz-sec pz-sec-team">
            <h2 className="pz-h2">El equipo</h2>
            <p className="pz-text">Tres personas: liderazgo, robótica y software.</p>
            <ul className="pz-team">
              <li>
                <PersonIcon />
                <div>
                  <strong>Luis De León</strong>
                  <span>Team leader</span>
                </div>
              </li>
              <li>
                <PersonIcon />
                <div>
                  <strong>Alberto Galves</strong>
                  <span>Robotics development</span>
                </div>
              </li>
              <li>
                <PersonIcon />
                <div>
                  <strong>Gabriel Hurtarte</strong>
                  <span>Software development</span>
                </div>
              </li>
            </ul>
          </Window>
        </div>
      </main>

      <footer className="pz-footer">
        <p>
          PiezoLab · modelo de referencia en <code>frontend/src/core/referenceModel.ts</code>
        </p>
        <p>
          Erturk e Inman (2011) · IEEE Std 176-1987 · Williams y Yates (1996) · Roundy y Wright (2004) · nota técnica
          APC/PI de PZT-5A
        </p>
      </footer>

      {overlay}
    </div>
  );
}
