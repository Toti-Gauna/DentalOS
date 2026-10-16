# Arquitectura (construida)

Estado **construido y probado** salvo donde se indique.

```
src/
  domain/            lógica pura, sin React ni Date.now ni red
    types.ts         entidades (id, businessId, createdAt simulado, version)
    time.ts          reloj simulado, zona America/Argentina/Buenos_Aires (UTC-3 fijo)
    money.ts         centavos enteros, formato es-AR, división con ajuste de centavo
    core.ts          Outcome, IDs deterministas (contadores persistentes), audit, eventos de dominio
    availability.ts  motor de disponibilidad (intervalos semiabiertos, 90 + 15, sector blando)
    menu.ts stock.ts pickup.ts sessions.ts customers.ts tasks.ts messaging.ts nlu.ts
    cmd-*.ts         comandos (commerce, booking, cash, engage, system) + chat.ts + call.ts + automations.ts
    reducer.ts       applyCommand(): transaccional (copia → handler → eventos → commit o descarte)
    validate.ts      esquema + IDs únicos + businessId + referencias + invariantes
    persistence.ts   tableflow.demo.v1, recuperación, reinicio solo de claves TableFlow
    fixtures/        catálogo (42 ítems), base, seed servicio (se construye ejecutando comandos reales), seed vacío
  store.ts           store único (useSyncExternalStore), persistencia, modo memoria, recuperación, storage events
  ui/ pages/         UI por módulo (cliente /:perfil/*, admin /admin/*, /simulador, /comercial)
tests/               Vitest: dominio, persistencia, invariantes, contraste
e2e/                 Playwright: dos recorridos completos, S por la UI, red, móvil, axe
```

## Decisiones clave
- **Un store compartido, comandos y reducer.** Toda operación es un comando `{type, …}` que devuelve un `Outcome` (`ok`, `duplicate`, `fail`). Si falla o es un duplicado idempotente el estado original queda intacto (no hay cambios parciales). Selectores derivados en dominio/UI; ninguna página guarda copias de reservas o totales.
- **Idempotencia.** `operationId` por intento de negocio (pedido, pago, reserva, inscripción) asignado una vez y reutilizado en doble clic/reintento; `eventKey` única por movimiento de stock; claves de ejecución de automatización = regla + versión + entidad + versión de entidad + disparador. `correlationId` relaciona el hilo (chat/llamada) y no reemplaza al `operationId`.
- **Reloj.** Solo avanza con controles explícitos (`clock/advance`, `clock/jump`). Todo `createdAt` usa el reloj simulado. Los timers de la UI (llamada) son cancelables y están protegidos por `token`.
- **Eventos de dominio → automatizaciones.** Los comandos emiten eventos (`reservation.confirmed`, `order.listo`, `stock.low`, `clock.advanced`, …); `processEvents` ejecuta AU01–AU10 de forma local y síncrona. No hay background real.
- **Persistencia.** `localStorage` clave `tableflow.demo.v1` (+ `.prefs`, `.corrupt-backup`). Rehidratación validada; corrupción/versión futura → pantalla de recuperación (exportar diagnóstico sintético, restaurar seed o seguir en memoria); cuota/permiso → modo memoria con aviso. Reinicio: borra solo claves con prefijo `tableflow.demo.v1`, nunca `localStorage.clear()`.
- **Roles.** Solo cambian vistas y navegación. La excepción de cierre con saldo exige actor `encargado` como regla de negocio didáctica, **no** como control de seguridad.
- **Chat/llamada.** NLU determinista (`nlu.ts`: minúsculas, sin acentos, sinónimos, fechas ambiguas piden confirmación). Llamada: máquina de estados con transcripción completa, turnos por botones y Web Audio opcional (150–350 ms, volumen bajo, solo tras gesto, apagado por defecto). Sin micrófono, TTS ni reconocimiento de voz.

## Límites conocidos
- Varias pestañas: el evento `storage` recarga el estado válido del otro tab (último guardado gana). No equivale a concurrencia productiva y **no se probó** con pestañas reales.
- `structuredClone` completo por comando: suficiente para el volumen de la demo (seed ≈150 ms); no escalaría a miles de registros.
- Combinación de mesas solo manual (regla de muestra); el motor online nunca combina.
- Recetas: ítems sin receta no controlan stock.
- Sin imágenes: placeholders con texto (S01).
