# Requisitos con trazabilidad (SDD)

Estados: `especificado`, `construido`, `probado`, `pendiente`, `bloqueado`. Ninguna fila marcada `especificado` o `pendiente` está construida.

| ID | Requisito | Fuente | Roles | Escenarios | Componente | Aceptación | Evidencia esperada | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-STB-01 | La suite e2e no tiene fallas intermitentes por reloj ni por carga | L1 · D-J4 | — | — | `tests/e2e/premium.spec.ts` (`pausedClock`) | Subconjunto afectado 60/60 con 4 workers; suite completa en verde 5 veces seguidas | `estabilidad.md`, registro de corridas | probado |
| R-STB-02 | Matriz SDD, inventario y recorridos con IDs, sin colisiones con S01–S48/A01–A10 | L1 | — | — | `docs/spec/*` | Cada lote L2–L10 referencia IDs de este archivo antes de codificar | este directorio | construido |
| R-VIS-01 | Investigación por familia de componentes (header, agenda, reserva, odontograma, chat, teléfono, tablas, loading, área familiar, juego) con fuentes accesibles | L2 · D-C2 | — | — | `docs/spec/referencias.md` | Cada referencia dice qué se estudió y si fue visto o solo leído; sin afirmar búsqueda sin acceso | documento: 13 familias; 11 con búsqueda (solo resúmenes, ninguna página abierta: `WebFetch` sin DNS) y 2 por criterio propio declarado | construido |
| R-VIS-02 | Tres propuestas comparables sobre el mismo contenido: Inicio paciente, Hoy/agenda, Reservar en 390 px; claro y oscuro; header limpio, loader, teléfono, muestra SVG y motion | L2 · D-C2 | visitante, recepción | — | ruta aislada `#/propuestas` (`src/pages/proposals/`) | Capturas reales de 3 × 3 pantallas × 2 modos; contrastes medidos; ninguna aprobada por defecto | `src/pages/proposals/contrast.test.ts` (91, peor caso sobre todos los fondos) + `tests/e2e/proposals.spec.ts` (3) + capturas revisadas de 3 propuestas × 4 pantallas × 2 modos y 390 px | probado |
| R-VIS-03 | Elección registrada de Ignacio (pueden combinarse o corregirse); tokens congelados tras la elección | L2 | — | — | `docs/spec/direccion.md` (nuevo) | Texto de la elección con fecha; sin elección no se avanza a L3 en lo visual | `docs/spec/direccion.md` (elección A del 17/10/2026 con dos correcciones) | probado |
| R-VIS-04 | Corrección de Ignacio: la reserva elige fecha con un calendario mensual de verdad | Elección L2 (17/10) | visitante, paciente | S56 | `src/ui/Calendar.tsx`, `Booking.tsx` | Mes completo con horarios libres por día; días sin atención apagados con motivo; teclado de grilla; los horarios mostrados son del día elegido | e2e S56 + capturas 1440/390/320 | probado |
| R-VIS-05 | Corrección de Ignacio: mensajes del chat con forma de chat (burbujas, hora dentro, separador por día) | Elección L2 (17/10) | visitante, paciente | S57 | `WhatsApp.tsx`, `app.css` | Burbujas con cola y agrupación; hora y estado simulado accesibles; sin perder “(simulado)” | e2e S57 + capturas claro/oscuro | probado |
| R-SHL-01 | Indicador DEMO compacto con explicación y avisos contextuales junto a canales y comprobantes simulados; reemplaza la franja técnica | L3 · D-C1 | todos | S49 | `App.tsx` (franja), nuevo `DemoBadge` | El header solo tiene marca, navegación y acciones; a 320/390 px la franja no ocupa más de una línea compacta | `tests/e2e/shell-demo.spec.ts` S49 + `smoke`/`native` actualizados + capturas 320/390/1440 | probado |
| R-SHL-02 | Loading inicial honesto, skeletons, error de chunk con reintento | L3 · D-E3 | todos | S50 | `LoadingState`, `App.tsx` | Sin tiempo mínimo ficticio; simular fallo de carga muestra error y reintento que recupera | `index.html` (carga inicial sin tiempo mínimo) + `lazyRetry` en `App.tsx`; e2e S50 (fallo simulado → reintento sin recarga) | probado |
| R-SHL-03 | Selector inicial opcional de rol (visitante, paciente, recepción, profesional, dirección) con descripción; se recuerda; se puede cambiar | L3 · D-A3, D-H1 | todos | S51, S52 | nuevo `RoleGate`; `ui-state.ts` | Primera visita → elige → llega a su ruta; regreso conserva; cambiar rol conserva datos y preferencias | `RoleGate` en `src/app/DemoShell.tsx`; e2e S51 ×2 y S52 | probado |
| R-SHL-04 | Botonera flotante inferior derecha: rol, caso, guía/retomar, trailer (solo si existe), ayuda, sonido, reinicio con confirmación | L3 · D-H2 | todos | S53, S54 | nuevo `DemoDock` | Operable por teclado; no tapa CTA, teclado virtual ni bottom bar a 320/390 px; reinicio borra solo el namespace propio | `DemoDock`: vista, caso, ayuda, sonido y reinicio; e2e S53, S54 ×2 y a11y por teclado. Guía y tráiler todavía no existen (L9/L10): no se muestran | construido |
| R-SHL-05 | Sistema visual elegido aplicado a portal y panel, claro y oscuro, sin destellos | L3 · D-C3 | todos | S55 | `app.css`, `kit.tsx` | Tokens semánticos de la dirección aprobada; contraste AA en ambos temas | `src/styles/app.css` (tokens A) + `contrast.test.ts` 100/100 + e2e de contraste por ruta en ambos temas | probado |
| R-ART-01 | Revisión del arte existente (odontograma v4, `dentition.tsx`, `teeth.tsx`, Brisitos) ajustada a la dirección elegida sin reemplazar arte bueno por genérico | L4 · D-D1, D-D2 | — | S59 | `src/ui/art/*` | Galería renderizada a tamaño de uso, claro y oscuro, revisada pieza por pieza | capturas | pendiente |
| R-ART-02 | Familia SVG nueva: selector de rol, botonera, teléfono, ticket QR, campañas, guía, cierre, juegos | L4 · D-D3 | — | S60 | `src/ui/art/*` nuevo | IDs únicos (`useId`), viewBox correcto, decorativos `aria-hidden`, semánticos con título; sin colisiones | prueba unit de IDs + capturas | pendiente |
| R-ART-03 | Piezas anatómicas separadas de la caricatura infantil; fidelidad anatómica marcada como pendiente de revisión odontológica | L4 | — | — | docs + rótulo | Ningún texto afirma precisión médica | revisión de textos | pendiente |
| R-MOK-01 | Mockup interactivo de teléfono/chat/llamada y reproductor de escenas con botón visible “Ampliar / Pantalla completa” y “Restaurar / Cerrar” | L4 | todos | S61, S62 | nuevo `ExpandableSurface` | Mismo componente y mismo estado al ampliar (sin reiniciar ni duplicar comandos); Fullscreen API solo tras gesto y si hay soporte; si no, modo expandido en la página | e2e (emulación Chromium) + capturas | pendiente |
| R-MOK-02 | Pantalla completa adaptable: legible, controles táctiles, orientación, safe areas, teclado virtual, scroll útil; Escape y salida visible; restaura foco y posición | L4 | todos | S63, S64 | `ExpandableSurface` | No usa `history.back` indiscriminado; sin scrim decorativo en modo ampliado; no se afirma prueba en iPhone/Safari reales | e2e | pendiente |
| R-FLW-01 | Completar brechas funcionales detectadas en los 15 módulos sin rehacerlos | L5 | todos | S67–S70 | módulos existentes | Cada brecha se lista antes de tocarla y cierra con prueba | e2e | pendiente |
| R-FLW-02 | Presupuestos: ver, consultar, aceptar administrativamente; saldo/pago simulado aparte; un menor no acepta tratamientos | L5 · D-A6 | paciente, recepción, dirección | S71, S72 | `Estimates.tsx` | Aceptado ≠ pago; el aceptante es el responsable ficticio | unit + e2e | pendiente |
| R-KID-01 | Brisa Chicos conservado y mejorado (personajes, juego con/sin reloj, álbum, estados) | L5 · D-A7 | paciente (familia) | S73 | `Kids.tsx` | Las pruebas actuales de `premium.spec` siguen en verde | e2e | pendiente |
| R-KID-02 | Segunda actividad distinta del juego actual (memoria de personajes o puzzle de sala); se elige tras revisar el juego actual | L5 | paciente (familia) | S74–S76 | nuevo `src/pages/public/kids*` | Inicio, reglas, juego, progreso, éxito, reintento, pausa, salida, táctil y teclado, alternativa sin tiempo; claro/oscuro | unit (lógica) + e2e | pendiente |
| R-KID-03 | Gamificación cosmética, opcional, no clínica: sin ranking de salud, culpa, premios por procedimientos, presión de compra, datos reales de menores, chat ni microtransacciones | L5 | — | S77 | textos y reglas | Revisión de copy; ninguna recompensa se liga a aceptar un tratamiento | revisión + e2e de textos | pendiente |
| R-GRW-01 | Segmentos administrativos desde fixtures: controles YA indicados pendientes, presupuestos sin respuesta, consultas sin turno, reprogramaciones; preferencia de contacto, exclusión, baja y frecuencia máxima | L6 · D-G2 | dirección, recepción | S79–S82 | nuevo dominio `campaigns` | Los conteos salen del store; excluidos y bajas no aparecen en la audiencia | unit | pendiente |
| R-GRW-02 | Campañas individuales/segmentadas/masivas; manuales/programadas/por evento; calendario semanal/mensual/bimestral/estacional; borrador → preview → aprobación → activación simulada → pausa | L6 | dirección | S83–S86 | nueva pantalla de campañas | Cada transición es un comando del store; la programación es solo simulada | unit + e2e | pendiente |
| R-GRW-03 | Antes de activar: audiencia elegible, capacidad de agenda, costo de comunicación, costos variables y contribución proyectada; faltantes → ND y borrador | L6 · D-G3 | dirección | S87–S90 | `campaigns/economics.ts` (nuevo) | Contribución = ingreso neto − costo de servicio − otros variables; % = contribución/ingreso neto; equilibrio = ceil(costo fijo/contribución>0); contribución ≤ 0 → sin equilibrio | unit con el ejemplo 100−60−5=35 → con descuento 10: 25 (27,8 %) → fijo 100 → 4 atenciones | pendiente |
| R-GRW-04 | Proyectado, simulado y observado separados; turno reservado ≠ atención realizada ≠ cobro; la atribución no prueba causalidad | L6 | dirección | S91 | Reports / campañas | Los tres rótulos aparecen y no se suman | e2e | pendiente |
| R-GRW-05 | Asistente de dirección determinista conectado al store (controles pendientes, capacidad, datos faltantes, costo de campaña); explica el cálculo, pide faltantes, crea borrador sin activar | L6 · D-G4 | dirección | S92–S94 | nuevo `assistant` determinista | Sin LLM ni respuestas precargadas contradictorias; las cifras salen del estado | unit + e2e | pendiente |
| R-GRW-06 | Asistente del paciente amplía WhatsApp: horarios, turno propio, presupuesto, seguimiento; lo clínico se deriva sin decidir gravedad | L6 · D-G5 | paciente | S95, S96 | `chat.ts` | Texto clínico → derivación (ya existe S31); sin diagnóstico | unit + e2e | pendiente |
| R-GRW-07 | Mensajes discretos: sin diagnóstico ni detalle sensible, sin miedo ni urgencia inventada, sin ranking de pacientes por rentabilidad | L6 | — | — | plantillas | Revisión de plantillas | revisión | pendiente |
| R-QR-01 | Turno con código legible (ID + versión) y QR local del mismo registro; payload mínimo sin datos personales ni secretos | L7 · D-I3 | paciente | S97–S99 | nuevo `src/domain/ticket.ts`, `TicketCard` | El QR codifica solo ruta/ID/versión; librería local sin CDN | unit (codificación) + captura | pendiente |
| R-QR-02 | Recepción registra llegada por cámara (solo tras acción explícita), ingreso manual o muestra simulada; sin almacenar ni transmitir imágenes | L7 | recepción | S100–S103 | nuevo `ArrivalDesk` | La cámara no se pide al abrir; el fallback manual es completo | e2e (manual/muestra); cámara real solo si el entorno lo permite | pendiente |
| R-QR-03 | Estados: válido, inválido, desconocido, otra sede, cancelado, vencido, ya registrado, versión vieja tras reprogramar, eliminado por reset | L7 | recepción | S104–S108 | `ticket.ts` | Cada estado muestra mensaje y no cambia el estado del turno salvo “válido” | unit + e2e | pendiente |
| R-QR-04 | Registrar llegada una sola vez; reescanear no duplica ni marca atendido ni pagado; una reprogramación invalida la confirmación obsoleta | L7 | recepción | S109 | comando nuevo de llegada | Idempotente por commandId | unit | pendiente |
| R-QR-05 | QR para compartir clínica y campaña: generar, previsualizar, descargar, imprimir, condiciones legibles; no es credencial de acceso ni prueba de pago | L7 · D-I4 | dirección | S110, S111 | `ShareQr` | Texto explícito “no confirma pago ni sincroniza dispositivos” | e2e | pendiente |
| R-MOT-01 | Spec de motion por pieza (propósito, disparador, estados, duración/easing, interrupción, reduced motion, fallback) | L8 · D-E4 | — | — | `docs/spec/motion.md` (nuevo) | Una fila por pieza antes de animarla | documento | pendiente |
| R-MOT-02 | Animaciones transaccionales ligadas a comandos exitosos: solicitud (no confirmación), confirmación (código/QR, sin pago), reprogramación (mismo ID, versión), llegada por QR, aceptación de presupuesto (no pago), celebración infantil discreta | L8 | paciente, recepción, dirección | S113–S120 | `src/ui/motion/*` (nuevo) | Duran ~1–3 s, no bloquean, se pueden interrumpir sin revertir ni duplicar; error o conflicto nunca muestra éxito | e2e con reloj pausado + clips | pendiente |
| R-MOT-03 | Fondos y loaders con propósito, sin saltos de layout, con presupuesto de rendimiento y limpieza de timers/listeners | L8 · D-E1 | — | S121 | `app.css`, ambient | Sin timers vivos al salir de la pantalla | e2e + medición | pendiente |
| R-CLL-01 | Motivos sonoros por intervención/estado en la llamada (más allá de “habla” y “guardado”); opt-in, mute, volumen; transcripción siempre suficiente | L8 · D-G6 | paciente | S122, S123 | `tones.ts` | AudioContext solo tras gesto; sin audio el flujo es completo | e2e con AudioContext instrumentado (como S34–S38) | pendiente |
| R-CLL-02 | Visualizador propio de la llamada sincronizado con el sintetizador (analizador o envolvente compartida); con sonido silenciado, línea de tiempo simulada rotulada; estados explícitos; turnos distinguibles por forma y etiqueta | L8 | paciente | S124–S126 | nuevo `CallVisualizer` | Reposo en silencio/pausa/fin; sin onda infinita; reduced motion → indicador estático + texto; sin micrófono | e2e + capturas | pendiente |
| R-CLL-03 | Controles de llamada: turno activo resaltado, mute/volumen/pausa/reinicio/finalizar y pantalla completa que conserva la llamada | L8 | paciente | S127 | `CallSim.tsx`, `ExpandableSurface` | Ampliar y restaurar no reinicia la llamada; cerrar detiene audio, animación y timers | e2e | pendiente |
| R-THM-01 | Temporadas independientes de claro/oscuro: fiestas/horarios, vacaciones, comunicación de controles ya indicados; inicio/fin, preview y restauración; cambia arte y motion con mesura | L8 · D-F2 | dirección | S128 | nuevo `themes` | El tema no modifica precios ni prescribe controles; sin alarmismo ni estética intrusiva en pantallas operativas | e2e + contraste en ambos modos | pendiente |
| R-SCN-01 | Motor declarativo de escenas: precondición, fixture, brief, comando, resultado, evidencia, pausa, recuperación, limpieza; estados listo/ejecutando/pausado/completado/error/cancelado; correlationId | L9 · D-H3 | todos | S129–S132 | nuevo `src/demo/scenes` | Corre solo comandos reales del store; repetir no duplica; salir limpia efectos y conserva lo confirmado | unit + e2e | pendiente |
| R-SCN-02 | Ocho casos: WhatsApp→solicitud; llamada→alternativa→confirmación; recordatorio→reprogramación→recordatorio previo anulado; cancelación→tarea de seguimiento (hoy `cancel` solo cierra tareas: la tarea nueva es trabajo de L9); presupuesto aceptado→seguimiento; control de ortodoncia→tarea→turno; QR→llegada; campaña→respuesta→reserva con economía visible | L9 | todos | S133–S140 | biblioteca de casos | Cada caso deja un registro explorable por rol y su ID visible | e2e con reloj pausado | pendiente |
| R-SCN-03 | Teléfono premium sobre la app visible sin opacar el fondo, con resalte del registro real; briefs de 5–10 s con pausa/siguiente/repetir/velocidad/salida; avance manual con reduced motion | L9 · D-H4 | todos | S141–S143 | `ScenePlayer` | Fondo visible; controles siempre accesibles | e2e + capturas | pendiente |
| R-SCN-04 | Repetir caso no duplica; cambiar de rol conserva el resultado | L9 · D-H5 | todos | S144 | motor | `commandId`/`correlationId` estables | e2e | pendiente |
| R-GDE-01 | Guía completa por roles y capítulos (índice, progreso, módulos, práctica, errores, QR, seguimiento/economía, simulaciones, adaptación); omitir, rechazar y retomar; rechazo recordado | L9 · D-I1 | todos | S145, S146 | nuevo `Guide` | No sustituye a `Learn.tsx`; un capítulo visitado no equivale a tarea completada | e2e | pendiente |
| R-CLS-01 | Cierre Eclipse a pantalla completa: paquete, incluidos/excluidos, implementación, anticipo/saldo, mensualidad, opcionales, plazos “a confirmar” si no están validados, URL de Eclipse verificada; cerrable con Escape; no reaparece en medio de una operación | L9 · D-I2 | todos | S147, S148 | nuevo `EclipseClose` | Importes solo del tarifario vigente leído; no copia importes históricos | e2e + revisión contra tarifario | bloqueado (espera tarifario/URL validados) |
| R-TRL-01 | Trailer solo reproducible si existe; sin CTA roto | L9 · L10 | — | — | `DemoDock` | Botón deshabilitado con explicación si no hay archivo | e2e | pendiente |
| R-QA-01 | QA completo: lint, typecheck, unit, build, e2e; 320/390/768/1440; claro/oscuro/temporadas; roles; juegos; SVG; mockups; escenas; teclado/foco; contraste; zoom 200 %; reduced motion; errores; storage corrupto; reset; timers | L10 · D-J1–D-J3 | todos | S149–S156 | suite | Pruebas obsoletas actualizadas con justificación, nunca borradas para lograr verde | salida de comandos + capturas | pendiente |
| R-QA-02 | Tabla de jornadas de Configuración utilizable a 390 px (lista adaptable o scroll interno evidente) | L10 · D-C5 | dirección | S157 | `Settings.tsx` | Sin recorte a la derecha | captura + e2e | pendiente |
| R-QA-03 | Rendimiento medido en el build (carga inicial e interacciones), no solo gzip; sin solicitudes externas ni errores de consola | L10 · D-J2 | — | S158 | medición | Valores reportados con método y límites | medición | pendiente |
| R-QA-04 | Crítica visual contra la dirección aprobada y correcciones antes del kit | L10 | — | — | capturas | Lista de desviaciones y su cierre | documento | pendiente |
| R-KIT-01 | Trailer 30–60 s con pantallas reales (consulta → turno → recepción → continuidad → dirección), subtítulos; guion, storyboard y render reproducible; si no hay herramienta de video, “render pendiente” | L10 · D-K1 | — | — | `docs/kit/*` (nuevo) | No llamar “trailer terminado” a un storyboard | archivos | pendiente |
| R-KIT-02 | HTML de email (consultorio con recepción propia, clínica pequeña) + texto plano; responsive, sin JavaScript ni video embebido; enlaces solo a la versión que contiene lo mostrado | L10 · D-K2, D-K3 | — | — | `docs/kit/*` | Enlaces verificados; si el deploy no corresponde, envío bloqueado; nada se envía | archivos | bloqueado (URL publicada no verificable) |

