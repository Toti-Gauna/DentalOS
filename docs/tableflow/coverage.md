# Cobertura: módulos, escenarios S01–S46 y automatizaciones AU01–AU10

Leyenda: **D** = probado en Vitest (dominio/persistencia), **E** = probado en Playwright sobre la app construida, **—** = no ejecutado. “Probado” significa que la aserción existe y pasó en esta construcción; no certifica nada fuera de lo descrito.

## Módulos M01–M15 → ruta real → acción → entidad → admin → S/AU
Fuente única: `src/pages/coverage.ts` (se muestra también en `/#/comercial`).

| Módulo | Ruta real (HashRouter) | Acción | Entidad | Admin | S | AU |
|---|---|---|---|---|---|---|
| M01 Carta | `/:perfil/carta` | buscar, filtrar, favoritas, detalle, sede | MenuItem, Location | `/admin/carta` | S01, S09 | — |
| M02 Config. y carrito | `/:perfil/carta/:itemId`, `/:perfil/pedido` | modificadores, cantidad, nota, precio cambiado | Cart, CartLine, ModifierGroup | `/admin/pedidos` | S02–S05, S08 | — |
| M03 Reservas y espera | `/:perfil/reservar`, `/:perfil/reservas/:id` | solicitar, reprogramar, cancelar, alternativas, espera | Reservation, WaitlistEntry, Table, ServiceWindow | `/admin/reservas`, `/admin/configuracion` | S10–S16, S30, S34 | AU01–AU04 |
| M04 Salón | `/admin/salon` | plano/lista, sentar, abrir, mover, combinar | TableSession | `/admin/salon` | S17, S18 | — |
| M05 Pedidos | `/:perfil/pedido/:id` | enviar, aceptar/rechazar, editar, cancelar, duplicar | Order, KitchenTicket | `/admin/pedidos` | S05, S06, S10, S42 | AU05 |
| M06 Cocina/barra | `/admin/cocina` | cola, aceptar, preparar, listo, entregar, incidencia | KitchenTicket | `/admin/cocina` | S19, S20 | AU05 |
| M07 Caja | `/admin/caja` | apertura, movimientos, división, pagos DEMO, arqueo, cierre | CashSession, PaymentSimulation | `/admin/caja` | S23–S26 | — |
| M08 Carta admin | `/admin/carta` | precio, agotado, nota alimentaria, categorías, historial | MenuItem | `/admin/carta` | S07, S08 | — |
| M09 Inventario | `/admin/stock` | reservar/consumir/liberar, reponer, ajustar, merma | Ingredient, Recipe, StockMovement | `/admin/stock` | S07, S21, S22 | AU06 |
| M10 Clientes | `/admin/clientes/:id` | ficha, consentimientos, unir duplicados | CustomerDemo | `/admin/clientes` | S34, S37 | AU10 |
| M11 WhatsApp y voz | `/:perfil/simulador`, `/:perfil/ayuda` | chat determinista, llamada por botones | Conversation, Message, CallSession, HumanReviewTask | `/admin/resumen` | S27–S35 | AU07 |
| M12 Automatizaciones | `/admin/automatizaciones` | activar/pausar, vista previa, reintentar, fallo inyectado | AutomationRule/Run | `/admin/automatizaciones` | S36, S37 | AU01–AU10 |
| M13 Pasaporte | `/:perfil/explorar`, `/:perfil/pasaporte` | tarjetas, insignia, sellos | Passport, Visit, Redemption | `/admin/clientes/:id` | S38, S39 | AU08 |
| M14 Catas | `/:perfil/catas` | inscribir, espera, cancelar | TastingEvent, EventBooking | `/admin/reportes` | S40 | AU09 |
| M15 Resumen/reportes/config | `/admin/resumen`, `/admin/reportes`, `/admin/configuracion` | indicadores, filtros, reglas, reinicio, diagnóstico | selectores | `/admin/reportes` | S41, S45, S46 | — |

Cada módulo tiene acción, consecuencia local persistida, excepción y recuperación visibles (ver “Excepción y resultado” de cada S). Ningún éxito existe solo como toast: toda confirmación tiene un cambio de estado visible en la página (los toasts son un refuerzo, con región viva).

## Escenarios S01–S46

