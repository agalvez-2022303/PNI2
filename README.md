# PiezoLab · Simulación 3D de Cosecha de Energía Piezoeléctrica

Aplicación web con **física rigurosa** para analizar dos cosechadores piezoeléctricos:
una **baldosa de pisada (modo 33)** y una **viga bimorfa en voladizo (modo 31)**.
Interfaz en español, unidades **SI** internamente y prefijos adecuados en pantalla (nJ, µW, mV…).

> El modelo físico está **congelado**. Materiales, geometría, circuito de cosecha y excitaciones
> viven en un único archivo (`frontend/src/core/referenceModel.ts`); el usuario solo puede
> modificar las cuatro entradas de la interfaz. Esto hace que cualquier resultado sea
> reproducible y auditable frente a los casos de referencia P1–P12.

---

## Stack técnico

- **React 19 + TypeScript** (Create React App / CRACO).
- **Three.js** (r186): render 3D con `OrbitControls`, sombras, materiales PBR, corte seccional
  y modo alambre.
- **Web Worker** para el solver (`src/workers/solver.worker.ts`): la interfaz nunca se bloquea,
  con *fallback* automático al hilo principal si el worker no está disponible.
- **IndexedDB** para las corridas guardadas (no se usa `localStorage`).
- **uPlot** para las gráficas en vivo y **Chart.js** para el reporte.
- **Vitest** para las pruebas del solver (proyecto aislado en `/app/tests`).

### Estructura modular

```
frontend/src/
├── core/     Física pura, sin UI: modelo de referencia, tile (33), beam (31),
│             circuito, cadena energética, RK4 adaptativo, unidades
├── sim/      Orquestación: tileSim, beamSim, tipos, defaults, cliente del worker,
│             persistencia IndexedDB
├── render/   Three.js: visor, modelo de baldosa, modelo de viga, import/export STL·glTF
├── ui/       Componentes React: paneles, visor, gráficas, reporte, PDF
└── workers/  Web Worker del solver
app/tests/    Pruebas Vitest que validan el solver contra los casos de referencia
```

---

## Cómo ejecutar

```bash
# Frontend (desarrollo)
cd frontend && yarn install && yarn start

# Build de producción
cd frontend && yarn build

# Pruebas del solver (proyecto aislado)
cd tests && yarn install && yarn test

# Informe P1–P12 con valor calculado frente al esperado del enunciado
cd tests && yarn report
```

El proyecto usa **yarn** en los dos subproyectos (`packageManager: yarn@1.22.22`); no se
mezclan gestores de paquetes.

Navegación por pestañas o por deep-link: `/#tile`, `/#beam`, `/#report`.

---

## Modelo de referencia (congelado)

Unidades SI. Fuente única: `core/referenceModel.ts`.

| Magnitud | Valor | Nota |
|---|---|---|
| Cerámico | **PZT-5A** (d33 = 374 pC/N, d31 = −171 pC/N, ρ = 7750 kg/m³) | catálogo APC/PI |
| Y33 / Y11 | 53.19 / 60.98 GPa | 1/s33E y 1/s11E, cada modo con su módulo |
| ε33^T / ε0 | 1700 | PZT-5A |
| k33² / k31² | 0.4943 / 0.1185 | **calculados**, nunca estimados |
| ε33^S | ε33^T (1 − k31²) | capacidad de la viga con ε^S, no ε^T |
| Stack de grada | 4 stacks × 60 discos Ø8 × 0.5 mm, T = 30 mm | mecánicamente en serie, eléctricamente en paralelo |
| Circuito | 1N4007 (Vd = 0.6 V, 2 diodos en conducción), Cs = 10 µF, R = 470 Ω, LED Vf = 1.8 V | |
| Pisada | F(t) = F_max·sin²(πt/T_p), T_p = 0.3 s | |
| Viga | L = 60 mm, b = 20 mm, t_s = 0.5 mm, 2 × t_p = 0.25 mm, M_t = 5 g, R_load = 68 kΩ | |

**Valores marcados [SUPUESTO]** (no proceden de fuente publicada ni del enunciado):