## Correspondencia con la auditoría (D-IDs)

| D-ID | Estado en la auditoría | Requisito(s) que lo cubren | Lote |
| --- | --- | --- | --- |
| D-A1 | verificado | conservar (S01–S48) | — |
| D-A2 | verificado | conservar; se amplía en R-SCN-04 | — |
| D-A3 | sin verificar a fondo | R-SHL-03 | L3 |
| D-A4 | verificado | conservar; R-ART-01 | L4 |
| D-A5 | verificado | conservar | — |
| D-A6 | verificado | R-FLW-02 | L5 |
| D-A7 | verificado | R-KID-01 | L5 |
| D-B1–D-B4 | verificado | conservar | — |
| D-B3 | verificado | R-SCN-01 (presets en la biblioteca) | L9 |
| D-C1 | parcial | R-SHL-01 | L3 |
| D-C2 | no iniciado | R-VIS-01, R-VIS-02, R-VIS-03 | L2 |
| D-C3 | verificado | conservar; R-SHL-04 (convivencia con la botonera) | L3 |
| D-C4 | parcial | R-ART-02, R-MOK-01 | L4 |
| D-C5 | sin verificar | R-QA-02 | L10 |
| D-D1 | revisado | R-ART-01 | L4 |
| D-D2 | revisado | R-ART-01 | L4 |
| D-D3 | no iniciado | R-ART-02 | L4 |
| D-E1 | verificado | R-MOT-03 | L8 |
| D-E2 | verificado | conservar | — |
| D-E3 | parcial | R-SHL-02 | L3 |
| D-E4 | no iniciado | R-MOT-01, R-MOT-02 | L8 |
| D-F1 | verificado | conservar; R-SHL-05 | L3 |
| D-F2 | no iniciado | R-THM-01 | L8 |
| D-G1 | verificado | conservar | — |
| D-G2 | no iniciado | R-GRW-01, R-GRW-02 | L6 |
| D-G3 | no iniciado | R-GRW-03, R-GRW-04 | L6 |
| D-G4 | no iniciado | R-GRW-05 | L6 |
| D-G5 | verificado (WhatsApp) | R-GRW-06 | L6 |
| D-G6 | parcial | R-CLL-01 | L8 |
| D-H1 | no iniciado | R-SHL-03 | L3 |
| D-H2 | no iniciado | R-SHL-04 | L3 |
| D-H3 | no iniciado | R-SCN-01, R-SCN-02 | L9 |
| D-H4 | no iniciado | R-SCN-03 | L9 |
| D-H5 | parcial | R-SCN-04 | L9 |
| D-I1 | no iniciado | R-GDE-01 | L9 |
| D-I2 | no iniciado | R-CLS-01 | L9 |
| D-I3 | parcial | R-QR-01–R-QR-04 | L7 |
| D-I4 | no iniciado | R-QR-05 | L7 |
| D-J1 | verificado (Chromium) | conservar; R-QA-01 | L10 |
| D-J2 | parcial | R-QA-03 | L10 |
| D-J3 | no iniciado | R-QA-01 | L10 |
| D-J4 | parcial | R-STB-01 | L1 |
| D-K1 | no iniciado | R-KIT-01 | L10 |
| D-K2 | no iniciado | R-KIT-02 | L10 |
| D-K3 | sin verificar | R-KIT-02 (enlaces) | L10 |
