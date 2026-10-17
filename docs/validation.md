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


---

# Fase 2 (PROMPT 2 — UX/UI, gamificación y motion)

Rama `feat/fase2-ux-motion` sobre `main` @ `668dec4`. Mismo entorno y mismas versiones que en la fase 1 (Node 22.22.0, npm 10.9.4, TypeScript 5.9.3, Vite 7.3.7, Vitest 3.2.7, ESLint 9.39.5, Playwright 1.56.1 con Chromium local). No se agregaron dependencias.

## Comandos ejecutados

| Comando | Exit | Evidencia |
| --- | --- | --- |
| `npm run lint` | 0 | sin errores |
| `npm run typecheck` | 0 | sin errores |
| `npm run test -- --run` | 0 | 63/63 (dominio y contraste de tokens; sin cambios de dominio salvo el contenido de `learning.ts`) |
| `npm run build` | 0 | entrada ~429 kB JS (131 kB gzip), panel en diferido; sin URLs de red en `dist/` salvo los namespaces XML y el texto de errores de React |
| `npm run test:e2e` | 0 | **32 pasadas** + 1 omitida a propósito (capturas), en 3 corridas consecutivas. Archivos: `smoke`, `flows`, `coverage` y `a11y` (nuevo) |
| `EVIDENCE_DIR=docs/evidence/before npm run evidence` (sobre `main`, antes de cambiar) | 0 | 30 capturas: 390, 768 y 1440 px × 10 rutas |
| `EVIDENCE_DIR=docs/evidence/after EVIDENCE_VIEWPORTS=320,390,768,1440 npm run evidence` | 0 | 40 capturas: 320, 390, 768 y 1440 px × 10 rutas |

## Pruebas nuevas de L2.5 (`tests/e2e/a11y.spec.ts`)

| Prueba | Resultado |
| --- | --- |
| Contraste renderizado AA en 19 rutas a 1440 px (cada texto visible contra su fondo efectivo) | Pass |
| Contraste renderizado AA en 19 rutas a 390 px | Pass |
| 320 px: 19 rutas sin scroll horizontal de página | Pass, después de corregir el overflow de 10 px de `/aprender` |
| Teclado virtual simulado (alto de 420 px): el campo del chat y “Enviar” quedan visibles y operables | Pass |
| Teclado virtual en reserva: el CTA se alcanza con foco y no queda tapado (`elementFromPoint`) | Pass |
| Menú de vista por teclado: cambia de área y el foco llega al título | Pass, después de corregir el foco (ver abajo) |
| DateStrip con flechas; el drawer de la agenda conserva día y filtro, y Escape devuelve el foco a la celda | Pass |
| Movimiento reducido: sin animación; resalte con borde sólido y texto “Actualizado recién” | Pass |
| Audio: no hay AudioContext antes del gesto; suenan exactamente los dos tonos (523/659 Hz) | Pass |

## Regresión del protagonista y casos afectados

| Caso | Estado | Evidencia |
| --- | --- | --- |
| S13 / S29 / A03 | Pass | E: WhatsApp → ocupado → mar 11:00 → v2. TurnoCard “Actualizado recién”. El enlace abre la agenda del 20/10 con la celda resaltada. Tras recargar sigue en v2. |
| S14 | Pass | U (preset de fallo de commit) |
| S32 | Pass | U (reapertura con estado actual) |
| S33 / S35 / A04 / A10 | Pass | E: misma gestión R-006 por llamada → mié 15:00 v2. Bandeja resuelta. |
| S24 | Pass | E: reserva táctil completa a 390 px; 320 px sin overflow |
| S46 | Pass | E: respuesta incorrecta → explicación con foco → correcta → sello. La relectura no suma y persiste al recargar. |
| S47 | Pass | E: teclado, Escape, foco, movimiento reducido, 720 px (equivalente a zoom 200 %), contraste renderizado |
| S48 | Pass | E: 16 rutas sin requests fuera de 127.0.0.1; auditoría de `dist/` |
| S01–S26, S39–S45, A01–A10 | Pass | Las suites de dominio y e2e de la fase 1 siguen en verde con los componentes nuevos. Se actualizaron selectores (`[data-appointment]`, vista “Lista del día”) sin cambiar ninguna aserción de dominio. |

