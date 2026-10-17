# Checkpoint · DentalOS demo

## Mejora L1–L10 — lote 1 (diagnóstico, especificación y estabilidad) · cerrado

- **Rama:** `feat/dentalos-l1-diagnostico` desde `main` @ `73c5e75`. Autorización de Ignacio: un PR por lote, seguimiento hasta verde, y esperar su OK antes del lote siguiente.
- **Hecho:**
  - `docs/spec/` con requisitos con ID (52, con fuente, roles, escenarios, componente, aceptación y estado), inventario medido, cinco recorridos y la correspondencia con los D-IDs de la auditoría.
  - Falla e2e intermitente **identificada y corregida**: carrera por reloj en vivo en el test del juego de Brisa Chicos (`page.clock.install` no detiene el tiempo) y, al verificar, un test demasiado costoso bajo carga. Detalle en `docs/spec/estabilidad.md`.
- **Código del producto:** sin cambios. Solo `tests/e2e/premium.spec.ts` y documentación.
- **Resultados:**
  - lint 0, typecheck 0, 154 unit, build 0.
  - Subconjunto afectado × 20 repeticiones con 4 workers: 60/60.
  - Suite completa × 5 seguidas: 63 pasadas + 1 omitida en cada una.
- **Hallazgo de la especificación:** la cancelación **no crea** tareas (solo cierra las del turno); el caso “cancelación → tarea” es trabajo nuevo del lote 9.
- **Decisiones que siguen pendientes de Ignacio:** elección visual (lote 2), confirmación del indicador “Demo” compacto con botonera (lote 3), precio/anticipo/plazo del cierre Eclipse (lote 9).
- **Próxima acción exacta:** lote 2 — investigación por familia de componentes y tres propuestas visuales en una ruta aislada, y **detenerse** hasta la elección de Ignacio. Modelo recomendado: Opus 5.5 en el nivel más alto disponible (“Extra”).

## Rediseño por fases (0–6) — modo oscuro, shell, páginas, arte dental v4 y Brisa Chicos v2 · cerrada

