# Validación · Fase 1 (PROMPT 1 — Scaffold y funcionalidad FE)

Fecha de ejecución: 16/10/2026 (reloj real del entorno). Reloj de la demo: 2026-10-19T09:00:00-03:00.
Entorno: contenedor Linux, `cwd=/home/user/DentalOS`, Node v22.22.0, npm 10.9.4, TypeScript 5.9.3, Vite 7.3.7, Vitest 3.2.7, ESLint 9.39.5, Playwright 1.56.1 con Chromium preinstalado (`/opt/pw-browsers/chromium`).

## Comandos ejecutados

| Comando | cwd | Prerrequisito | Exit | Evidencia |
| --- | --- | --- | --- | --- |
| `npm ci` | repo | `package-lock.json` | 0 | instalación limpia desde lockfile |
| `npm run lint` | repo | `npm ci` | 0 | ESLint sin errores ni warnings |
| `npm run typecheck` | repo | `npm ci` | 0 | `tsc -b --noEmit` sin errores |
| `npm run test -- --run` | repo | `npm ci` | 0 | 1 archivo, **42 tests pasados** (`src/domain/domain.test.ts`) |
| `npm run build` | repo | `npm ci` | 0 | `dist/` ~501 kB JS (147 kB gzip), 22 kB CSS, fuentes woff/woff2 locales |
| `npm run test:e2e` | repo | `npm run build`, Chromium local | 0 | **15 tests pasados** (`tests/e2e/smoke.spec.ts`, `tests/e2e/flows.spec.ts`), 3 corridas consecutivas en verde antes de agregar S23/S33 |

Distinción de evidencia:
- **U** = prueba pura de dominio (Vitest). **E** = navegador real (Playwright/Chromium). **V** = revisión visual de capturas a 1440 y 390 px realizada durante la fase. **I** = implementado, sin ejecución automatizada ni manual registrada.
- Ningún test usa `--passWithNoTests`.

## Matriz S01–S48

