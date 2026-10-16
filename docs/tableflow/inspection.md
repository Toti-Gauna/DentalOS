# P1-L1 · Inspección del repositorio (registro)

Fecha de ejecución: 16/10/2026 (fecha real de trabajo; el reloj simulado de la demo es lunes 19/10/2026 10:00 y no se mezcla con esta).

## Comandos de verificación ejecutados (cwd `/home/user/DentalOS`)

| Comando | Resultado |
|---|---|
| `pwd` | `/home/user/DentalOS` |
| `git rev-parse --show-toplevel` | `/home/user/DentalOS` |
| `git status --short --branch` | `## HEAD (no branch)`, sin cambios locales |
| `git branch --show-current` | vacío (HEAD desprendido en `main`) |
| `git log -1 --oneline` | `f1ba1f5 Initial commit` |
| `git remote -v` (sin credenciales) | `origin https://github.com/Toti-Gauna/DentalOS` |
| `rg --files -g AGENTS.md -g package.json …` | sin resultados: no existían AGENTS.md, package.json, lockfile, configuración ni tests |
| `ls .github` | no existía; **no había ningún workflow** pese a que el operador indicó que Actions estaba activado para el deploy |
| `mcp__github__list_branches` | una sola rama: `main` (`f1ba1f5`) |

Contenido real del repo al iniciar: un único archivo `README.md` con el texto `# DentalOS`. Sin código, sin estilos, sin assets, sin tests, sin checkpoint previo.

## Decisiones y supuestos registrados

1. **Destino.** El operador indicó explícitamente que el repo existente es el destino (“El repo ya existe… abrí un PR para deployarlo en GitHub Pages en main”). El nombre del repo (`DentalOS`) no coincide con el producto (TableFlow); se trató como un repo vacío provisto por el operador y se registra la discrepancia. No se creó ningún proyecto paralelo. **Acción sugerida al operador:** renombrar el repo o aclarar si es el destino definitivo.
2. **Base técnica.** Como el directorio estaba vacío, se justifica una base estática mínima sin backend: **Vite + React 19 + TypeScript + react-router-dom (HashRouter)**; sin librería de UI ni de estado (store propio de ~100 líneas sobre `useSyncExternalStore`). HashRouter + `base: './'` porque GitHub Pages sirve en una subruta (`/DentalOS/`) y no ofrece fallback SPA.
3. **Versiones reales (`package.json`/lockfile):** React 19.3, react-router-dom 7.18, Vite 8.3, TypeScript 5.9, Vitest 5.0, Playwright 1.64, @axe-core/playwright 4.14, `@fontsource-variable/fraunces` y `manrope` 5.3 (licencia OFL-1.1, cargadas localmente).
4. **Gestor:** npm 10.9 (Node 22.22). Lockfile: `package-lock.json`.
5. **Scripts reales:** `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `typecheck`, `test` (Vitest), `e2e` (build + Playwright), `screens`. **No existe lint** (no se instaló ESLint): se declara ausente, no se simula.
6. **Chromium:** se usó el preinstalado en `/opt/pw-browsers` (revisión 1194) vía `executablePath`; no se descargó nada.
7. **Perfil sin reservas (S15).** Ritual Café (cafetería) viene con reservas desactivadas por defecto (atención por orden de llegada); es configurable en `/admin/configuracion`. Mesa Clara las toma.
8. **Reloj.** El salón de Mesa Clara abre 12:00: a las 10:00 simuladas un pedido en mesa se bloquea (“local cerrado”) y la UI ofrece saltar a las 12:00. Ritual Café opera desde las 08:00 y se puede recorrer en el reloj inicial.

## Mapa archivo existente → reutilizar / adaptar / nuevo

| Existente | Acción | Motivo |
|---|---|---|
| `README.md` (`# DentalOS`) | adaptado | se amplió con arranque, verificación y límites (el título original se conserva como nota) |
| todo lo demás | nuevo | el repo estaba vacío |

## Dependencias de decisiones del operador
- Habilitar **Pages → Source: GitHub Actions** en el repo (no verificable desde esta sesión).
- Confirmar si `DentalOS` es el nombre definitivo del repo.