| S | Dominio (D) | UI (E) | Observación |
|---|---|---|---|
| S01 | seed: 42 ítems, 28+14 | smoke, recorridos | imagen ausente = placeholder con texto |
| S02 | persistence | quality: recarga conserva carrito y sede; almacenamiento denegado → memoria + aviso | |
| S03 | commerce | recorrido restaurante (error de guarnición) | |
| S04 | commerce (máx. 1 salsa; incompatibilidad) | — | solo dominio |
| S05 | commerce | extra | |
| S06 | commerce (1 orden y 1 comanda) | recorrido restaurante (doble clic) | |
| S07 | commerce | admin | |
| S08 | commerce | admin | |
| S09 | commerce | extra | |
| S10 | commerce (retiro 03:00) | extra | |
| S11 | booking | quality (franja 20:00 deshabilitada; 21:45 habilitada) | |
| S12 | booking, comms | quality, chat | |
| S13 | booking (original conservado) | — | solo dominio |
| S14 | booking | quality | |
| S15 | booking, comms | quality | |
| S16 | booking | quality | |
| S17 | booking | admin | |
| S18 | booking | admin | |
| S19 | commerce | ambos recorridos | |
| S20 | commerce | admin | |
| S21 | commerce | — | solo dominio |
| S22 | commerce | admin | |
| S23 | cash (10.000/3) | recorrido restaurante (37.000/3) | |
| S24 | cash | extra | |
| S25 | cash | admin | |
| S26 | cash | admin | |
| S27 | comms | chat | |
| S28 | comms | chat (botón deshabilitado) | |
| S29 | comms | — | solo dominio |
| S30 | comms | — | solo dominio |
| S31 | comms | quality (sin autoplay ni micrófono) | |
| S32 | comms | quality | |
| S33 | comms | quality | |
| S34 | comms | — | solo dominio |
| S35 | comms, booking | quality (formulario web) | |
| S36 | automations | — | solo dominio |
| S37 | automations (AU10) | admin (vista previa) | |
| S38 | engage | admin | |
| S39 | engage | — | solo dominio |
| S40 | engage | admin | |
| S41 | engage (reports) | admin | |
| S42 | — | quality | |
| S43 | — | quality (320 y 390 px: sin scroll horizontal) | foco oculto no verificado formalmente |
| S44 | — | quality (reduced motion emulado + audio apagado: llamada completa) | parcial: no se repitieron los demás recorridos con reduced motion |
| S45 | persistence | quality | |
| S46 | persistence | quality | |

## Automatizaciones AU01–AU10 (`tests/automations.test.ts`)
Cada una probada en dominio con éxito, error/sin cupo, reintento, pausa y consentimiento según aplica, y con log accesible: AU01 (doble clic no duplica; pausa), AU02 (fallo inyectado + reintento misma ejecución; teléfono desconocido deriva; sin consentimiento omite; una confirmación por versión), AU03 (reloj dos veces = una entrega; fallo+reintento; versión nueva anula el recordatorio viejo; baja/cancelación suprimen), AU04 (primer candidato, vencimiento por reloj, retiro de oferta), AU05 (sin canal muestra código; fallo conserva “listo”), AU06 (alerta única por cruce; unidad incorrecta → incidencia), AU07 (tarea humana ligada al hilo), AU08 (sello único; insignia a la quinta), AU09 (lugar liberado ofrecido al siguiente; vencimiento), AU10 (solo vista previa; omisión auditada). En UI: reintento de ejecuciones (M12) y vista previa de campaña.

## Pruebas de invariantes
4 semillas × 250 comandos aleatorios reproducibles + idempotencia: `validateState` válido, stock ≥ 0 y reservas ≤ existencias, comanda coherente con el estado del pedido, sin solapes de reservas por mesa, fallos transaccionales (estado idéntico).

## No ejecutado / pendiente
- Lectura a 200 % de zoom, lector de pantalla real, verificación manual de foco en todos los diálogos, navegación KDS solo con teclado de punta a punta.
- Contraste: medido sobre los tokens de `styles.css` (23 pares, todos ≥ umbral); no se midió cada combinación renderizada. axe-core (reglas WCAG 2.0/2.1/2.2 A/AA) sin violaciones serias/críticas en 21 pantallas; esto **no certifica** accesibilidad.
- Varias pestañas reales y evento `storage`.
- Rendimiento (no se midió más que el tiempo de construcción del seed ≈150 ms).
- E2E en CI de GitHub (job informativo, no validado todavía).
