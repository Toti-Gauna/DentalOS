# Validación · Fase 1 (PROMPT 1 — Scaffold y funcionalidad FE)

> Actualizado en el cierre de fase 1 (PR de cierre sobre `main` @ `c5911ac`): se agregaron pruebas para todos los casos que estaban parciales o sin ejecutar.

Fecha de ejecución: 16/10/2026 (reloj real del entorno). Reloj de la demo: 2026-10-19T09:00:00-03:00.
Entorno: contenedor Linux, `cwd=/home/user/DentalOS`, Node v22.22.0, npm 10.9.4, TypeScript 5.9.3, Vite 7.3.7, Vitest 3.2.7, ESLint 9.39.5, Playwright 1.56.1 con Chromium preinstalado (`/opt/pw-browsers/chromium`).

## Comandos ejecutados

| Comando | cwd | Prerrequisito | Exit | Evidencia |
| --- | --- | --- | --- | --- |
| `npm ci` | repo | `package-lock.json` | 0 | instalación limpia desde lockfile |
| `npm run lint` | repo | `npm ci` | 0 | ESLint sin errores ni warnings |
| `npm run typecheck` | repo | `npm ci` | 0 | `tsc -b --noEmit` sin errores |
| `npm run test -- --run` | repo | `npm ci` | 0 | 2 archivos, **63 tests pasados**: 44 de dominio (`src/domain/domain.test.ts`) + 19 de contraste WCAG sobre los tokens reales (`src/styles/contrast.test.ts`) |
| `npm run build` | repo | `npm ci` | 0 | entrada ~415 kB JS (126 kB gzip) + 10 chunks del panel cargados en diferido (4–21 kB c/u), 22 kB CSS, fuentes locales |
| `npm run test:e2e` | repo | `npm run build`, Chromium local | 0 | **23 tests pasados** + 1 omitido a propósito (capturas), en 3 corridas consecutivas (`smoke`, `flows`, `coverage`) |
| `npm run evidence` | repo | build | 0 | 10 capturas en `docs/evidence/` (1440 y 390 px) |
| CI en GitHub (PR #1 y `main`) | Actions | — | success | job `check` y `deploy` en verde (run 38980888127) |

Distinción de evidencia:
- **U** = prueba pura de dominio (Vitest). **E** = navegador real (Playwright/Chromium). **V** = revisión visual de capturas a 1440 y 390 px realizada durante la fase. **I** = implementado, sin ejecución automatizada ni manual registrada.
- Ningún test usa `--passWithNoTests`.

## Matriz S01–S48

| Caso | Estado | Evidencia |
| --- | --- | --- |
| S01 Visitante abre primera visita | Pass | E (inicio con servicios/CTA; sede inexistente → “Volver a sedes”), V |
| S02 Primera consulta → solicitud | Pass | U, E (solicitud pendiente única; cupo tomado antes del commit → error, formulario conservado, reintento con otro cupo) |
| S03 Recargar conserva | Pass | E (reload mantiene v2; storage denegado → “Solo en memoria” con aviso y la demo sigue operando) |
| S04 Nombre vacío | Pass | E (resumen de errores recibe foco, nombra el campo) |
| S05 Canal no elegido | Pass | E (resumen nombra “Canal preferido”, el enlace lleva el foco al campo, no hay commit, los demás campos se conservan) |
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
| S21 Preset vacío | Pass | U (n=0), E (informes “Sin datos (n=0)”, agenda ofrece crear turno de muestra) |
| S22 Cambio de vista | Pass | E (mismo `A-0012 v2` en portal y recepción; selector rotulado “no es inicio de sesión”) |
| S23 Borrador al navegar | Pass | E |
| S24 390 px táctil | Pass | E (reserva completa con `tap` en contexto móvil táctil, sin overflow; agenda semanal → lista) |
| S25 Reset | Pass | U (namespace), E (cancelar no cambia; confirmar repone reloj) |
| S26 Storage corrupto | Pass | U, E (aviso, app usable, restauración) |
| S27 Saludos | Pass | U, E |
| S28 Vacío no envía | Pass | U |
| S29 Cambiar por chat con dos citas | Pass | U, E (pregunta cuál) |
| S30 Texto desconocido | Pass | U |
| S31 Contenido clínico | Pass | U (límite; tarea solo al aceptar) |
| S32 Reabrir conversación | Pass | U (mensaje de estado actual, opciones viejas inválidas) |
| S33 Continuar por llamada | Pass | E (misma gestión R-006, mismo turno, gestión resuelta) |
| S34 Inicio voluntario | Pass | E (sin audio por defecto; AudioContext inexistente → aviso y llamada completa en texto) |
| S35 Rama ocupado → alternativa | Pass | E |
| S36 Mute / lectura | Pass | E (tras silenciar no se inicia ningún oscilador; lectura muestra todo en texto y la tarea sigue) |
| S37 Simular silencio | Pass | E (no confirma; ofrece repetir/lectura/recepción) |
| S38 Detener | Pass | E con AudioContext instrumentado: contextos cerrados = creados, osciladores detenidos = iniciados, 0 líneas nuevas 800 ms después de detener, turno sigue v1 |
| S39 Homónimos / versión de ficha | Pass | U |
| S40 Dependientes | Pass | U |
| S41 Odontograma | Pass | U, E |
| S42 Control indicado manual | Pass | U |
| S43 Aceptado ≠ cobrado | Pass | U, E |
| S44 Movimiento y reversión | Pass | U, E (reintento detectado, saldo reconciliado) |
| S45 Ofertas compitiendo | Pass | U, E |
| S46 Educación | Pass | U, E |
| S47 Teclado / reduced-motion | Pass (con límite) | E (Escape + foco con reduced-motion; 720 px CSS = zoom 200 % de 1440 sin overflow en 6 rutas y menú por teclado), U (19 pares de contraste ≥ 4.5:1 texto / ≥ 3:1 no-texto). Lector de pantalla real: no ejecutado |
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

## Correcciones hechas por la medición

- `--line-strong` (#b8b2a4 → #8f897c): los bordes de campos daban 2.1:1 y WCAG 1.4.11 pide 3:1. Ahora 3.5:1 sobre blanco y 3.2:1 sobre el fondo.

## No ejecutado / límites declarados

- Lector de pantalla real (NVDA/VoiceOver): no hay uno disponible en el contenedor. Hay roles, labels, regiones vivas y foco gestionado, verificados por Playwright.
- Audio audible: el contenedor no tiene salida de sonido. La limpieza se midió con un AudioContext instrumentado, no con el de un navegador real.
- El zoom real del navegador se aproximó con su equivalente en píxeles CSS (720 px).
- Concurrencia entre pestañas: solo hay aviso y elección; no se prometen merges.
