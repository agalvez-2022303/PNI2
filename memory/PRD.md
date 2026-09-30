# PRD · PiezoLab — Simulación 3D de Cosecha Piezoeléctrica

## Problema original (verbatim, resumido)
App web de simulación 3D tipo CAD con física rigurosa para un proyecto de piezoeléctricos (premios de
ingeniería). Interfaz 100% en español. Dos simulaciones: (1) Baldosa de pisada modo 33 con circuito
rectificador integrado por RK4; (2) Viga bimorfa en voladizo modo 31 (Erturk-Inman, 3 modos). Editor
CAD mínimo, base de materiales editable, pestaña de Reporte. SI internamente con prefijos. Honestidad:
mostrar siempre valor teórico y realista. README con ecuaciones, limitaciones y bibliografía. Tests
que validen el solver contra valores de referencia.

## Decisiones del usuario
- Stack: React (CRA) + TypeScript + Three.js (no Vite, adaptado al entorno de la plataforma).
- Gráficas: uPlot (tiempo real) + Chart.js (reporte).
- Persistencia: local (localStorage + export/import JSON), sin backend.
- Entrega: 4 fases construidas de una vez, con tests mostrados al final.
- Importación STL/glTF: solo carga por el usuario.

## Arquitectura
- Frontend CRA/CRACO en :3000. Backend FastAPI presente pero **no usado** (app 100% cliente).
- Módulos: `core/` (física pura), `sim/` (escenarios + worker client), `render/` (Three.js),
  `ui/` (React), `workers/` (Web Worker del solver). Tests Vitest aislados en `/app/tests`.
- Navegación por pestañas y deep-link por hash (#tile/#beam/#cad/#materials/#report) con listener hashchange.

## Personas
- Estudiante/ingeniero que presenta el proyecto ante un jurado (necesita fórmulas visibles y honestidad).
- Evaluador/jurado que revisa resultados, ecuaciones y reporte imprimible.

## Requisitos núcleo (estáticos)
- Física correcta modo 33 y modo 31; unidades SI; sin números mágicos (config/defaults).
- Web Worker no bloqueante; RK4 de paso adaptativo.
- Visor 3D real con sombras/PBR, 4 vistas, deformación exagerada configurable, mapa de calor de esfuerzo.
- Editor CAD, exportación STL/CSV/JSON, base de materiales editable, reporte imprimible.
- Tests que reproduzcan los valores de referencia con error < 1%.

## Implementado (2026-06) — MVP completo, 4 fases
- Fase 1: estructura modular, base de materiales, solver analítico + circuito RK4, **23/23 tests Vitest**
  (Cp≈4.73nF, Q≈37.4nC, Voc≈7.9V, E≈148nJ; Williams-Yates Pmax≈265µW; autovalores voladizo; RK4).
- Fase 2: visor 3D (Three.js) + Simulación 1 completa (baldosa, circuito, caminata, gráficas, η teórica/realista).
- Fase 3: Simulación 2 completa (viga bimorfa, transformación de secciones, 3 modos, FRF, P-vs-R, P-vs-masa, V(t)/P(t), formas modales animadas).
- Fase 4: Editor CAD (geometría en vivo, 4 vistas, import STL/glTF, export STL/CSV/JSON), Materiales editables, Reporte (Chart.js + imprimir/PDF), comparación de configuraciones.
- Validado por testing agent: 100% de funcionalidades de UI (5 pestañas, 3D, sliders reactivos, exports, persistencia).

## Mejoras (2026-06) — 4 mejoras solicitadas, completadas y validadas
- Reporte PDF descargable con gráficas embebidas (jsPDF + Chart.js) → `src/ui/pdf.ts`, botón en ReportTab (informe_piezolab.pdf ~2.3MB).
- Marca visual de R_opt (línea vertical punteada + etiqueta) sobre la gráfica Potencia vs R_load → `vLinePlugin` en `UPlotChart.tsx` usado en `BeamSim.tsx`.
- Barrido de frecuencia animado sincronizado con la deformada 3D de la viga (HUD en vivo: Barrido f / P instantánea; amplitud 3D modulada por P(f)) → efecto de barrido en `BeamSim.tsx` + `beamDriveRef` en `Viewer3D.tsx`.
- Guardar/abrir proyecto completo (JSON con materiales + geometría tile/beam) desde la barra superior → `saveProject`/`loadProject` en `App.tsx`.
- Fix crash Viga: uPlot `redraw()` omitía `convergeSize()` → `axis._found` null en `drawAxesGrid`. Corregido pasando `recalcAxes=true` (`plot.redraw(true, true)`) en `UPlotChart.tsx`.
- Validado: 23/23 Vitest verdes + testing_agent frontend 13/13 (iteration_2.json).

## Backlog (futuro)
- P2: soporte de conexión piezo serie/paralelo seleccionable en la viga.
- P2: incluir resultados numéricos (además de geometría/materiales) en el JSON de proyecto y en el PDF.
- P3: eje X logarítmico opcional en la FRF para visualizar mejor el pico de resonancia estrecho.

## Próximas tareas sugeridas
- Ver "Next Action Items" del resumen de finish.
