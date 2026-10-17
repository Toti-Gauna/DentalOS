# DentalOS · demo Clínica Brisa (pre-venta)

**Demo · Clínica Brisa ficticia · Datos de muestra · Sin envíos reales**

Aplicación **solo frontend y local** que muestra un circuito administrativo odontológico (odontología general y ortodoncia) con 15 módulos navegables sobre un único store compartido. No es un producto clínico, no es historia clínica productiva y no reemplaza el software que una clínica ya use. La amplitud de esta demo no es una promesa de alcance comercial.

- Sin backend, base de datos, IA/LLM, autenticación, mensajes, llamadas, cobros, analytics ni integraciones.
- Sin micrófono, reconocimiento ni síntesis de voz. Los únicos sonidos son dos tonos sintéticos opcionales.
- Fuentes e íconos locales; CSP de build con `connect-src 'none'`.
- Todos los datos son sintéticos (seed `dentalos-v1`). IDs `P-001…` en lugar de documentos.

## Comandos (npm, Node ≥ 20; verificados con Node 22.22 / npm 10.9)

| Acción | Comando |
| --- | --- |
| Instalar desde lockfile | `npm ci` |
| Desarrollo | `npm run dev` (http://127.0.0.1:5173) |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Tests de dominio (Vitest) | `npm run test -- --run` |
| Build estático | `npm run build` → `dist/` |
| Preview del build | `npm run preview -- --host 127.0.0.1` |
| Capturas de evidencia | `EVIDENCE_DIR=docs/evidence/after EVIDENCE_VIEWPORTS=320,390,768,1440 npm run evidence` (requiere build) |
| Smoke/flujos en navegador (Playwright) | `npm run test:e2e` (levanta el preview; usa `/opt/pw-browsers/chromium` si existe, o el Chromium instalado por Playwright) |

Resultados reales en [`docs/validation.md`](docs/validation.md). Estado de la fase en [`docs/checkpoint.md`](docs/checkpoint.md). Dirección visual, tokens, componentes y reglas de motion, audio y colección en [`docs/design.md`](docs/design.md).

## Deploy

`.github/workflows/deploy.yml`: en cada PR corre lint, typecheck, unit, build y e2e. En `main` además publica `dist/` en **GitHub Pages** (requiere *Settings → Pages → Source: GitHub Actions*). `base: './'` + rutas hash: funciona en subruta sin rewrites.

## Stack

React 19 + TypeScript 5.9 + Vite 7, CSS propio, store de comandos propio (sin router ni librerías de estado externas). Vitest para dominio puro, Playwright 1.56.1 para navegador.

## Mapa de rutas (hash) y módulos

| Ruta | Módulo | Vista |
| --- | --- | --- |
| `#/`, `#/sedes/:id`, `#/servicios/:id` | M01 Información / primera visita | visitante |
| `#/reservar` | M02 Reserva | paciente / responsable |
| `#/mis-turnos` | M03 Mis turnos | paciente / responsable |
| `#/whatsapp` | M06 WhatsApp local | paciente / recepción |
| `#/llamada` | M07 Llamada simulada | paciente |
| `#/aprender` | M15 Exploración educativa | paciente |
| `#/admin` | M04 Hoy / agenda (día, semana, lista) | recepción |
| `#/admin/bandeja` | M05 Bandeja | recepción |
| `#/admin/personas`, `#/admin/personas/:id` | M08 Ficha / familia | recepción / profesional |
| `#/admin/odontograma`, `#/admin/personas/:id/odontograma` | M09 Odontograma | profesional |
| `#/admin/ortodoncia` | M10 Continuidad de ortodoncia | profesional / recepción |
| `#/admin/presupuestos` | M11 Presupuestos y caja ficticia | profesional / dirección |
| `#/admin/espera` | M12 Espera y recordatorios | recepción |
| `#/admin/tareas`, `#/admin/informes` | M13 Tareas / informes | recepción / dirección |
| `#/admin/config` | M14 Configuración / simulador | dirección / operador |

Los roles son **vistas de muestra**, nunca seguridad.

## Arquitectura

```
src/
  domain/            # puro, sin React
    types.ts         # entidades normalizadas (Clinic … DemoScenario)
    time.ts          # reloj determinista UTC-03:00, sin Date.now
    seed.ts          # fixture dentalos-v1 (18 citas, 12 personas…)
    scheduling.ts    # [inicio, fin): profesional + sillón + sede, jornada, bloqueos, 2 h, 30 días
    commands.ts      # comandos atómicos e idempotentes (commandId), outbox, tareas, auditoría
    chat.ts          # intenciones locales del WhatsApp simulado
    selectors.ts     # KPIs derivados con denominador y n=0
    presets.ts       # escenarios aislados
    storage.ts       # envelope versionado, validación, namespace propio
    learning.ts      # 3 tarjetas educativas
  app/               # store (useSyncExternalStore), router hash, estado de UI y borradores
  ui/                # kit accesible, drawers, reprogramación, tonos
  pages/public|admin # 15 módulos
tests/e2e/           # Playwright
```

Cada comando se ejecuta sobre una copia (`structuredClone`); sólo si valida se sustituye el estado. Los resultados se guardan por `commandId` (reintentos/doble clic devuelven el mismo resultado) y además se detectan duplicados semánticos. Es una transacción local, no una garantía distribuida.

Persistencia: `localStorage["dentalos.demo.v1"]` con `{schemaVersion, seed, clock, revision, state}`; UI/borradores en `dentalos.demo.v1:ui`. Corrupción → aviso + restaurar o descargar copia; sin acceso o cuota → modo memoria con aviso. Reset borra **solo** ese namespace. Pensado para **una pestaña**: si otra pestaña cambia la revisión, se avisa y se elige.

## Guion de 90 segundos

1. **Inicio (10 s)** – “Cada consulta tiene un próximo paso”: Martina (P-001) ve su control del jueves 22 10:00.
2. **WhatsApp (35 s)** – escribir “Hola” (menú, nada se crea) → “Quiero cambiar mi turno” → elegir el control → “Mismo horario: mar 20/10 · 10:00” → **ocupado**, “Conservamos tu turno anterior” → elegir **mar 20/10 · 11:00** (o mié 21/10 · 15:00) → revisar antes/después (v1 → v2) → **Confirmar cambio**.
3. **Mis turnos (10 s)** – mismo `A-0012`, versión 2, recordatorio anterior anulado.
4. **Recepción (20 s)** – Ver panel de la clínica → fecha 20/10: `A-0012 v2` en agenda; detalle con outbox (v1 anulado, v2 programado) y auditoría.
5. **Cierre (15 s)** – Configuración → preset “Fallo al guardar” para mostrar que un error no pierde el turno, o “Restablecer demo”.

## Presets

`inicial`, `primera_visita`, `profesional_ocupado`, `sillon_ocupado`, `duracion_insuficiente`, `fuera_jornada`, `agenda_llena`, `ventana_12h`, `fallo_commit`, `vacio`, `dos_ofertas`, `storage_invalido`. Detalle y casos cubiertos en Configuración → Escenarios y en `src/domain/presets.ts`.

## Assets y licencias

Ver [`docs/assets-licenses.md`](docs/assets-licenses.md). Manrope y Source Sans 3 (OFL-1.1) empaquetadas localmente vía `@fontsource`; íconos y logo propios en SVG inline.
