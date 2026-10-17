# Recorridos (sobre rutas y comandos reales)

Cada paso nombra la ruta (`#/…`) y el comando del store (`commands.ts`) que ya existen, o marca **[nuevo]** lo que falta. Un paso existente se conserva; los nuevos se cubren en `requisitos.md`.

## 1 · Primera consulta
Descubre la clínica → consulta simulada → disponibilidad → turno → recepción.

| # | Paso | Ruta / comando | Estado hoy |
| --- | --- | --- | --- |
| 1 | Conoce la clínica y los motivos | `#/`, `#/sedes/:id`, `#/servicios/ST-PRIMERA` | existe (M01) |
| 2 | Consulta por chat o llamada simulada | `#/whatsapp` (`chatSend`, `chatChoose`), `#/llamada` (`callSave`) | existe (M06, M07) |
| 3 | Ve disponibilidad | `#/reservar` (`findSlots`) | existe (M02) |
| 4 | Solicita el turno (queda solicitado, no confirmado) | `book` | existe (S02, S06, S07) |
| 5 | Recepción lo ve y lo confirma | `#/admin`, `#/admin/bandeja` · `confirmAppointment` | existe (S17) |
| 6 | Código legible y QR del turno | **[nuevo]** R-QR-01 | falta |
| 7 | Animación de “solicitud recibida” | **[nuevo]** R-MOT-02 | falta |

Variantes: profesional ocupado (S08), sillón ocupado (S09), duración insuficiente (S10), fuera de jornada (S11), agenda llena con espera (S12).

## 2 · Paciente existente
Próximo turno → confirma o reprograma → conserva ID y versiona → recordatorio anterior anulado.

| # | Paso | Ruta / comando | Estado hoy |
| --- | --- | --- | --- |
| 1 | Ve su próximo turno con cuenta regresiva | `#/mis-turnos` | existe |
| 2 | Confirma | `patientConfirm` | existe (A07) |
| 3 | Reprograma por WhatsApp o llamada | `reschedule` | existe (S13, S29, S33, A03, A04) |
| 4 | Mismo ID, versión nueva, recordatorio v1 anulado | store | existe (S13, S22) |
| 5 | Ventana < 12 h → deriva a recepción | `requestHumanChange` | existe (S15) |
| 6 | Cancelación: libera el cupo, anula recordatorios, **cierra** las tareas del turno y, si era un control de ortodoncia, lo deja de nuevo “indicado” | `cancel` | existe (S16) |
| 6b | Tarea administrativa de seguimiento **después** de cancelar | **[nuevo]** hoy `cancel` no crea tareas; se define en R-SCN-02 (caso 4) | falta |
| 7 | Llegada registrada por QR | **[nuevo]** R-QR-02, R-QR-04 | falta |
| 8 | Animación de reprogramación | **[nuevo]** R-MOT-02 | falta |

## 3 · Ortodoncia
Control indicado por el profesional → seguimiento administrativo → reserva.

| # | Paso | Ruta / comando | Estado hoy |
| --- | --- | --- | --- |
| 1 | El profesional indica el control **manualmente** | `#/admin/ortodoncia` · `episodeIndicateControl` | existe (S42) |
| 2 | Queda una tarea `control_indicado` (la crea el propio comando, deduplicada) | `episodeIndicateControl` → `upsertTask` | existe |
| 3 | Se reserva el turno del control | `book` con `ST-ORTO-CTRL` | existe |
| 4 | Aparatología registrada | `episodeSetAppliance` | existe |
| 5 | Segmento “controles ya indicados pendientes” y campaña | `#/admin/campanas` · `segmentMembers('controles_pendientes')`, `campaignCreate` | existe desde L6 (S79, S83) |

El software no decide cuándo corresponde un control ni lo recomienda por rentabilidad.

## 4 · Familia / odontopediatría
El adulto responsable gestiona → espacio infantil opcional → turno.

| # | Paso | Ruta / comando | Estado hoy |
| --- | --- | --- | --- |
| 1 | Responsable ve los turnos de dependientes (Carla P-003 → Tomás P-004, Lola P-005) | `#/mis-turnos`, `#/admin/personas/P-003` | existe (S40) |
| 2 | Pide turno para el dependiente | `book` con `personId` | existe |
| 3 | Espacio infantil opcional | `#/chicos` (escena, juego, reloj, cuento, álbum) | existe |
| 4 | Segunda actividad infantil distinta | `#/chicos` · “Memoria de los Brisitos” (`kidsMemory.ts`, `MemoryGame.tsx`) | existe desde L5 (S74–S76) |
| 5 | Presupuesto: lo ve y lo acepta el responsable, nunca el menor | `#/mis-turnos` (`PatientEstimates`) y `#/admin/presupuestos` · `estimateTransition` con `actorId` | existe desde L5 (S67–S69, S71, S72) |