- `ζ_mec = 0.02` — amortiguamiento mecánico asumido para la viga.
- `σ_límite = 100 MPa` — criterio conservador de alerta de esfuerzo, no un límite de catálogo.
- `V_límite = 100 V` — tensión de trabajo del condensador de almacenamiento.

La masa modal efectiva que entra en la cota de Williams & Yates **no** es una constante del
modelo: se calcula en `core/beam.ts` como `modalEffectiveMass(model) = γ₁²`, con
`γ₁ = ∫₀ᴸ m'(x)·φ₁(x) dx + M_t·φ₁(L)` y la forma modal normalizada en masa. Da 10.326 g, un
0.04 % por debajo de los 10.33 g del enunciado.

### Entradas editables por el usuario

| Entrada | Rango | Defecto | Unidad |
|---|---|---|---|
| `Fmax` (fuerza pico del pisado) | 300 – 1000 | 700 | N |
| `cadence` | 60 – 120 | 100 | pasos/min |
| `a0` (aceleración de base, solo viga) | 0.5 – 5 | 2 | m/s² |
| `fExc` (frecuencia de excitación, solo viga) | 40 – 110 | 75 | Hz |

---

## Ecuaciones implementadas

### Simulación 1 — Baldosa de pisada (modo 33)

| Magnitud | Ecuación | Archivo |
|---|---|---|
| Carga | `Q = n · d33 · F` | `core/tile.ts` |
| Capacitancia del stack | `C_stack = n · ε33ᵀ · A / t_layer` | `core/tile.ts` |
| Capacitancia total | `C_total = n_stacks · C_stack` | `core/tile.ts` |
| Voltaje en circuito abierto | `V_oc = d33 · σ · t_layer / ε33ᵀ` | `core/tile.ts` |
| Energía por ciclo | `E = ½ · C · V_oc²` | `core/tile.ts` |
| Esfuerzo axial | `σ = F / (4·A)` | `core/tile.ts` |
| Cepa del disco | `S = σ · s33E`, `δ = S · T` | `core/tile.ts` |
| Acoplamiento a circuito abierto | `k33² = E_ideal / U_el` | `sim/tileSim.ts` |
| Altura constante (C7) | `t_layer = T/n` ⇒ `C_total ∝ n²`, `V_oc ∝ 1/n`, `E` constante | `core/tile.ts` |

**Circuito**: fuente de corriente piezo `i_s(t) = n_stacks · n · d33 · dF/dt` en paralelo con
`C_p`, puente rectificador (umbral 2·Vd = 1.2 V, evaluado en ambas polaridades) hacia un
condensador `Cs = 10 µF` con LED (Vf = 1.8 V) en serie con `R = 470 Ω`, de modo que
`I_LED = (Vc − Vf)/R` mientras `Vc > Vf` y 0 en caso contrario. Integración temporal con
**Runge-Kutta 4 adaptativo**
(`core/rk4.ts`, control de error por *step-doubling*).

El análisis se realiza sobre el **último pisada en régimen estacionario**, no sobre el transitorio.

### Simulación 2 — Viga bimorfa en voladizo (modo 31)

Modelo de **Euler-Bernoulli acoplado electromecánicamente** (Erturk & Inman, 2011), truncado a
los 3 primeros modos.

| Magnitud | Ecuación | Archivo |
|---|---|---|
| Sección compuesta | `ȳ = ΣA*·z / ΣA*`, `EI = Σ[b·t³/12 + A*·d²]` | `core/beam.ts` |
| Frecuencias naturales | cantilever con masa de punta; `ω_n = λ²√(EI/m'L⁴)` | `core/beam.ts` |
| Acoplamiento modo 31 | `k31² = d31² / (s11E · ε33ᵀ)` | `core/referenceModel.ts` |
| Capacidad del piezo | con `ε33^S = ε33ᵀ(1 − k31²)` | `core/beam.ts` |
| Equivalente SDOF | `f_n = (1/2π)√(k_eq/m_eq)`, `k_eq = 3EI/L³`, `m_eq = 0.2427·m'L + M_t` | `core/beam.ts` |
| Resistencia óptima | `R_opt = 1 / (ω_n · C_p)` | `core/beam.ts` |
| FRF (V, P) | modelo modal acoplado, `P = |V|²/(2R)` | `core/beam.ts` |
| Masa modal efectiva | `m₁ = γ₁²`, `γ₁ = ∫m'φ₁ dx + M_t·φ₁(L)` con `φ` normalizada en masa | `core/beam.ts` |
| Cota de potencia | `P_max = m₁·a0² / (16 · ζ_mec · ω_1)` (Williams-Yates) | `core/beam.ts` |
| Potencia mecánica disipada | `P = ⟨c·q̇²⟩ = ½·c·\|q\|²ω²`, con `c = 2ζω₁` (modal normalizada en masa) | `core/beam.ts` |

