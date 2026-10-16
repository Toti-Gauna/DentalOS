# Fixtures y esquema

`fixtureId` = `servicio` | `vacio` · `schemaVersion` = 1 · reloj inicial **lunes 19/10/2026 10:00** (America/Argentina/Buenos_Aires). Todo es ficticio: no hay contactos, teléfonos ni correos de prospectos. Paila·Co y los demás prospectos **no** están en los fixtures.

El seed `servicio` **se construye ejecutando comandos reales** (`src/domain/fixtures/seed.ts`) con el reloj movido hacia atrás para la historia, por lo que cumple las mismas reglas que la app. Es determinista (dos construcciones son idénticas; verificado por test).

## Contenido (verificado por `tests/seed.test.ts`)
- 2 perfiles: **Mesa Clara** (bodegón, 1 sede: Salón y terraza; 12 mesas = 4×2 + 4×4 + 2×6 + 2×8 = 52 cubiertos; lun–sáb 12:00–15:30 y 20:00–23:30; reservas activadas) y **Ritual Café** (2 sedes: Centro con 6 mesas = 3×2 + 3×4 = 18 cubiertos y Norte solo retiro; lun–sáb 08:00–20:00; 6 retiros por franja de 15 min; reservas desactivadas).
- 42 productos (28 + 14), 11 grupos de modificadores, 16 insumos (2 bajos: Provolone y Leche de avena; 1 agotado: Roll de canela), 15 recetas (una con unidad incompatible a propósito: Flan).
- 18 reservas (confirmadas, solicitadas, revisión humana, alternativa ofrecida, completada, no-show, cancelada) — R-001…R-008 ocupan **todas** las mesas compatibles con cuatro a las 20:00 del lunes 19 (fixture explícito para el guion: 20:00 y 21:30 sin cupo, 21:45 con cupo).
- 12 pedidos (enviado ×2, aceptado, en preparación, listo, retirado, cerrado ×4, rechazado, cancelado), 12 comandas, 10 sesiones, 4 pagos DEMO, 2 sesiones de caja (CS-001 cerrada con diferencia de −$ 500; CS-002 abierta).
- 8 clientes ficticios (un par de posibles duplicados: Marcos P. / Marcos Pérez), 4 conversaciones (C-001 de Ana vacío para el guion), 20 reglas (AU01–AU10 por negocio), ejecuciones incluyendo **2 fallidas y 1 pendiente** para practicar recuperación, 2 catas (E-001 con 1 lugar libre), pasaporte de Ana con 1 tarjeta, visitas/sellos (Ana con 4: la próxima es la quinta).
- Próximos folios: **R-019**, **O-013**, **K-013**, **C-005**.

## IDs
Deterministas: contador persistente por prefijo en `state.counters` (`R`, `O`, `K`, `S`, `P`, `CL`, `C`, `RUN`, `AUD`, `MOV`, `OP`, `COR`…). Nunca `Date.now()`/`Math.random()` en el dominio.

## Seed vacío
Perfiles, carta, stock sano (sin alertas) y reglas; sin reservas, pedidos, clientes ni conversaciones. Se elige en el diálogo “Reiniciar demo” o en Configuración.

## Validación
`validateState` comprueba: `schemaVersion`, `fixtureId`, reloj, contadores, colecciones, IDs únicos por colección, `businessId` existente y consistente entre entidades relacionadas, referencias (sesión, comanda, ítem, insumo, regla…), importes enteros y totales = suma de líneas, `operationId`/`eventKey`/claves de ejecución únicas, una sola sesión activa por mesa, stock no negativo y reservas ≤ existencias.
