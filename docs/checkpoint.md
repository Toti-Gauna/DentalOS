# Checkpoint · DentalOS demo

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