## Fallos encontrados y corregidos en esta fase

1. **Navegación del portal:** el ítem activo quedaba blanco sobre blanco por especificidad CSS. Se corrigió y lo cubre el contraste renderizado.
2. **Vista de muestra desde el portal:** al elegir “Recepción”, un efecto devolvía la vista a “paciente” antes del cambio de ruta y el foco caía en `body`.
   - Ahora el efecto solo reacciona al cambio de área.
   - El enfoque del título espera al título nuevo cuando el panel carga en diferido.
3. **`/aprender` a 320 px:** 10 px de overflow por los sellos. Corregido con un flex que envuelve, sin achicar la letra.
4. **Odontograma:** la leyenda usaba cuadrados que parecían casillas de verificación. Pasó a usar el mismo glifo de las piezas.
5. **Ficha:** la etiqueta de familia estaba invertida (“Dependiente · Madre”). Ahora dice “Responsable · madre”.

## Deuda o límites declarados

- Lector de pantalla real (NVDA/VoiceOver) y audio audible: no disponibles en el contenedor. Se verificaron por semántica, foco y AudioContext instrumentado.
- El zoom del navegador se aproximó con 720 px CSS (zoom 200 % sobre 1440). No se probó el zoom de texto solo.
- Los textos sobre gradientes (bloqueos, esqueletos de carga) quedan fuera de la medición automática de contraste; su texto usa tokens que superan 4.5:1 sobre blanco.

---

# Fase 2b (análisis premium, arte SVG propio, Brisa Chicos y sonidos)

Misma rama (`feat/fase2-ux-motion`), mismo entorno y sin dependencias nuevas. El análisis y las decisiones están en [`premium.md`](premium.md).

## Comandos ejecutados

| Comando | Exit | Evidencia |
| --- | --- | --- |
| `npm run lint` | 0 | sin errores |
| `npm run typecheck` | 0 | sin errores |
| `npm run test -- --run` | 0 | **69/69** (+2 de dominio: `episodeSetAppliance` y registros nuevos del odontograma; +4 pares de contraste: oro para texto, barra lateral, módulo en barra y pie) |
| `npm run build` | 0 | entrada ~478 kB JS (144 kB gzip). En `dist/` solo aparecen los namespaces XML y `react.dev/errors`. |
| `npm run test:e2e` × 3 corridas | 0 | **39 pasadas** + 1 omitida a propósito (capturas) en cada corrida |
| `EVIDENCE_DIR=docs/evidence/after EVIDENCE_VIEWPORTS=320,390,768,1440 npm run evidence` | 0 | 48 capturas: 4 viewports × 12 rutas (se sumaron `chicos` y `ortodoncia`) |

## Pruebas nuevas (`tests/e2e/premium.spec.ts`)

| Prueba | Resultado |
| --- | --- |
| Inicio: 6 ilustraciones de motivo, 4 tarjetas de equipo con aviso de ilustración, banda que lleva a `#/chicos` con foco en el título y “Chicos” activo | Pass |
| Brisa Chicos: 4 saludos dan 5 stickers (incluye “Equipo completo”) y se anuncian; volver a saludar no duplica; el cuento da sticker; persiste al recargar; “Vaciar álbum” pide confirmación y vuelve a 0 | Pass |
| Reloj de cepillado con reloj controlado (`page.clock`): cambia de zona a los 5 s en la demo de 20 s; pausa sin avanzar (“Quedan 15 segundos”); al terminar suma cepillado y sticker | Pass |
| Sonidos:<ul><li>apagados por defecto: 0 AudioContext y nada reproducido;</li><li>al activarlos se crea 1 contexto y se registran `toggle`, `pop` y `stamp`;</li><li>al recargar se recuerda la preferencia sin crear contexto hasta el próximo gesto;</li><li>al apagarlos no suena nada.</li></ul> | Pass |
| Odontograma P-008: piezas 16, 25 y 38 ilustradas como corona de oro, implante y ausente; “Odontograma” activo en la navegación; catálogo de 13 estados; un “Implante” realizado nuevo en la 26 cambia la ilustración | Pass |
| Ortodoncia: aparatología ilustrada con nombre accesible; cambiarla actualiza la ilustración y el timeline; catálogo de 5 | Pass |
| `#/chicos` sumada al contraste renderizado (1440 y 390 px) y a la prueba de 320 px sin scroll horizontal | Pass (20 rutas) |

