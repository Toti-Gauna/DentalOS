# Checkpoint P1 · TableFlow — scaffold y funcionalidad FE (lotes L1–L6)

> Checkpoint de trabajo, **no** un cierre de demo ni prueba de producción. El cierre en Notion corresponde una sola vez al completar P4: no aplica todavía (ver “Texto consolidado listo para registrar”).

## Identificación
- Fecha de trabajo: 16/10/2026 (real). Reloj simulado de la demo: lunes 19/10/2026 10:00 ART (no se mezclan).
- Repo: `Toti-Gauna/DentalOS` · base `main@f1ba1f5` · rama de trabajo `claude/tableflow-demo` (2 commits propios: `1a88b79` dominio, `8c72c0b` UI + E2E + workflow, más el commit de este checkpoint). Cambios ajenos: ninguno.
- `fixtureId`: `servicio` (por defecto) y `vacio` · `schemaVersion`: 1 · persistencia `tableflow.demo.v1`.
- Modelo/versión/esfuerzo expuestos por Claude Code: la sesión informa el identificador configurado `claude-sonnet-5-5`; el esfuerzo **ND** (no expuesto). No se afirma que este prompt haya seleccionado el modelo: para verificarlo, el operador puede usar el selector de modelo de Claude Code (`/model`).

## Especificado → construido → probado → pendiente
| | |
|---|---|
| **Construido** | L1 shell, rutas, selector de rol/perfil/sede, banner DEMO, tokens, seed v1 (servicio/vacío), validación, persistencia con recuperación · L2 carta → detalle/modificadores → carrito → envío → folio en recepción · L3 reservas/espera/salón · L4 operación (aceptar→preparar→listo→servido/retirado), stock, caja · L5 clientes, chat determinista, llamada simulada, AU01–AU10 · L6 catas, pasaporte, sellos, reportes, configuración, diagnóstico, matriz de cobertura. |
| **Probado** | 144 pruebas Vitest (dominio, persistencia, invariantes, contraste) y 35 Playwright (dos recorridos completos, S01–S46 por UI donde se indica en `coverage.md`, red, móvil 320/390, reduced motion, axe). Detalle en `coverage.md`. |
| **Pendiente / no ejecutado** | zoom 200 %, lector de pantalla real, foco oculto por el carrito en móvil (solo se midió el desborde horizontal), repetir todos los recorridos con reduced motion, varias pestañas reales, CI de GitHub para E2E, lint (ausente), revalidar tarifario en la fuente, modo prospecto, fotos reales. |

## Comandos y resultados (cwd `/home/user/DentalOS`)
| Comando | Exit | Resultado |
|---|---|---|
| `npm ci`/`npm i` (deps) | 0 | 0 vulnerabilidades reportadas |
| `npm run typecheck` | 0 | sin errores |
| `npm test` | 0 | 10 archivos, 144 pruebas OK |
| `npm run build` | 0 | `dist/` 828 KB (JS 636 KB sin dividir; aviso de chunk > 500 KB) |
| `npx playwright test` | 0 | 35 OK, 1 omitida (capturas, solo con `CAPTURE=1`) |
| subruta `/DentalOS/` servida con `python3 -m http.server` | 0 | sin 4xx, fuentes locales cargadas (verificación manual con script de Playwright) |

Lint: **ausente** (declarado, no simulado).

## Archivos relevantes
`src/domain/*` (dominio), `src/domain/fixtures/*`, `src/store.ts`, `src/pages/client/*`, `src/pages/admin/*`, `src/pages/coverage.ts`, `tests/*`, `e2e/*`, `docs/tableflow/*`, `.github/workflows/deploy.yml`, `vite.config.ts`, `playwright.config.ts`.

## Capturas (`docs/tableflow/screens/`, generadas con `npm run screens`)
`01` landing 1280×900 · `02` Mesa Clara carta 1280×900 (lun 19 10:00) · `03` detalle de milanesa 1280×900 (12:00) · `04` reservar · `05` simulador (chat) · `06` admin reservas · `07` admin salón · `08` admin cocina (Ritual Café, reloj 12:00 tras saltar) · `09` resumen · `10` caja · `11` automatizaciones · `12`–`14` Ritual Café móvil 390×844 (carta, detalle, carrito fijo) · `15` pedido 320×640. Revisadas visualmente: carta, caja, cocina y detalle móvil.

## Decisiones y supuestos (reversibles)
Ver `inspection.md`: destino = repo existente; base Vite/React/HashRouter; Ritual Café sin reservas por defecto; con el reloj inicial las mesas del restaurante piden avanzar a las 12:00; excepción de cierre con saldo solo por rol “encargado” (regla didáctica); criterio conservador de sellos: **un sello por persona y fecha en todo el negocio** (la unicidad cliente+fecha+sede se registra y se respeta, y se evita el acopio entre sedes); consentimiento de servicio por defecto verdadero para clientes creados desde un chat/web (supuesto de demo); combinar mesas solo con la regla de muestra (M1+M2, M3+M4).

## Bloqueos con impacto
- El repo no tenía workflow de deploy ni Pages verificable: se agregó `deploy.yml`; falta que el operador confirme **Pages → Source: GitHub Actions**.
- Nombre del repo (`DentalOS`) ≠ producto (TableFlow): sin impacto técnico, a decidir.

## Estimación humana por lote (tras inspección; es una estimación, no un compromiso)
Tiempo de agente en background no incluido ni prometido. Horas humanas equivalentes para construir y probar a este nivel: L1 ≈ 10 h · L2 ≈ 10 h · L3 ≈ 14 h · L4 ≈ 16 h · L5 ≈ 18 h · L6 ≈ 12 h · documentación y E2E transversal ≈ 10 h. Sin fechas prometidas.

## Pase a P2 (Sales/UX/branding)
- Rutas reales: ver `coverage.md`. Esquema/seed: `fixtures.md`. Versión: `schemaVersion` 1, seed `seed-v1`.
- Defectos/deudas conocidas: bundle sin dividir; accesibilidad solo automatizada; los íconos de estado son caracteres Unicode; no hay fotos (placeholders); el KDS no tiene arrastre (acciones por botón, accesibles por teclado); S43/S44 parciales.
- Capturas de ambas experiencias y del admin: carpeta `screens/`.

## Siguiente acción exacta
1. Operador: habilitar Pages (Source: GitHub Actions) y mergear el PR de `claude/tableflow-demo` a `main`; verificar `https://toti-gauna.github.io/DentalOS/`.
2. P2-L2: revisar copy/UX con las capturas y repetir S43/S44 completos con dispositivos reales.
3. Validar el job E2E de CI y, si pasa, volverlo bloqueante.

## Texto consolidado listo para registrar en Notion (sin acceso a Notion en esta fase)
“P1 TableFlow: demo frontend local construida (15 módulos, 2 perfiles ficticios, 46 escenarios S y 10 automatizaciones AU cubiertos según matriz). 144 pruebas de dominio/persistencia/invariantes y 35 E2E pasan; typecheck y build OK. Pendiente: accesibilidad manual, zoom 200 %, CI E2E, tarifario por revalidar. Sin backend, sin envíos reales; roles son vistas. Cierre formal de demo en Notion: al completar P4.”
