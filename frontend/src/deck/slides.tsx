/**
 * Las quince diapositivas del deck. Cifras del modelo de referencia y de la
 * landing; ninguna fuente bibliográfica.
 */
import React from 'react';
import { CIRCUIT, PZT5A, PZT5A_DERIVED, STACK } from '../core/referenceModel';
import { P5Chart } from '../landing/P5Chart';
import { AppIcon, PersonIcon } from '../landing/PixelIcons';
import { CADENCE, FMAX, TP, fmt } from '../landing/physics';
import { QrMark } from './QrMark';

/** Landing pública. El QR de anexos apunta aquí, no al host local. */
export const WEB_HREF = 'https://piezolab.ldeleon.com/';

export interface Slide {
  title: string;
  body: React.ReactNode;
}

export function getSlides(): Slide[] {
  return [
    {
      title: 'Portada',
      body: (
        <>
          <h1 className="pz-h1">
            Cada pisada,
            <br />
            con cifra.
          </h1>
          <p className="pz-lede">
            PiezoLab simula cuánta energía entrega una baldosa piezoeléctrica cuando alguien la pisa. Material,
            geometría y circuito viven en un solo archivo congelado: puedes cambiar la pisada, no la física.
          </p>
        </>
      ),
    },
    {
      title: 'Pregunta',
      body: (
        <>
          <h2 className="pz-h2">La pregunta</h2>
          <p className="pz-lede">
            ¿Cuánta energía entrega una baldosa piezoeléctrica al LED por cada pisada, y se puede auditar esa cifra?
          </p>
          <p className="pz-text">
            El jurado tiene que poder creerlo antes de abrir el banco de trabajo. El modelo está congelado; las pruebas
            P1–P12 contrastan cada magnitud con el enunciado.
          </p>
        </>
      ),
    },
    {
      title: 'Qué es',
      body: (
        <>
          <h2 className="pz-h2">Qué es y qué no es</h2>
          <div className="pz-deck-split">
            <ul className="pz-list">
              <li>Aplicación web con física rigurosa: baldosa de pisada, modo 33.</li>
              <li>
                Fuente única en <code>frontend/src/core/referenceModel.ts</code>.
              </li>
              <li>Cualquier cifra se reproduce frente a los casos P1–P12.</li>
            </ul>
            <ul className="pz-list">
              <li>No es un prototipo físico ni una animación decorativa.</li>
              <li>No es un producto comercial: no hay precio, clientes ni institución inventada.</li>
              <li>El visor 3D exagera micras; el color es esfuerzo real.</li>
            </ul>
          </div>
        </>
      ),
    },
    {
      title: 'Módulo',
      body: (
        <>
          <h2 className="pz-h2">El módulo</h2>
          <dl className="pz-info">
            <div>
              <dt>Cerámico</dt>
              <dd>PZT-5A</dd>
            </div>
            <div>
              <dt>d33</dt>
              <dd>{fmt(PZT5A.d33 * 1e12, 0)} pC/N</dd>
            </div>
            <div>
              <dt>Stacks</dt>
              <dd>
                {STACK.nStacks} × {STACK.nLayers} discos Ø{STACK.diameterMm} × {fmt(STACK.layerThicknessMm, 1)} mm
              </dd>
            </div>
            <div>
              <dt>Altura del stack</dt>
              <dd>{STACK.totalThicknessMm} mm</dd>
            </div>
            <div>
              <dt>Circuito</dt>
              <dd>
                {CIRCUIT.diodeModel}, C_s {fmt(CIRCUIT.Cs * 1e6, 0)} µF, R {CIRCUIT.Rload} Ω, LED {fmt(CIRCUIT.Vf, 1)} V
              </dd>
            </div>
            <div>
              <dt>Pisada</dt>
              <dd>
                F(t) = F_max · sin²(πt/T_p), T_p = {fmt(TP, 1)} s
              </dd>
            </div>
          </dl>
        </>
      ),
    },
    {
      title: 'Cadena.txt',
      body: (
        <>
          <h2 className="pz-h2">De la pisada al LED</h2>
          <p className="pz-text">
            El simulador integra la cadena en el tiempo y la mide en la última pisada del régimen estacionario, no en el
            arranque.
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
        </>
      ),
    },
    {
      title: 'Modelo — lista',
      body: (
        <>
          <h2 className="pz-h2">Lo que mueves y lo que no</h2>
          <p className="pz-text">
            Cualquier cifra se puede reproducir porque solo hay tres controles. Todo lo demás se lee en un único archivo.
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
                    {CIRCUIT.diodeModel}, C_s {fmt(CIRCUIT.Cs * 1e6, 0)} µF, R {CIRCUIT.Rload} Ω
                  </td>
                </tr>
                <tr>
                  <th scope="row">Pulso</th>
                  <td>sin², T_p = {fmt(TP, 1)} s</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ),
    },
    {
      title: 'Física',
      body: (
        <>
          <h2 className="pz-h2">Tres ecuaciones</h2>
          <ul className="pz-deck-eqs">
            <li>
              <span className="pz-eq">Q = n · d33 · F</span>
              <span className="pz-note">carga del stack</span>
            </li>
            <li>
              <span className="pz-eq">V_oc = d33 · σ · t_layer / ε33ᵀ</span>
              <span className="pz-note">voltaje en circuito abierto</span>
            </li>
            <li>
              <span className="pz-eq">E = ½ · C · V_oc²</span>
              <span className="pz-note">energía ideal por ciclo</span>
            </li>
          </ul>
          <p className="pz-small">
            El circuito se integra con Runge-Kutta 4 adaptativo y control de error por step-doubling, en un Web Worker
            para que la interfaz no se bloquee.
          </p>
        </>
      ),
    },
    {
      title: 'P1–P12',
      body: (
        <>
          <h2 className="pz-h2">Contrastado con el enunciado</h2>
          <p className="pz-text">111 pruebas Vitest. Cada fila compara el valor del enunciado con el del modelo.</p>
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
                <th scope="row">P12</th>
                <td>variación de E, dos últimas pisadas</td>
                <td>&lt; 1 %</td>
                <td>0,0029 %</td>
              </tr>
            </tbody>
          </table>
        </>
      ),
    },
    {
      title: 'P5',
      body: (
        <>
          <h2 className="pz-h2">P5 · la energía no crece sin límite</h2>
          <p className="pz-text">
            Con V_c fijo, la energía por pisada sube hasta 15 V (60,8 % de E_ideal) y luego cae.
          </p>
          <P5Chart />
        </>
      ),
    },
    {
      title: 'Reproducir',
      body: (
        <>
          <h2 className="pz-h2">Cómo se reproduce</h2>
          <ul className="pz-list">
            <li>
              Pruebas del solver: <code>cd tests && yarn test</code>
            </li>
            <li>
              Informe calculado frente a esperado: <code>yarn report</code>
            </li>
            <li>Unidades SI internas; prefijos en pantalla (nJ, µW, mV).</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Abrir',
      body: (
        <div className="pz-dialog-body">
          <AppIcon />
          <div>
            <h2 className="pz-h2">La herramienta</h2>
            <p className="pz-text">
              Entradas, visor 3D del módulo, circuito y balance de energía de la baldosa, con el mismo modelo que acaba
              de leerse. Un solo acto: Simulation.
            </p>
            <p className="pz-small">Cambia F_max y mira E_LED y el balance. La física no se mueve.</p>
          </div>
        </div>
      ),
    },
    {
      title: 'Límites.txt',
      body: (
        <>
          <h2 className="pz-h2">Lo que el modelo asume</h2>
          <ul className="pz-list">
            <li>Modelo cuasiestático de discos idénticos, en serie mecánica y en paralelo eléctrico.</li>
            <li>
              La energía al LED se mide en la última pisada estacionaria. ½·C_s·V_c² es un estado del condensador, no un
              flujo comparable.
            </li>
            <li>
              El límite de esfuerzo de 100 MPa y la tensión de trabajo de 100 V del condensador son supuestos de alerta,
              no valores de catálogo.
            </li>
            <li>La deformación del visor 3D se exagera con un factor fijo: las reales son de micras.</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Aportes',
      body: (
        <>
          <h2 className="pz-h2">Tres aportes</h2>
          <ul className="pz-list">
            <li>Modelo congelado y auditable: un archivo, cuatro entradas.</li>
            <li>Cadena pisada → LED integrada en el tiempo, medida en régimen.</li>
            <li>Casos P1–P12 como contrato con el enunciado.</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Equipo.txt',
      body: (
        <>
          <h2 className="pz-h2">El equipo</h2>
          <p className="pz-text">
            Somos tres. Los nombres, roles y biografías se publicarán aquí cuando el equipo envíe la información.
          </p>
          <ul className="pz-team">
            <li>
              <PersonIcon />
              <div>
                <strong>Integrante 1</strong>
                <span>Perfil pendiente</span>
              </div>
            </li>
            <li>
              <PersonIcon />
              <div>
                <strong>Integrante 2</strong>
                <span>Perfil pendiente</span>
              </div>
            </li>
            <li>
              <PersonIcon />
              <div>
                <strong>Integrante 3</strong>
                <span>Perfil pendiente</span>
              </div>
            </li>
          </ul>
        </>
      ),
    },
    {
      title: 'Anexos.txt',
      body: (
        <>
          <h2 className="pz-h2">Anexos ya enviados</h2>
          <p className="pz-text">
            Estos documentos van con el expediente. No están dentro del deck; el QR abre la web.
          </p>
          <div className="pz-deck-annex">
            <ul className="pz-deck-docs">
              <li>
                Reporte
                <span>enviado</span>
              </li>
              <li>
                Presupuesto
                <span>enviado</span>
              </li>
              <li>
                Plan de implementación
                <span>enviado</span>
              </li>
              <li>
                CAD del proyecto
                <span>enviado</span>
              </li>
            </ul>
            <div>
              <QrMark href={WEB_HREF} label="Código QR a la landing de PiezoLab" />
              <a className="pz-link" href={WEB_HREF}>
                Abrir la web
              </a>
            </div>
          </div>
        </>
      ),
    },
  ];
}