| Caso | Estado | Evidencia |
| --- | --- | --- |
| S01 Visitante abre primera visita | Pass | E (inicio con servicios/CTA), V. Sede inexistente → pantalla de recuperación: I |
| S02 Primera consulta → solicitud | Pass | U (S06), E (flujo primera visita → “Solicitud enviada”, visible una vez en recepción). Cupo ocupado al commit con formulario conservado: I (botón de simulación presente) |
| S03 Recargar conserva | Pass | E (reload tras protagonista mantiene v2). Storage inaccesible → memoria: I (lógica en `store.ts`/`storage.ts`) |
| S04 Nombre vacío | Pass | E (resumen de errores recibe foco, nombra el campo) |
| S05 Canal no elegido | Parcial | Validación `validateNewPerson` usada en E de S04 (el canal vacío forma parte del resumen), sin aserción específica |
| S06 Doble clic mismo commandId | Pass | U, E (`dblclick` en Enviar solicitud → un registro) |
| S07 Duplicado semántico | Pass | U |
| S08 Profesional ocupado | Pass | U (sin mutación), E (protagonista) |
| S09 Sillón ocupado | Pass | U (preset `sillon_ocupado`) |
| S10 Duración insuficiente | Pass | U (hueco de 15 min no ofrecido) |
| S11 Fuera de jornada/horizonte/anticipación | Pass | U |
| S12 Agenda llena | Pass | U (preset `agenda_llena`: 0 cupos + espera) |
| S13 Reprogramar mismo ID | Pass | U, E (WhatsApp y llamada) |
| S14 Fallo de commit | Pass | U (preset `fallo_commit`, reintento idempotente) |
| S15 Ventana < 12 h | Pass | U, E (una sola tarea) |
| S16 Cancelar | Pass | U (outbox anulado, segunda cancelación sin evento) |
| S17 Confirmación de recepción | Pass | U, E |
| S18 Check-in → atención → finalizado | Pass | U, E |
| S19 Ausencia | Pass | U (futura rechazada, pasada registrada) |
| S20 Filtros | Pass | U (no muta, n=0 válido). UI con “Limpiar filtros” y conteo: V |
| S21 Preset vacío | Pass | U (KPI n=0 sin división por cero). Estado vacío de UI: I |
| S22 Cambio de vista | Pass | E (mismo `A-0012 v2` en portal y recepción; selector rotulado “no es inicio de sesión”) |
| S23 Borrador al navegar | Pass | E |
| S24 390 px táctil | Parcial | E (sin overflow horizontal en 7 rutas, agenda semanal → lista). Completar la reserva en móvil: I |
| S25 Reset | Pass | U (namespace), E (cancelar no cambia; confirmar repone reloj) |
| S26 Storage corrupto | Pass | U, E (aviso, app usable, restauración) |
| S27 Saludos | Pass | U, E |
| S28 Vacío no envía | Pass | U |
| S29 Cambiar por chat con dos citas | Pass | U, E (pregunta cuál) |
| S30 Texto desconocido | Pass | U |
| S31 Contenido clínico | Pass | U (límite; tarea solo al aceptar) |
| S32 Reabrir conversación | Pass | U (mensaje de estado actual, opciones viejas inválidas) |
| S33 Continuar por llamada | Pass | E (misma gestión R-006, mismo turno, gestión resuelta) |
| S34 Inicio voluntario | Pass | E (sin audio por defecto). AudioContext bloqueado → aviso: I |
| S35 Rama ocupado → alternativa | Pass | E |
| S36 Mute / lectura | Parcial | Controles presentes; sin aserción automatizada: I |
| S37 Simular silencio | Pass | E (no confirma; ofrece repetir/lectura/recepción) |
| S38 Detener | Pass | E (detener → sin commit, turno sigue v1). Limpieza de timers/osciladores: código (`hardStop`, `ToneEngine.stop`), sin medición |
| S39 Homónimos / versión de ficha | Pass | U |
| S40 Dependientes | Pass | U |
| S41 Odontograma | Pass | U, E |
| S42 Control indicado manual | Pass | U |
| S43 Aceptado ≠ cobrado | Pass | U, E |
| S44 Movimiento y reversión | Pass | U, E (reintento detectado, saldo reconciliado) |
| S45 Ofertas compitiendo | Pass | U, E |
| S46 Educación | Pass | U, E |
| S47 Teclado / reduced-motion | Parcial | E (Escape + devolución de foco con reduced-motion). Zoom 200 % y contraste medido: no ejecutado |
| S48 Sin red | Pass | E (ninguna request fuera de 127.0.0.1 en 16 rutas + flujos), auditoría de `dist/`, CSP de build |

## Automatizaciones A01–A10

| Regla | Estado | Evidencia |
| --- | --- | --- |
| A01 Solicitud web | Pass | U, E |
| A02 Primera consulta por WhatsApp | Pass | U (solicitud pendiente, no confirmada) |
| A03 Mover por WhatsApp | Pass | U, E |
| A04 Llamada | Pass | E |
| A05 Recordatorio 24 h | Pass | U (sin duplicados, opt-out → tarea) |
| A06 Oferta de espera | Pass | U, E |
| A07 Confirmar/cancelar | Pass | U |
| A08 Derivación humana | Pass | U |
| A09 Seguimiento de presupuesto | Pass | U (vence por reloj, una tarea, sin cobro) |
| A10 Continuidad entre canales | Pass | U (rechaza otra identidad), E (S33) |

## No ejecutado / pendiente declarado

- Zoom 200 %, lector de pantalla real y medición formal de contraste AA (tokens elegidos con contraste ≥ 4.5:1 estimado, sin herramienta de medición).
- Audio real: el contenedor no reproduce sonido; se verificó que la llamada funciona sin audio. La limpieza de nodos está en código, no medida.
- Concurrencia multi-pestaña: solo aviso y elección; no se prometen merges.
- Deploy en GitHub Pages: el workflow existe; su primera ejecución ocurre en el PR/merge.