## Fallos encontrados y corregidos

1. **Robo de foco durante la carga diferida del panel** (bug real que ya existía en la fase 2). Lo destapó una corrida intermitente de la prueba del DateStrip.
   - **Causa:** el reintento de foco al título (cada 50 ms mientras carga el panel) enfocaba el título aunque la persona ya hubiera puesto el foco en un control del contenido nuevo.
   - **Corrección:** si el foco se movió dentro de `#main` desde que empezó la navegación, el título no lo toma.
   - **Prueba de regresión determinista:** un `MutationObserver` enfoca el día apenas aparece. Falla sin la corrección y pasa con ella.
2. **Navegación del panel en el odontograma:** se marcaba “Personas y familias” (por el prefijo de la ruta). Ahora se marca “Odontograma”.
3. **Inicio:** se quitó un degradado del héroe que dibujaba un rectángulo visible arriba a la izquierda.
4. **Brisa Chicos:** la zona actual del cepillado se anunciaba dos veces (región viva propia + anuncio global). Quedó solo el anuncio global.
5. **Ortodoncia:** “Tareas del episodio” quedaba vacía sin texto. Ahora dice “Sin tareas de control para esta persona.”

## Límites declarados

- Audio audible y lector de pantalla real: no disponibles en el contenedor. Se verificaron con un AudioContext instrumentado, nombres accesibles y foco.
- Los personajes y avatares son ilustraciones propias; no hay fotos ni personas reales.

---

# Fase 2c (análisis premium total, componentes nativos, fondo animado, dientes premium)

