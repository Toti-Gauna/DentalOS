# Especificación SDD · DentalOS (mejora L1–L10)

Base: `main` @ `73c5e75`. Rama de trabajo del lote 1: `feat/dentalos-l1-diagnostico`.
Origen: auditoría del 17/10/2026 (ficha de Notion “DentalOS — Cuatro prompts FE…”) y prompt de ejecución de una fase con diez lotes.

Esta carpeta es la fuente de verdad para implementar. Un requisito **especificado** no está construido ni probado: el estado solo cambia con evidencia.

| Archivo | Contenido |
| --- | --- |
| [`requisitos.md`](requisitos.md) | Requisitos con ID, fuente, roles, escenarios, componente, aceptación, evidencia esperada y estado. Incluye la correspondencia con los IDs D-A1…D-K3 de la auditoría. |
| [`inventario.md`](inventario.md) | Lo que existe hoy, medido en el código: rutas, módulos, comandos del store, componentes, juegos, automatizaciones, pruebas. |
| [`recorridos.md`](recorridos.md) | Los cinco recorridos del prompt, paso a paso, sobre rutas y comandos reales. |
| [`estabilidad.md`](estabilidad.md) | Caza de la falla e2e intermitente: método, causa, corrección y verificación. |

## Convenciones

- **Estados:** `especificado` → `construido` → `probado`; además `pendiente` y `bloqueado`. “Probado” exige una prueba ejecutada o una captura revisada, citada en la columna de evidencia.
- **Escenarios.** Se conservan S01–S48 y A01–A10 (ver `docs/validation.md`). Los nuevos usan rangos reservados por lote para no colisionar: S49–S58 (L3), S59–S66 (L4), S67–S78 (L5), S79–S96 (L6), S97–S112 (L7), S113–S128 (L8), S129–S148 (L9), S149–S160 (L10); automatizaciones nuevas desde A11. Cada lote fija sus escenarios exactos en `requisitos.md` **antes** de codificar.
- **Las pruebas antiguas no acreditan el alcance nuevo.** Que S01–S48 sigan en verde conserva lo existente; no prueba nada de lo agregado.
- **Límites que no cambian:** solo frontend local y datos ficticios; los roles son vistas, no seguridad; sin diagnóstico, triage ni recomendación de tratamientos; sin micrófono; audio solo tras gesto; ninguna comunicación, cobro ni sincronización real.
