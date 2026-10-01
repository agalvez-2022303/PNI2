# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Docente o jurado académico que abre el enlace desplegado para decidir si el modelo físico es riguroso y reproducible, antes de entrar al simulador.

## Product Purpose

PiezoLab es una aplicación web que simula la cosecha de energía piezoeléctrica con un modelo físico congelado. La landing, en español, explica el proyecto y ofrece un botón «Simulation» que abre el banco de trabajo ya existente. El éxito es que el jurado entienda qué se modela, por qué el resultado es auditable, y entre a la simulación sin que la herramienta cambie.

## Positioning

El modelo, los materiales, la geometría, el circuito y las excitaciones viven en un solo archivo (`frontend/src/core/referenceModel.ts`). Quien usa el simulador solo puede cambiar cuatro entradas. Cualquier cifra se puede contrastar con los casos de referencia P1–P12.

## Operating Context

Interfaz del simulador en español, unidades SI internas y prefijos en pantalla. La pantalla viva es el banco de trabajo de la baldosa de pisada (modo 33). La viga bimorfa y el informe siguen en el repositorio y no forman parte de la interfaz actual.

## Capabilities and Constraints

- Landing nueva, en español, que explica el proyecto y da más información (modelo, entradas, qué se puede comprobar).
- El botón principal se llama exactamente «Simulation» y abre el banco de trabajo actual.
- No modificar la interfaz, el estilo ni el comportamiento del simulador existente.
- No volver a enlazar la viga ni el informe.
- No hay destino de despliegue confirmado.
- No inventar institución, clientes, precios ni testimonios.

## Brand Commitments

- Nombre: PiezoLab.
- Idioma de la landing: español.
- Etiqueta del botón de entrada: Simulation.
- La voz del producto es técnica y precisa: magnitudes, casos de referencia y límites marcados como supuesto.

## Evidence on Hand

- Modelo congelado y ecuaciones descritos en `README.md` y en `frontend/src/core/`.
- Casos de referencia P1–P12 con valor calculado frente al esperado, cubiertos por pruebas en `tests/`.
- Banco de trabajo de la baldosa en `frontend/src/ui/cad/`.
- No hay fotografías del prototipo, nombre de institución, ni URL pública. No fabricarlas.

## Product Principles

- El jurado debe poder creer la rigurosidad sin entrar todavía al simulador.
- Toda cifra de la landing sale del modelo o de las pruebas; lo que no está medido se marca como tal.
- La landing no altera el simulador.
- La entrada a la herramienta es un solo acto: Simulation.
