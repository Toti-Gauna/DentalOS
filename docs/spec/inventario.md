# Inventario medido (main @ 73c5e75 + corrección de estabilidad del lote 1)

Todo lo de esta página se leyó en el código o se ejecutó en esta sesión. Lo que no pudo comprobarse figura como tal.

## Rutas (hash, `src/app/App.tsx › route()`)
| Ruta | Pantalla | Módulo |
| --- | --- | --- |
| `#/` | Home | M01 |
| `#/sedes/:id` · `#/servicios/:id` | LocationPage · ServicePage | M01 |
| `#/reservar` | Booking | M02 |
| `#/mis-turnos` | MyAppointments | M03 |
| `#/whatsapp` | WhatsApp | M06 |
| `#/llamada` | CallSim | M07 |
| `#/aprender` | Learn | M15 |
| `#/chicos` | Kids (escena de Brisitos, juego, reloj de cepillado, cuento, álbum) | parte de M15 |
| `#/admin` | Today (hoy y agenda) | M04 |
| `#/admin/bandeja` | Inbox | M05 |
| `#/admin/personas` · `…/:id` · `…/:id/odontograma` | People · PersonDetail · Odontogram | M08, M09 |
| `#/admin/odontograma` | OdontogramPicker | M09 |
| `#/admin/ortodoncia` | Ortho | M10 |
| `#/admin/presupuestos` | Estimates (presupuestos y caja ficticia) | M11 |
| `#/admin/espera` | Waitlist | M12 |
| `#/admin/tareas` · `#/admin/informes` | Tasks · Reports | M13 |
| `#/admin/config` | Settings (jornadas, duraciones, bloqueos, automatizaciones, escenarios) | M14 |
| `#/propuestas` | Proposals (lote 2: tres propuestas visuales; ruta aislada sin el marco de la app, chunk diferido) | — |
Cualquier otra ruta → NotFound.

## Roles (vistas, no seguridad) — `ROLES` en `App.tsx`
visitante → `/` · paciente/responsable → `/mis-turnos` · recepción → `/admin` · profesional → `/admin/ortodoncia` · dirección → `/admin/informes`. Hoy el selector vive en el popover “Controles de la demo” de la franja superior.

## Dominio (`src/domain`, ≈ 3.000 líneas con `src/app`)
- **Comandos del store** (`commands.ts`, 832 líneas, 49 tipos): `book`, `reschedule`, `cancel`, `confirmAppointment`, `patientConfirm`, `transition`, `requestHumanChange`, `createRequest`, `updateRequest`, `chatStaffReply`, `createTask`, `updateTask`, `createPerson`, `updatePerson`, `setReminderOptIn`, `addBlock`, `removeBlock`, `updateRule`, `updateServiceDuration`, `setAutomationRule`, `setSetting`, `advanceClock`, `toothMark`, `toothUndo`, `toothDone`, `episodeIndicateControl`, `episodeNote`, `episodeSetAppliance`, `estimateCreate`, `estimateAddLine`, `estimateRemoveLine`, `estimateTransition`, `estimateFollowUp`, `ledgerRecord`, `ledgerReverse`, `waitlistAdd`, `waitlistRemove`, `offerCreate`, `offerAccept`, `offerReject`, `learningOpen`, `learningAnswer`, `learningComplete`, `learningReset`, `callSave`, `chatSend`, `chatChoose`, `chatOpen`, `chatLinkRequest`.
- **Seed `dentalos-v1`:** 12 personas (P-001…P-012), 18 turnos (A-0001…), 2 sedes (L-CEN, L-NOR), 4 profesionales (PR-01…04), 3 sillones (CH-1…3), 6 motivos (ST-PRIMERA, ST-CONTROL, ST-LIMPIEZA, ST-TRAT, ST-ORTO-CONS, ST-ORTO-CTRL), 2 episodios de ortodoncia, reloj fijo 2026-10-19T09:00 (-03:00).
- **Presets aislados:** 12 (`inicial`, `primera_visita`, `profesional_ocupado`, `sillon_ocupado`, `duracion_insuficiente`, `fuera_jornada`, `agenda_llena`, `ventana_12h`, `fallo_commit`, `vacio`, `dos_ofertas`, `storage_invalido`).
- **Automatizaciones:** A01–A10 (`seed.ts`), configurables desde Configuración; solo A05, A06 y A09 se pueden pausar.
- **Persistencia:** `localStorage["dentalos.demo.v1"]` (estado) y `…:ui` (rol, tema, sonido, borradores). Reset borra solo ese namespace.
- **Sin equivalente hoy:** entidad de campaña/segmento/costo, código o QR de turno, escena guiada, temporada.

## UI (`src/ui`, `src/pages`)
- `kit.tsx`, `components.tsx`, `CommandPalette.tsx`, `ThemeSwitcher.tsx`, `AppointmentPanel.tsx`, `RescheduleDrawer.tsx`, `OdontogramArch.tsx`, `sound.ts` (efectos de interfaz), `tones.ts` (ToneEngine de la llamada: tonos “habla” y “guardado”).
- **Arte** (`src/ui/art`): `teeth.tsx` (lateral, 13 estados × 4 piezas), `dentition.tsx` (oclusal, arcadas, sonrisa con aparatología), `ortho.tsx`, `characters.tsx` (Brisitos), `kids.tsx` (diente, bichito, boca y estrellas del juego), `pages.tsx`, `services.tsx`, `brand.tsx`.
- **Juegos:** Kids tiene dos actividades: “Cazá los bichitos” (con reloj de 30 s o sin apuro, lógica pura con semilla en `kidsGame.ts`) y el reloj de cepillado de 2 min o demo de 20 s. Más cuento de 5 pasos, escena grupal de los 4 Brisitos y álbum de 8 stickers. **No hay todavía una segunda actividad distinta** (requisito R-KID-02).
- **Estilos:** `src/styles/app.css` (1.177 líneas), tokens con `light-dark()`.
- **Shell actual:** franja superior de demo (banner largo, Portal/Panel, “Demo”), cabecera de producto con menú, barra lateral agrupada en el panel, pie con “Ver panel demo” y bottom bar en móvil (≤ 860 px).

## Pruebas
- **Unit (Vitest):** 154 — dominio 46, contraste 100 (ambos temas, peor caso del fondo animado), juego 8.
- **E2E (Playwright, Chromium):** 63 + 1 omitida a propósito (capturas). Archivos: a11y, coverage, flows, native, premium, shell, smoke, theme, evidence.
- **Sin cobertura:** Firefox, Safari, dispositivo físico, lector de pantalla.

## Medido en esta sesión
lint 0 · typecheck 0 · unit 154/154 · build 0 (entrada 544 kB JS, 163 kB gzip, CSS 92 kB). La web publicada en GitHub Pages no se pudo abrir desde el entorno (proxy 403 a github.io): **runtime publicado no verificado**; solo consta el run de CI/deploy 39030824772 en success.