Con la modal normalizada en masa (`m_r = 1`) el amortiguador es `c = 2ζω₁`: **no lleva γ²**. En
resonancia la disipación mecánica vale `P = γ₁²a0²/(4ζω₁)`, y la relación clásica
`P_e,max = P/4` reproduce exactamente la cota de Williams-Yates `γ₁²a0²/(16ζω₁)`. Esa coherencia
entre P8 y P9b es la que fija el factor, y ambas cifras están verificadas contra la integración
temporal directa.

La respuesta temporal del modo dominante se integra con RK4 adaptativo (estado `[η, η̇, v]`) a la
frecuencia elegida por el usuario, no en el pico de la FRF. Los promedios de potencia (P9, P9b,
P9c) usan RK4 de paso fijo con 2000 muestras por ciclo, descartando 80 ciclos de transitorio y
promediando 20 ciclos completos, de modo que la ventana sea un número entero de periodos.

---

## Validación (pruebas Vitest)

**111 pruebas, todas en verde** (`units.test.ts` 16, `beam.test.ts` 36, `tile.test.ts` 59).

### Baldosa (modo 33) — PZT-5A

| Prueba | Magnitud | Referencia | Modelo |
|---|---|---|---|
| P1 | `C_p` (Ø20 × 1 mm, 100 N) | 4.73 nF | 4.729 nF |
| P1 | `Q` | 37.4 nC | 37.40 nC |
| P1 | `V_oc` | 7.9 V | 7.909 V |
| P1 | `E` | 148 nJ | 147.90 nJ |
| P2 | `C_stack` / `C_total` (700 N) | 90.8 / 363 nF | 90.79 / 363.2 nF |
| P2 | `V_oc` (700 N) | 43.3 V | 43.254 V |
| P3 | `U_el` | 0.69 mJ | 0.6873 mJ |
| P4 | `E_ideal`, `k33²` | 0.34 mJ, 0.49 | 0.3397 mJ, 0.4943 |
| P4 | `σ`, `S`, `δ` | 3.48 MPa, 6.5e-5, 1.96 µm | 3.4815 MPa, 6.545e-5, 1.9636 µm |

**P5** — energía por pisada con `V_c` fijo y `C_s` muy grande (tolerancia 3 %):

| `V_c` | 2 V | 5 V | 10 V | 15 V | 20 V | 35 V |
|---|---|---|---|---|---|---|
| Referencia | 55.9 | 123 | 192 | 206 | 166 | 89.7 µJ |
| Modelo | 55.86 | 123.31 | 192.13 | 206.48 | 166.34 | 89.63 µJ |

El máximo está en `V_c = 15 V` y vale 60.78 % de `E_ideal` (referencia 60.8 %); por encima la
energía **decrece**, así que `E` no es monótona en `V_c`.

### Viga (modo 31) — PZT-5A + latón

| Prueba | Magnitud | Referencia | Modelo |
|---|---|---|---|
| P7 | `EI` | — | 0.10976 N·m² |
| P7 | `f_1` / `f_SDOF` | — | 72.633 / 72.401 Hz |
| P7 | `k_eq`, `m_eq` | — | 1524.4 N/m, 7.366 g |
| P7 | `C_p` (con ε^S) | — | 31.845 nF |
| P7 | `R_opt` | — | 68.81 kΩ |
| P8 | `m₁ = γ₁²` (masa modal del modo 1) | 10.33 g | 10.3258 g |
| P8 | `P_bound` (Williams-Yates) | 282.9 µW | 282.83 µW |
| P9 | potencia eléctrica: FRF `\|V\|²/(2R)` vs `⟨v²/R⟩` temporal | < 2 % | 228.71 vs 229.84 µW (0.49 %) |
| P9b | potencia mecánica: FRF vs integración temporal | < 2 % | 1131.32 vs 1130.88 µW (0.04 %) |
| P9c | balance `P_in = P_mec + P_elec` en régimen | < 2 % | 476.64 = 246.80 + 229.84 µW (0.0000 %) |
| P10 | RK4: convergencia y orden | orden 4 | comprobado con *step-doubling* |

