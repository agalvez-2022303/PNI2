# PiezoLab · Simulación 3D de Cosecha de Energía Piezoeléctrica

Aplicación web tipo CAD con **física rigurosa** para el diseño y análisis de dos cosechadores
piezoeléctricos: una **baldosa de pisada (modo 33)** y una **viga bimorfa en voladizo (modo 31)**.
Toda la interfaz está en español y las unidades se manejan en **SI** internamente, mostrándose
con prefijos adecuados (nJ, µW, mV…).

> Construida para una defensa ante jurado de ingeniería: cada resultado incluye la **fórmula usada**
> (tooltip ƒ) y se muestran **siempre** el valor teórico y el realista con pérdidas.

---

## Stack técnico

- **React 18 + TypeScript** (Create React App / CRACO).
- **Three.js** (r186): renderizado 3D real, `OrbitControls`, sombras, materiales PBR, corte
  seccional y modo alambre.
- **Web Worker** para el solver (`src/workers/solver.worker.ts`): la UI nunca se bloquea (con
  fallback automático al hilo principal si el worker no está disponible).
- **uPlot** para gráficas en tiempo real y **Chart.js** para el reporte imprimible.
- **Vitest** para las pruebas unitarias del solver (proyecto aislado en `/app/tests`).

### Estructura modular

```
frontend/src/
├── core/     Física pura (sin UI): materiales, tile (33), beam (31), circuito, RK4, unidades
├── sim/      Escenarios: orquestación tile/beam, tipos, defaults, cliente del worker
├── render/   Three.js: visor, modelo de baldosa, modelo de viga, import/export STL·glTF
├── ui/       Componentes React: paneles, visor, gráficas, editor CAD, materiales, reporte
└── workers/  Web Worker del solver
/app/tests/   Pruebas Vitest que validan el solver contra los valores de referencia
```

---

## Cómo ejecutar

La app corre automáticamente (supervisor) en el puerto 3000.

```bash
# Frontend (dev)
cd frontend && yarn install && yarn start

# Pruebas del solver (proyecto aislado)
cd tests && yarn install && yarn test
```

Navegación por pestañas o por deep-link: `/#tile`, `/#beam`, `/#cad`, `/#materials`, `/#report`.

---

## Ecuaciones implementadas

### Simulación 1 — Baldosa de pisada (modo 33)
Stack de N discos, **mecánicamente en serie** y **eléctricamente en paralelo**.

| Magnitud | Ecuación | Archivo |
|---|---|---|
| Carga | `Q = n · d33 · F` | `core/tile.ts` |
| Capacitancia | `C_p = n · ε33ᵀ · A / t` | `core/tile.ts` |
| Voltaje circuito abierto | `V_oc = Q / C_p = d33 · t · F / (ε33ᵀ · A)` | `core/tile.ts` |
| Energía por ciclo | `E = ½ · C_p · V_oc²` | `core/tile.ts` |
| Fuerza de pisada | `F(t) = F_max · sin²(π t / T)`, `T = 0.3 s` | `core/tile.ts` |
| Energía de deformación pico | `U = ½ · F_max² · n · t / (Y · A)` | `core/tile.ts` |
| Acoplamiento efectivo | `k²ₑ = d33² · Y / ε33ᵀ` (= η a circuito abierto) | `sim/tileSim.ts` |

**Circuito**: fuente de corriente piezo `i_s(t) = n·d33·dF/dt` en paralelo con `C_p`, puente
rectificador (caída configurable, 0.7 V/diodo por defecto) hacia un condensador de almacenamiento
`C_s` con carga `R_load`. Se integra en el tiempo con **Runge-Kutta 4 de paso adaptativo**
(`core/rk4.ts`, control de error por *step-doubling*).

### Simulación 2 — Viga bimorfa en voladizo (modo 31)
Modelo de **Euler-Bernoulli acoplado electromecánicamente** (Erturk & Inman, 2011), truncado a los
3 primeros modos.

