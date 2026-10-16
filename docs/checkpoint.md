# Checkpoint · DentalOS demo

- **Fase / lote:** PROMPT 1 completo (L1.1–L1.7). Próxima fase: PROMPT 2.
- **Rama:** `feat/fase1-scaffold-fe` sobre `main` @ `f1ba1f5` (repo inicial solo con README). Commit de la fase: ver `git log` de la rama.
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

Ver `docs/validation.md`: lint 0, typecheck 0, 42 unit, build 0, 15 e2e — todo en verde.

## Pendientes / riesgos

- Zoom 200 %, lector de pantalla y medición formal de contraste (fase 3 QA).
- Aserciones automáticas de mute/lectura (S36) y reserva completa a 390 px (S24).
- Bundle único ~501 kB (sin code-splitting; aceptable para demo local).
- Habilitar *Pages → Source: GitHub Actions* en el repo si aún no está.

## Próxima acción exacta

Fase 2 (refinamiento de experiencia): partir de esta rama/merge, correr `npm ci && npm run test:e2e`, y refinar audio (L2.4) y mecánica educativa (L2.3) sin cambiar el dominio salvo deuda declarada arriba.