### Circuito y estabilidad (P6, P12)

| Prueba | Magnitud | Referencia | Modelo |
|---|---|---|---|
| P6 | `E_LED` por pisada a 700 N | ~50 µJ | 48.22 µJ |
| P6 | `E_LED` por pisada a 400 N | ~25 µJ | 24.35 µJ |
| P6 | `I_LED` pico a 700 N | ~0.16 mA | 0.1636 mA |
| P6 | `V_c` en régimen estacionario | 1.85 – 1.88 V | pico 1.8769, min 1.8000, medio 1.8210 V |
| P12 | pasos hasta régimen estacionario | > 1 | 3 |
| P12 | variación relativa de `E` en los dos últimos pasos | < 1 % | 0.0029 % |
| P11 | conservación de la energía | 100 combinaciones | 100/100 |

`E_LED` se mide sobre el **último pisada estacionario**, no sobre el transitorio de arranque.

El informe completo con valor calculado frente al esperado, error relativo y tolerancia de cada
línea se genera con `cd tests && yarn report` (script `tests/p1_p12.report.mts`).

---

## Persistencia y exportaciones

- **IndexedDB**: botón *Guardar corrida* almacena entradas + resultado. Sin `localStorage`.
- **Exportar** el archivo completo de corridas a JSON e **Importar** para restaurarlas.
- **Reporte**: PDF (`jspdf`) con fórmulas, magnitudes y tablas; CSV e JSON de resultados por
  escenario; exportación **STL** de la geometría 3D.
- **Importar carcasa** STL / glTF / GLB como escena decorativa semitransparente.
- Vistas: perspectiva, ortogonal, corte seccional, modo alambre.
- **3D sin excitación falsa**: la deformación se aplica con un factor de exageración fijo y
  visible, y el color de cada disco refleja el **esfuerzo real** (no una animación decorativa).
  El stack se dibuja completo, sin huecos, y los electrodos no engrosan la altura.

---

## Limitaciones del modelo

- **Baldosa**: modelo cuasiestático de discos idénticos en serie mecánica y paralelo eléctrico.
  La eficiencia a circuito abierto es exactamente `k33²`; la eficiencia con harvested
  incluye las pérdidas del puente, del LED y de la carga.
- **Cadena energética (C11)**: los eslabones se comparan como **flujos de energía del último
  pisada estacionario**:
  - `E_stored = E_LED + E_R` (lo que entra al nodo de salida menos lo consumido allí).
  - `E_extracted = E_stored + E_bridgeLoss`.
  - `½·Cs·Vc²` es el **estado instantáneo** del condensador, no un eslabón comparable con un flujo.
  - `V_oc` y `Vc` se reportan con su **pico**; el rizado se calcula como `pico − mínimo`.
- **Viga**: se desprecia la inercia rotatoria de la masa de punta; acoplamiento lineal
  (pequeñas deformaciones). La `P_max` de Williams-Yates es una **cota superior** que supone
  amortiguamiento óptimo, por lo que el modelo FRF queda por debajo (cosechador subacoplado),
  lo cual es físicamente correcto.
- Las deformaciones 3D se **exageran** con un factor fijo y visible; las deformaciones reales
  son de micras.

---

## Bibliografía

- Erturk, A. & Inman, D. J. (2011). *Piezoelectric Energy Harvesting*. Wiley.
- IEEE Std 176-1987. *IEEE Standard on Piezoelectricity*.
- Williams, C. B. & Yates, R. B. (1996). *Analysis of a micro-electric generator for microsystems*.
  J. Sound & Vibration 176(4).
- Roundy, S. & Wright, P. K. (2004). *A piezoelectric vibration based generator for wireless electronics*.
- APC / PI Technical Note: PZT-5A material properties.