Rama `feat/fase2c-premium` desde `main` @ `5f10a70` (PR #4 mergeado). Mismo entorno y sin dependencias nuevas. El análisis está en [`premium-v3.md`](premium-v3.md).

## Comandos ejecutados

| Comando | Exit | Evidencia |
| --- | --- | --- |
| `npm run lint` | 0 | sin errores |
| `npm run typecheck` | 0 | sin errores |
| `npm run test -- --run` | 0 | **78/78**. Hay 9 pares de contraste nuevos: tinta, secundario y primario sobre el **peor caso del fondo animado** (dos manchas superpuestas en su alfa máximo; incluye la mezcla de Brisa Chicos). |
| `npm run build` | 0 | Entrada ~503 kB JS (151 kB gzip). En `dist/` siguen sin aparecer URLs de red, salvo namespaces XML y `react.dev/errors`. Los SVG `data:` de `app.css` los permite la CSP (`img-src 'self' data:`). |
| `npm run test:e2e` × 3 corridas | 0 | **49 pasadas** + 1 omitida a propósito (capturas) en cada corrida |
| `EVIDENCE_DIR=docs/evidence/after EVIDENCE_VIEWPORTS=320,390,768,1440 npm run evidence` | 0 | 48 capturas. Ahora se toman con movimiento reducido, para que sean deterministas (sin transiciones ni fondo en movimiento). |

## Pruebas nuevas (`tests/e2e/native.spec.ts`)

| Prueba | Resultado |
| --- | --- |
| Paleta ⌘K/Ctrl+K:<ul><li>`<dialog>` nativo en modo modal (`:modal`), con foco en el combobox;</li><li>buscar “P-008” + Enter abre la ficha con foco en el título;</li><li>el botón “Buscar (Ctrl K)” la abre;</li><li>Escape la cierra sin navegar y devuelve el foco al botón.</li></ul> | Pass |
| Paleta: las flechas cambian la opción activa (`aria-activedescendant`, `aria-selected`) y Enter navega al odontograma de la persona | Pass |
| Drawer y confirmación sobre `<dialog>` nativo: modal, fondo inerte, Escape cierra y el foco vuelve a quien abrió | Pass |
| Popover nativo “¿Qué es esta demo?”: abre (`:popover-open`), Escape lo descarta y el banner sigue visible | Pass |
| Preguntas frecuentes: acordeón exclusivo nativo; abrir una cierra la otra | Pass |
| Fondo animado: es decorativo (`aria-hidden`) y se anima; con movimiento reducido queda quieto y las burbujas de Brisa Chicos se ocultan | Pass |
| View Transitions: se usan al navegar y no se usan con movimiento reducido | Pass |
| Reserva: grilla de horarios con hora destacada; cada radio conserva el nombre accesible completo (“lunes 19 de octubre, 11:00 h”) | Pass |
| Panel:<ul><li>avatares de personas (decorativos);</li><li>11 barras de datos en informes;</li><li>importes negativos marcados en la caja.</li></ul> | Pass |
| Encabezados ilustrados en 6 rutas del portal y estado vacío con personaje | Pass |

## Fallos encontrados y corregidos

1. **Ilustración de “Pedir un turno” recortada.** La regla `.page-art svg` también agrandaba el diente SVG anidado. Se limitó a `.page-art > svg`.
2. **Transiciones entre rutas lentas.** Nombrar `#main` para la View Transition obligaba a capturar la página entera. En el Chromium headless del contenedor (render por software), el cambio de ruta tardaba ~490 ms en empezar.
   - Ahora se funde solo la vista (raíz), que captura el viewport.
   - Medido en el mismo entorno: **34 ms sin transición, ~256 ms con transición**. En un navegador con GPU la captura debería tomar del orden de un cuadro, pero eso no se pudo medir aquí.
   - Con movimiento reducido no hay transición.
3. **KPI de importes grandes desbordaban la tarjeta** al no partirse. Ahora el valor usa unidades de contenedor (`cqi`) dentro de cada KPI.
4. **Botón “Buscar” en móvil sin nombre accesible** al ocultar el texto. Ahora tiene `aria-label="Buscar (Ctrl K)"`.
5. **Prueba de robo de foco con ventana fija de 700 ms.** Con la transición de vista y el panel diferido, el día aún no estaba montado y la prueba fallaba en las 3 corridas.
   - Ahora espera a que el día exista y recién ahí mide la ventana de reintentos.
   - Sigue fallando sin la corrección de foco de la fase 2b.
6. **Cabecera fija de tablas descartada.** Dentro de `.table-wrap` (con `overflow-x`) no tenía efecto, así que se quitó en lugar de dejar una regla que no hace nada.

## Límites declarados

- El contenedor solo tiene Chromium. Por eso no se probaron en otros navegadores estas mejoras progresivas, que tienen alternativa sin ellas:
  - select personalizable (`appearance: base-select`);
  - anclaje CSS (`anchor-name`);
  - apertura animada de `<details>` (`::details-content` + `interpolate-size`);
  - animación por scroll (`animation-timeline: scroll()`);
  - View Transitions.

  Sin ellas quedan, respectivamente, el select clásico estilizado, el popover centrado, la apertura sin animación, la sombra fija y el cambio instantáneo.
- Rendimiento con GPU real, lector de pantalla real y audio audible: no disponibles en el contenedor.

# Rediseño por fases (fases 0–6: modo oscuro, shell, páginas, arte dental v4 y Brisa Chicos v2)

Rama `feat/fase3-rediseno`, que sale de `feat/fase2c-premium` (PR #5). Mismo entorno y sin dependencias nuevas. El análisis y el estado por fase están en [`rediseno-por-fases.md`](rediseno-por-fases.md). El dominio no cambia (`schemaVersion` 1, seed `dentalos-v1`).

## Comandos ejecutados

| Comando | Exit | Evidencia |
| --- | --- | --- |
| `npm run lint` | 0 | sin errores |
| `npm run typecheck` | 0 | sin errores |
| `npm run test -- --run` | 0 | **154/154** en 3 archivos:<ul><li>dominio;</li><li>contraste: cada par de tokens se mide en claro **y** en oscuro, incluido el peor caso del fondo animado;</li><li>8 pruebas nuevas de la lógica del juego (`src/pages/public/kidsGame.test.ts`).</li></ul> |
| `npm run build` | 0 | Entrada ~544 kB JS (163 kB gzip), 92 kB CSS (19 kB gzip). |
| `npm run test:e2e` × 3 corridas | 0 | **63 pasadas** + 1 omitida a propósito (capturas) en cada corrida |
| `npm run evidence` (320, 390, 768 y 1440 px) y `EVIDENCE_SCHEME=dark EVIDENCE_VIEWPORTS=390,1440 npm run evidence` | 0 | 72 capturas en `docs/evidence/after`: 48 en claro y 24 en oscuro (`*-dark.jpg`) |

## Pruebas nuevas o reescritas

| Prueba | Resultado |
| --- | --- |
| Contraste renderizado AA en 20 rutas a 1440 y 390 px, ahora también en **tema oscuro** (4 pruebas) | Pass |
| Tema “Sistema” sigue `prefers-color-scheme`; “Oscuro” se aplica, se recuerda al recargar y no parpadea; el panel en oscuro mantiene el contraste del botón primario (`theme.spec.ts`, 3) | Pass |
| Shell (`shell.spec.ts`, 6):<ul><li>menú del portal dentro de la cabecera, con página actual;</li><li>“Ver panel demo” en el pie y regreso al portal;</li><li>barra lateral agrupada, migas y búsqueda en la cabecera;</li><li>en 390 px, bottom bar con 5 destinos y hoja “Más”, contenido antes de los 200 px;</li><li>la bottom bar se oculta con un campo enfocado;</li><li>en desktop no hay bottom bar y la cabecera queda fija.</li></ul> | Pass |
| S47 (zoom 200 %): navegación por la bottom bar y la hoja “Más” con teclado | Pass |
| Odontograma ilustrado sobre las arcadas nuevas: oro, implante y ausente por `data-art`; un registro nuevo cambia la ilustración; 13 estados en el catálogo | Pass |
| Brisa Chicos: los cuatro Brisitos visibles a la vez; “¡Hola, Brisitos!” muestra 4 saludos y da un sticker; tocar a cada uno muestra su globo y al cuarto llega “Amigos de verdad” sin duplicar; el álbum persiste al recargar y se vacía | Pass |
| Juego “Cazá los bichitos” con reloj controlado:<ul><li>12 dientes deshabilitados hasta empezar;</li><li>el foco queda en “Terminar”;</li><li>un diente limpio no suma y uno con bichito sí, también con Enter;</li><li>a los 30 s da 3 estrellas, stickers y récord.</li></ul> | Pass (estable en 3 repeticiones extra) |
| Juego sin apuro: a los 60 s sigue habiendo 3 bichitos (no se escapan) y termina al limpiar 12 | Pass |
| Sonidos: el AudioContext nace con el gesto también en la escena grupal | Pass |

## Fallos encontrados y corregidos

1. **Contraste en oscuro:** el día de semana del selector de fechas quedaba en 3,99:1 al estar elegido. Ahora usa el color de texto sobre primario.
2. **Reglas del panel que agrandaban la franja de demo, la barra lateral y las migas** (`.admin p`, `.admin li`). Se separaron con selectores específicos.
3. **Patrón del chat en oscuro:** una máscara no cubría la parte desplazada. Ahora hay un fondo propio por tema.
4. **Reloj de cepillado en oscuro:** el número y el aro usaban colores fijos y el número no se leía. Ahora usan los tokens del tema.
5. **Arte dental v4:** primero el paladar quedaba plano con una banda blanca y la sonrisa tenía dientes chicos y separados. Se corrigieron los dos, con revisión visual en una galería de los 13 estados × 4 piezas.
6. **Nombre de sticker activo en oscuro:** quedaba con poco contraste sobre oro. Ahora usa el relleno primario.

## Límites declarados

- Solo Chromium; el modo oscuro y las arcadas no se probaron en Firefox ni Safari.
- El juego no mide ni evalúa el cepillado real; es solo un juego, y así lo dice la página.
- El odontograma en móvil se desplaza en horizontal dentro de su tarjeta (mínimo 560 px) para que cada pieza siga siendo fácil de tocar; la página no tiene scroll horizontal (verificado en 320 y 390 px).
- Sin lector de pantalla real ni audio audible en el contenedor.