| Magnitud | Ecuación | Archivo |
|---|---|---|
| Sección compuesta (eje neutro, EI) | `ȳ = ΣA*·z / ΣA*`, `EI = E_ref·Σ[b*t³/12 + A*·d²]` | `core/beam.ts` |
| Frecuencias naturales | ec. de frecuencias del voladizo con masa de punta; `ω_n = λ²√(EI/m'L⁴)` | `core/beam.ts` |
| Equivalente SDOF | `f_n = (1/2π)·√(k_eq/m_eq)`, `k_eq=3EI/L³`, `m_eq=0.2427·m'L + M_t` | `core/beam.ts` |
| Resistencia óptima | `R_opt ≈ 1 / (ω_n · C_p)` | `core/beam.ts` |
| FRF (V, P) | modelo modal acoplado; `P = |V|²/(2R)` | `core/beam.ts` |
| Cota de potencia | `P_max = m · a² / (8 · ζ_T · ω_n)` (Williams-Yates) | `core/beam.ts` |

La respuesta en el tiempo del modo dominante se integra con RK4 adaptativo (estado `[η, η̇, v]`).

---

## Validación (pruebas Vitest)

Casos de referencia del enunciado, reproducidos con **error < 1 %**:

**Baldosa** — PZT-5A, disco Ø20 mm, 1 mm, F = 100 N:

| Magnitud | Referencia | Modelo |
|---|---|---|
| C_p | 4.73 nF | 4.729 nF |
| Q | 37.4 nC | 37.4 nC |
| V_oc | 7.9 V | 7.91 V |
| E | 148 nJ | 147.9 nJ |

**Viga** — m = 5 g, a = 2 m/s², ζ_T = 0.03, f_n = 50 Hz:

| Magnitud | Referencia | Modelo |
|---|---|---|
| P_max (Williams-Yates) | 265 µW | 265.3 µW |

Otras pruebas: consistencia `V_oc = Q/C_p`, independencia de `V_oc` con N, autovalores del voladizo
(1.8751, 4.694, 7.855), efecto de la masa de punta, coincidencia distribuido↔SDOF (<5 %), integrador
RK4 (dy/dt=y ⇒ e; oscilador armónico).

```bash
cd tests && yarn test    # 23/23 ✓
```

---

## Editor CAD y exportaciones

- Edición de geometría en vivo (largo, ancho, espesor de cada capa, número de capas, masa de punta).
- Vistas: **perspectiva, ortogonal, corte seccional, modo alambre**.
- Importar **STL / glTF / GLB** como carcasa decorativa (semitransparente).
- Exportar geometría a **STL** y resultados a **CSV** y **JSON**.
- Base de datos de materiales **editable** (persiste en el navegador) e importable/exportable.

---

## Honestidad de los resultados y limitaciones del modelo

- Se muestran **siempre** el valor teórico y el realista con pérdidas; la energía **no se exagera**.
- **Baldosa**: modelo cuasiestático, discos idénticos en serie mecánica/paralelo eléctrico. La
  eficiencia de conversión a circuito abierto es exactamente el acoplamiento efectivo `k²ₑ`; la
  eficiencia realista incluye las pérdidas del rectificador y de la carga.
- **Viga**: se desprecia la inercia rotatoria de la masa de punta; acoplamiento electromecánico
  lineal (pequeñas deformaciones); la `P_max` de Williams-Yates es una **cota superior** que supone
  amortiguamiento óptimo — el modelo FRF suele quedar por debajo (cosechador subacoplado), lo cual
  es físicamente correcto.
- La deformación 3D está **exagerada** mediante un factor de escala ajustable (las deformaciones
  reales son de micras).

---

## Bibliografía

- Erturk, A. & Inman, D. J. (2011). *Piezoelectric Energy Harvesting*. John Wiley & Sons.
- IEEE Std 176-1987. *IEEE Standard on Piezoelectricity*.
- Williams, C. B. & Yates, R. B. (1996). *Analysis of a micro-electric generator for microsystems*.
- Roundy, S. & Wright, P. K. (2004). *A piezoelectric vibration based generator for wireless electronics*.