- **Rama:** `feat/fase3-rediseno` desde `feat/fase2c-premium` @ `8ca5904` (PR #5, todavía abierto).
- **Pedido:**
  - menú en el header y “Ver panel demo” en el footer;
  - bottom bar;
  - páginas mejor estructuradas;
  - Brisitos que aparezcan todos juntos y un juego que funcione;
  - modo oscuro;
  - dientes y dentaduras de nivel profesional;
  - todo por fases.
- **Commits:**
  - `67cb0c8` fase 0 + 1;
  - `514a33f` fase 2;
  - `92423d0` fase 3;
  - `75f6a17` fase 4;
  - `33f00c9` fase 5;
  - cierre con docs y evidencia.
- **Archivos nuevos:**
  - `docs/rediseno-por-fases.md`;
  - `public/theme-init.js`;
  - `src/ui/ThemeSwitcher.tsx`, `src/ui/OdontogramArch.tsx`;
  - `src/ui/art/dentition.tsx`, `src/ui/art/kids.tsx`;
  - `src/pages/public/kidsGame.ts` (+ test);
  - `tests/e2e/theme.spec.ts`, `tests/e2e/shell.spec.ts`.
- **Quitados:** `SmileArt` y `ToothGlyph`, reemplazados por la sonrisa completa y la vista oclusal.
- **Dominio:** sin cambios.
- **Resultados:**
  - lint 0 y typecheck 0;
  - 154 unit;
  - build 0;
  - 63 e2e en 3 corridas;
  - 72 capturas (48 claras y 24 oscuras).

  Detalle en `docs/validation.md`.
- **Decisiones:**
  - El tema se resuelve con `light-dark()` y `color-scheme`. La preferencia se guarda junto con la UI y se aplica antes de pintar.
  - En móvil, la navegación es la bottom bar. Lo propio de la demo vive en un popover de la franja.
  - El odontograma ubica las piezas por longitud de arco sobre una elipse. Cada pieza sigue siendo un `<button>` con su nombre accesible.
  - El juego usa una semilla por partida (sin `Math.random`) y tiene un modo sin límite de tiempo.
- **Deuda:**
  - Firefox y Safari;
  - lector de pantalla real;
  - si PR #5 se mergea antes, este PR queda solo con las fases.
- **Próxima acción exacta:** revisión de Ignacio del PR del rediseño.

## Fase 2c — análisis premium total, componentes nativos, fondo animado y dientes premium · cerrada

- **Rama:** `feat/fase2c-premium` desde `main` @ `5f10a70`.
- **Pedido:**
  - análisis de diseño premium total (qué mejorar, pulir y agregar);
  - aplicarlo con componentes nativos;
  - fondos animados;
  - dientes SVG todavía más premium.
- **Archivos:**
  - Nuevos: `docs/premium-v3.md`, `src/ui/CommandPalette.tsx`, `src/ui/art/pages.tsx`, `tests/e2e/native.spec.ts`.
  - Reescritos o ampliados:
    - `src/ui/art/teeth.tsx` (esmalte en capas, materiales por estado);
    - `src/ui/art/ortho.tsx`;
    - `src/ui/art/characters.tsx`;
    - `src/ui/kit.tsx` (`useNativeDialog`, Drawer y ConfirmDialog sobre `<dialog>`, `PageHeader` con `art`);
    - `src/app/router.ts` (View Transitions);
    - `src/app/App.tsx` (fondo ambiental, cabecera fija, popover, paleta);
    - `src/styles/app.css`;
    - páginas del portal y del panel;
    - tests y docs.
- **Dominio:** sin cambios (`schemaVersion` 1, seed `dentalos-v1`, reloj 19/10 09:00).
- **Resultados:**
  - lint 0 y typecheck 0;
  - 78 unit;
  - build 0;
  - 49 e2e en 3 corridas;
  - 48 capturas.

  Detalle en `docs/validation.md`, sección Fase 2c.
- **Decisiones:**
  - Todo nuevo es nativo o mejora progresiva con alternativa.
  - El fondo animado es solo decorativo, con el peor caso de contraste medido.
  - La transición de vista se aplica solo a la raíz (costo de captura medido).
  - La cabecera es fija solo desde 1100 px.
- **Deuda:** probar en Firefox y Safari y con GPU real; lector de pantalla real y audio audible.
- **Próxima acción exacta:** revisión de Ignacio del PR de la fase 2c. Después, fase 3 (QA).

## Fase 2b — análisis premium, arte SVG propio, Brisa Chicos y sonidos · cerrada

- **Rama:** `feat/fase2-ux-motion` (mismo PR #4 de la fase 2).
- **Pedido:**
  - análisis premium de toda la web;
  - SVG propios por caso (dientes de oro, con caries, etc.) y para ortodoncia;
  - terminar lo pendiente;
  - sonidos, personajes y sección infantil.
- **Archivos:**
  - Nuevos:
    - arte: `src/ui/art/{teeth,ortho,services,characters,brand}.tsx`;
    - `src/ui/sound.ts`;
    - `src/pages/public/Kids.tsx`;
    - `tests/e2e/premium.spec.ts`;
    - `docs/premium.md`.
  - Actualizados:
    - `src/app/App.tsx`: marca, botón de sonidos, ruta `#/chicos`, pie, foco, navegación del odontograma;
    - `src/app/store.ts` (`onResult`);
    - `src/app/ui-state.ts` (preferencia `sound`);
    - `src/pages/public/Home.tsx`;
    - `src/pages/admin/Odontogram.tsx`;
    - `src/pages/admin/Ortho.tsx`;
    - `src/styles/app.css` (tokens oro, barra lateral nocturna, arte y Brisa Chicos);
    - dominio: `PROCEDURES` ampliado, `episodeSetAppliance`, `CareEpisode.appliance?` y 11 registros de odontograma en la seed;
    - tests, docs y evidencia.
- **Dominio:** `schemaVersion` sigue en 1 (el campo nuevo es opcional), con la seed `dentalos-v1` y el reloj en 19/10 09:00.
- **Rutas nuevas:** `#/chicos`.
- **Resultados:**
  - lint 0 y typecheck 0;
  - 69 unit;
  - build 0;
  - 39 e2e en 3 corridas;
  - 48 capturas.

  Detalle en `docs/validation.md`, sección Fase 2b.
- **Decisiones:**
  - La estética infantil queda solo en `#/chicos`.
  - Los sonidos son opt-in, están apagados por defecto y el AudioContext solo se crea con un gesto.
  - El oro es el único acento.
  - La ilustración de cada pieza refleja lo realizado; lo planificado se marca con borde punteado.
- **Deuda:** audio audible y lector de pantalla real (QA en un dispositivo físico).
- **Próxima acción exacta:** revisión de Ignacio del PR #4. Después, fase 3 (QA) con `npm ci && npm run build && npm run test:e2e`.

## Fase 2 — PROMPT 2 (UX/UI premium, gamificación y motion) · cerrada

- **Rama:** `feat/fase2-ux-motion` desde `main` @ `668dec4`. PR de la fase en GitHub, pendiente de aprobación.
- **Lotes:** L2.1 a L2.5 completos.
  - L2.1: crítica, decisiones y descartes en `docs/design.md`.
  - L2.2: sistema de componentes aplicado a los 15 módulos.
  - L2.3: colección educativa con contenido nuevo, sellos de 0 a 3, foco en la explicación y relectura idempotente.
  - L2.4: motion causal, enlace portal ↔ agenda y dos tonos.
  - L2.5: contraste renderizado, 320/390/768/1440 px, teclado virtual, menú de vista y movimiento reducido.
- **Archivos:**
  - Nuevos: `src/ui/components.tsx`, `tests/e2e/a11y.spec.ts`, `docs/design.md`, `docs/evidence/before|after/*.jpg`.
  - Reescrito: `src/styles/app.css`.
  - Actualizados: `src/app/App.tsx`, `src/app/store.ts` (`lastChange` transitorio), páginas de los 15 módulos, `src/ui/RescheduleDrawer.tsx`, `src/ui/AppointmentPanel.tsx`, `src/ui/tones.ts`, `src/domain/learning.ts` (solo contenido), tests e2e (selectores).
  - Eliminado: `docs/evidence/*.png` de la fase 1, reemplazado por JPG reproducibles.
- **Dominio:** sin cambios de reglas, esquema ni seed (`schemaVersion` 1, `dentalos-v1`, reloj 19/10 09:00). El contenido educativo cambió el texto de las opciones, pero los `cardId` y `choiceId` se mantienen.
- **Rutas nuevas:** `#/admin?dia=YYYY-MM-DD&turno=A-XXXX`, el enlace visual del portal a la agenda.
- **Comandos y resultados:** ver `docs/validation.md`, sección Fase 2. Lint 0, typecheck 0, 63 unit, build 0, 32 e2e en 3 corridas.
- **Decisiones clave:**
  - Resumen en línea en lugar de mosaico de KPI en la agenda.
  - Vista “Por profesional” por defecto en desktop y lista diaria en móvil.
  - Detalle de la bandeja en drawer.
  - Navegación del portal siempre visible.
  - Vista de muestra con etiqueta explícita.
  - Tonos “habla” y “guardado”.
  - Resalte transitorio no persistido.
- **Deuda:** lector de pantalla real y audio audible (fase 3 QA). El zoom se aproximó con 720 px CSS.
- **Tiempo:** autónomo (agente), unas 2,5 h de reloj el 16 y 17/10/2026. Las horas de Ignacio no las registra el agente.
- **Próxima acción exacta (fase 3):** `npm ci && npm run build && npm run test:e2e`; auditar la fase 3 de QA partiendo de `docs/validation.md` (matrices) y de `docs/design.md` (reglas). Sumar una revisión con lector de pantalla real y audio en un dispositivo físico.

---

## Fase 1 (histórico)

- **Fase / lote:** PROMPT 1 cerrado (L1.1–L1.7 + cierre de pendientes). Próxima fase: PROMPT 2.
- **Historia:** PR #1 (`feat/fase1-scaffold-fe`, commit `3cd9b71`) mergeado en `main` @ `c5911ac`; CI y deploy a GitHub Pages en verde. Cierre de pendientes en la rama `feat/fase1-cierre` (PR #2).
- **Inspección inicial (L1.1):** directorio DentalOS con git, solo `README.md` (`# DentalOS`), sin manifiesto, lockfile, scripts, assets ni tests, sin AGENTS.md/CLAUDE.md. Sin workflow de Actions en el repo. Se aplicó la alternativa subsidiaria: React + TypeScript + Vite, SPA estática con rutas hash.
- **Stack real:** React 19.3, TypeScript 5.9.3, Vite 7.3.7, Vitest 3.2.7, ESLint 9.39.5, Playwright 1.56.1, @fontsource Manrope/Source Sans 3 (OFL).
- **Scripts reales:** `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:e2e` (ver README).
- **Seed / reloj / esquema:** `dentalos-v1`; `2026-10-19T09:00:00-03:00` (America/Argentina/Buenos_Aires, UTC-3 fijo); `schemaVersion 1`; namespace `dentalos.demo.v1` (+ `:ui`).

## Archivos de la fase

`package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `playwright.config.ts`, `index.html`, `public/favicon.svg`, `.gitignore`, `.github/workflows/deploy.yml`, `src/**` (domain, app, ui, pages, styles), `tests/e2e/**`, `README.md`, `docs/*.md`.

## Decisiones

1. Store propio de comandos (sin Redux/Zustand) y router hash propio: menos dependencias, idempotencia y atomicidad explícitas.
2. `commandId` estable por intención (`resched:A-0012:v1:<inicio>`, `book:<draft>:<slot>`, `ledger:<form>`); UI sin id explícito deriva `ui:<revision>:<payload>` (doble clic = mismo id). Más detección semántica de duplicados.
3. Estado `solicitada` = cupo reservado pendiente de recepción (Primera consulta y Consulta de ortodoncia). Se muestra siempre como “Pendiente de confirmación”, nunca como confirmado. Recepción confirma revalidando.
4. `Appointment.version` cuenta cambios de horario/recurso (reprogramación). Recordatorios con clave `rem:<cita>:v<versión>:24h`.
5. Primera alternativa ocupada del protagonista: “mismo horario otro día” (mar 20/10 10:00, ocupado por A-0008) → motor devuelve mar 20/10 11:00 y mié 21/10 15:00 (verificado por test).
6. Fallo simulado (`failNextCommits`) se consume aunque el comando falle; no toca datos de dominio.
7. Paciente puede “Confirmar asistencia” (`patientConfirmedVersion`), distinto de la confirmación de recepción.
8. Odontograma: superficies O para posteriores e I para anteriores; FDI validado por dentición.
9. CSP solo en build (el dev server necesita websocket).
10. Workflow de Pages: CI completo en PR; deploy solo en `main`.

## Resultados ejecutados

Ver `docs/validation.md`: lint 0, typecheck 0, 63 unit (44 dominio + 19 contraste), build 0, 23 e2e — todo en verde. Capturas en `docs/evidence/` (`npm run evidence`).

## Cierre de pendientes (PR #2)

- Pruebas en navegador nuevas: S01, S02 (cupo tomado antes del commit), S03 (storage denegado), S05, S21, S24 (reserva táctil completa a 390 px), S34 (sin audio), S36/S38 (audio instrumentado: limpieza medida) y S47 (zoom 200 % equivalente + menú por teclado).
- Contraste medido sobre los tokens reales; se corrigió `--line-strong` para cumplir 3:1.
- Reglas A05, A06 y A09 se pueden pausar desde Configuración; las demás son obligatorias. Comando `setAutomationRule` auditado.
- El panel admin se carga en diferido: el bundle de entrada baja de ~501 a ~415 kB.

## Desvío declarado

El contrato del prompt dice “no despliegues”. Ignacio pidió explícitamente CI + deploy a GitHub Pages en `main`, así que se publicó. El contenido es 100 % sintético y estático, sin datos reales.

## Tiempo

- **Autónomo (agente):** sesión del 16/10/2026, unas 2 h de reloj para la fase 1 y su cierre.
- **Horas de Ignacio:** no las registra el agente. Completar a mano (revisión, aprobación del PR, prueba del sitio publicado).

## Riesgos que siguen

- Sin lector de pantalla real ni audio audible probados (fase 3 QA).
- Una sola pestaña por diseño.

## Próxima acción exacta

Fase 2 (refinamiento de experiencia): partir de esta rama/merge, correr `npm ci && npm run test:e2e`, y refinar audio (L2.4) y mecánica educativa (L2.3) sin cambiar el dominio salvo deuda declarada arriba.