## 5 · Dirección
Capacidad/seguimiento → campaña administrativa → economía → aprobación.

| # | Paso | Ruta / comando | Estado hoy |
| --- | --- | --- | --- |
| 1 | Informes con denominador y n=0 | `#/admin/informes` | existe |
| 2 | Capacidad y ocupación | informes, `Configuración` | existe |
| 3 | Segmento y campaña (borrador → vista previa → aprobación → activación simulada) | `#/admin/campanas` · `campaignPreview`, `campaignApprove`, `campaignActivate`, `campaignPause` | existe desde L6 (S83–S86) |
| 4 | Economía antes de activar (contribución, equilibrio, ND, capacidad) | `campaignEconomics`, `capacityFor`, `reviewCampaign` | existe desde L6 (S87–S90) |
| 5 | Asistente determinista | `directorAnswer` (`src/domain/assistant.ts`) en `#/admin/campanas` | existe desde L6 (S92–S94) |
| 6 | Resultado simulado → reserva | **[nuevo]** R-SCN-02 (caso 8) | falta |

Todo con datos ficticios; ninguna comunicación, cobro ni medición real.

## Lote 5 · brechas cerradas y recorridos entre vistas

Brechas detectadas al recorrer los 15 módulos, antes de tocarlos:

| Brecha | Dónde | Cierre en L5 |
| --- | --- | --- |
| El portal no mostraba presupuestos: solo recepción los veía | `#/mis-turnos` | `PatientEstimates`: ver líneas y total, “Tengo una consulta” (`estimateFollowUp`), aceptar o no aceptar con confirmación; saldo y pagos simulados aparte de la aceptación |
| La regla “un menor no acepta” era implícita (siempre decidía la propia persona) | `estimateTransition` | `actorId` obligatorio de hecho: menor → `MENOR_NO_DECIDE`, adulto ajeno → `NO_RESPONSABLE`; se guarda `decidedBy` y queda en la auditoría |
| EST-003 era de un menor sin responsable registrado | seed | Vínculo de muestra RL-003 (Ramiro P-006 → Diego P-009) y presupuesto EST-004 de Tomás (P-004) emitido para recorrerlo |
| El juego de bichitos no se podía pausar | `#/chicos` | Pausar / Seguir: el reloj y el tablero se detienen; “Terminar” sigue disponible |
| Una sola actividad de juego | `#/chicos` | “Memoria de los Brisitos” |
| Saltar entre vistas exigía saber rutas y personas | botonera | “Recorridos” con pasos que fijan vista, persona del portal y ruta |

Las brechas restantes ya tienen lote: QR y código (L7), campañas y economía (L6), escenas guiadas (L9), motion (L8).

Recorridos de la botonera (`src/app/journeys.ts`). Solo navegan: no inician sesión ni cambian datos.

| Recorrido | Pasos (vista → ruta) | Escenario |
| --- | --- | --- |
| Un turno de punta a punta | Visitante → `#/reservar` · Recepción → `#/admin` · Paciente (P-001) → `#/mis-turnos` | S67 |
| Presupuesto de un menor | Recepción → `#/admin/presupuestos` · Paciente (Carla P-003) → `#/mis-turnos` · Recepción → `#/admin/presupuestos` | S68, S69 |
| Un mensaje que llega a recepción | Visitante → `#/whatsapp` · Recepción → `#/admin/bandeja` | S70 |
| Brisa Chicos en familia | Paciente (Carla P-003) → `#/mis-turnos` · Paciente → `#/chicos` | S70 |

## Lote 6 · campañas administrativas y asistentes

Recorrido de dirección sobre datos reales del store (todo simulado):

| # | Paso | Ruta / comando | Escenario |
| --- | --- | --- | --- |
| 1 | Ver segmentos con sus conteos | `#/admin/campanas` · `segmentMembers` | S79 |
| 2 | Preguntar al asistente por controles pendientes y crear un borrador | `directorAnswer('controles')` → `campaignCreate` | S92 |
| 3 | Revisar audiencia: baja, exclusión, frecuencia y unificación | `buildAudience` | S80–S82 |
| 4 | Cargar economía; si falta algo, ND y sigue en borrador | `campaignUpdate`, `campaignPreview` | S87–S89 |
| 5 | Capacidad de agenda contra lo proyectado | `capacityFor` | S90 |
| 6 | Aprobar y activar (simulado); pausar o reanudar | `campaignApprove`, `campaignActivate`, `campaignPause`, `campaignResume` | S83–S85 |
| 7 | Ver proyectado, simulado y observado por separado | `campaignResults` | S91 |
| 8 | La persona consulta turno, presupuesto o seguimiento por WhatsApp | `chatSend` / `chatChoose` (`mi_turno`, `presupuesto`, `seguimiento`) | S95, S96 |

La botonera suma el recorrido “Campaña administrativa” (dirección → recepción → paciente).

