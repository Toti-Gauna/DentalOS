# Dirección visual y sistema de componentes (fase 2)

Capturas reproducibles con la seed `dentalos-v1` y el reloj del 19/10/2026 a las 09:00:
- **Antes:** `docs/evidence/before/` (390, 768 y 1440 px).
- **Después:** `docs/evidence/after/` (320, 390, 768 y 1440 px).
- **Regenerar:** `npm run build && EVIDENCE_DIR=docs/evidence/after EVIDENCE_VIEWPORTS=320,390,768,1440 npm run evidence`.

Rutas capturadas: inicio, reserva, mis-turnos, whatsapp, agenda, bandeja, ficha (P-003), odontograma (P-008), presupuestos y aprender.

## L2.1 · Crítica de las pantallas antes de la fase 2

| Pantalla | Problema observado (antes) | Decisión aplicada |
| --- | --- | --- |
| Shell (todas) | A 768 px la barra superior se partía en dos filas. A 390 px banner y barra ocupaban unos 170 px. El enlace “Ver panel de la clínica” estaba suelto. La navegación del portal quedaba escondida tras “Menú”, una acción oculta para pacientes. | Selector de área segmentado (Pacientes / Clínica) con estado `aria-current`. Selector de vista con etiqueta visible “no es inicio de sesión”. El portal mantiene la navegación siempre visible como fila de chips desplazable. El menú plegable queda solo para admin. |
| Inicio / próximo turno | El próximo turno se leía como un párrafo y la fecha no se destacaba. Los motivos no se podían filtrar (M01). | Tarjeta de próximo paso con bloque de fecha (día, número y mes), estado con texto e icono y aviso si es solicitud. Enlace a la misma cita en recepción. Filtro por especialidad con conteo. |
| Mis turnos | Las tarjetas mezclaban códigos y meta en una sola línea. El selector de persona ocupaba todo el ancho. Faltaba el vínculo visual con recepción. | TurnoCard con jerarquía fecha → hora → motivo → profesional/sede/sillón → ID y versión. Selector de persona compacto con chips de dependientes. Aviso tras el cambio con “Ver el mismo turno en recepción”. |
| Reserva | “Desde” era un `input date` suelto y la lista de cupos venía sin agrupar. | DateStrip de 14 días con días “Sin atención” anotados y fecha libre. Cupos agrupados por día. Revisión fija al costado en desktop. Los conflictos dicen qué se conserva. |
| WhatsApp | Espacio inicial en las burbujas. Los mensajes de recepción no se distinguían. El estado en vivo era una lista con códigos. | Burbujas limpias con remitente “Recepción (persona)”. Estado en vivo con TurnoCard y enlace a la agenda. Pista de envío vacío siempre en el mismo lugar (sin saltos). |
| Agenda (Hoy) | Cuatro tiles de KPI empujaban la agenda hacia abajo. Toolbar sin jerarquía. La vista “Día” era una lista sin noción de recursos. | Resumen en línea (no mosaico). DateStrip semanal con conteo por día. Vista **Por profesional** con columnas y filas de 15 min donde el turno ocupa [inicio, fin). Filtros plegables con conteo de activos. En móvil todo es lista diaria. |
| Bandeja | El detalle vivía en una columna vacía y el siguiente paso no se veía en la lista. | Fila con canal, resumen, **Siguiente paso** destacado, responsable y antigüedad. Detalle en drawer que conserva pestaña y filtro. |
| Ficha | La familia era una lista de enlaces y los turnos se mostraban como viñetas. | Grupo familiar navegable por ID (responsable y dependientes con su próximo turno). Turnos como TurnoCard con enlace a la agenda. |
| Odontograma | Cada pieza mostraba puntos sin superficie y la leyenda dependía solo del color. | Glifo de 5 superficies por pieza (V, L, M, D, O/I según cuadrante). Leyenda en texto con el mismo glifo. Resumen por pieza como equivalente en lista. |
| Presupuestos | Total y saldo mezclados en la tabla. | MoneySummary con Presupuestado, Aceptado (“no es cobro”), Movimientos simulados y Saldo separados. |

**Descartes deliberados:**
- **Modo oscuro:** fuera de alcance y duplica la superficie de contraste a medir.
- **Fotos o ilustraciones de stock:** no hay assets con licencia y desvían de la clínica ficticia.
- **Arrastrar y soltar en la agenda:** el arrastre no puede ser el único acceso; se mantienen drawer y teclado.
- **Gráficos en informes:** las tablas con n y denominador comunican mejor en una demo.
- **Barra inferior fija en móvil:** se superpone al teclado virtual y al CTA.
- **Confeti o celebraciones al ganar un sello:** se percibe infantil y premia indebidamente.
- **Calendario mensual en la reserva:** en móvil una lista es más clara que una grilla comprimida.

## Tokens definitivos (`src/styles/app.css`)

| Grupo | Valores |
| --- | --- |
| Color | tinta `#173C3A`, primario `#245E59`, primario fuerte `#1B4A46`, fondo `#F6F4EE`, superficie `#FFF`, arena `#E9DECA`, arena 50 `#F3EDE2`, secundario `#526865`, línea `#D8D3C7`, línea fuerte `#8F897C` (bordes de controles ≥ 3:1), error `#A33131`, aviso `#8A5700`, info `#2D5770`, foco `#1F6FB2` |
| Tipografía | Manrope (títulos/UI) y Source Sans 3 (texto/tablas), locales OFL. Cuerpo 17/16 px en el portal y 15 px en admin. H1 del portal `clamp(30px, 4.6vw, 52px)`, H1 de admin `clamp(22px, 2.4vw, 28px)`. Cifras tabulares |
| Espacio | escala 4/8: 4, 8, 12, 16, 24, 32, 48, 64 |
| Radios | portal 14–16, admin 8–10 |
| Motion | feedback 150 ms, drawer 260 ms, resalte 1600 ms, `cubic-bezier(.2,.7,.2,1)` |
| Ancho | portal ≤ 1120 px; admin ≤ 1440 px con lateral de 228 px y operativa 2/3 + 1/3 |

Medición:
- `src/styles/contrast.test.ts` mide los pares de tokens.
- `tests/e2e/a11y.spec.ts` mide cada texto visible renderizado en 19 rutas a 1440 y 390 px, mezclando capas con alfa. Exige 4.5:1 para texto normal y 3:1 para texto grande.
- Los fondos con gradiente (bloqueos, esqueletos) se omiten y se cuentan.

## Componentes (`src/ui/components.tsx`, `src/ui/kit.tsx`)

| Componente | Uso | Reglas |
| --- | --- | --- |
| `TurnoCard` | Mis turnos, ficha, WhatsApp, lista diaria de la agenda y detalle de cita | Variantes `patient` (bloque de fecha) y `admin` (hora). Siempre muestra hora, tipo, profesional, sede, sillón, estado con texto e icono, ID y versión. `forceHighlight` permite resaltar por enlace. |
| `DateStrip` | Reserva y agenda | Botones con `aria-pressed`, flechas, Inicio y Fin con foco móvil (roving), nota por día (“Cerrado”, “3 turnos”), fecha libre por `input date`. Nunca es el único control. |
| `SummaryStrip` | Agenda | Resumen en línea con valor y detalle. Reemplaza el mosaico de KPI en las vistas operativas. |
| `MoneySummary` | Presupuestos | Presupuestado, aceptado, movimientos y saldo, siempre separados. El saldo solo aparece si el presupuesto fue aceptado. |
| `OutboxPipeline` | Detalle de cita y outbox | Creado (vN) → programado o inmediato → entregado (simulado), anulado, bloqueado o sin cupo. |
| `ConflictNotice` | Reserva y reprogramación | Explica el conflicto y lo que **se conserva** (“Conservamos tu turno anterior…”). |
| `DisabledReason` | Acciones deshabilitadas | Ningún botón deshabilitado queda sin causa visible (`aria-describedby`). |
| `LoadingState` | Carga diferida del panel | Esqueleto breve con `role=status`; nunca bloquea un commit. |
| `EmptyState`, `Notice`, `StatusBadge`, `Drawer`, `ConfirmDialog`, `ErrorSummary`, `Field` | Todos | Estados con texto e icono. Errores inline más un resumen con enlaces. Drawer y diálogo con foco atrapado, Escape y devolución de foco. |
| `ToothGlyph` | Odontograma y leyenda | 5 superficies según cuadrante. Planificado: relleno info con borde. Realizado: relleno primario. |

Estados cubiertos:
- **Vacío:** agenda sin turnos ofrece crear muestra; informes con n=0; colección sin abrir.
- **Carga:** panel en diferido.
- **Error:** storage corrupto o comando rechazado.
- **Conflicto:** reserva y reprogramación.
- **Éxito:** solo después de un cambio real en el store.
- **Deshabilitado con causa:** filtros e “Ir a hoy”.

## Motion causal (L2.4)

- **Duración:** feedback de 150 ms (botones, avisos, burbujas, respuestas) y drawer de 260 ms. El commit nunca espera a la animación.
- **Misma cita resaltada:** el store guarda `lastChange` (transitorio, no se persiste) comparando citas antes y después de cada comando. TurnoCard y la celda de la agenda muestran el resalte y el texto “Actualizado recién”.
- **Enlace portal ↔ recepción:** `#/admin?dia=YYYY-MM-DD&turno=A-0012` abre el día y resalta la cita. Desde recepción, “Ver como lo ve … en el portal” abre Mis turnos con esa persona.
- **Movimiento reducido:** sin animaciones ni traslaciones. El resalte pasa a borde sólido y texto, y el resultado se ve igual.

## Audio (L2.4)

> Fase 2b: además de estos dos tonos de la llamada, hay efectos de interfaz globales opt-in (apagados por defecto). Reglas en [`premium.md`](premium.md#4-sonidos-srcuisoundts).

- **Dos tonos senoidales de 140–170 ms, sin voz ni melodía:**
  - “habla”, 523 Hz: turno del asistente.
  - “guardado”, 659 Hz: commit confirmado.
- **Cuándo se crea el AudioContext:** solo al pulsar “Probar llamada simulada” con los tonos activados, o al pulsar “Activar sonido”.
- **Indicador de estado:** activos, silenciado, modo lectura, no disponible o no activados.
- **Cierre:** ocultar la pestaña, detener o salir de la ruta cierra el contexto y cancela timers. No hay commits ni mensajes tardíos.
- **Sin audio:** si está bloqueado o no hay soporte, se muestra un aviso y la llamada sigue completa en texto.

## Colección educativa (L2.3)

- **Tarjetas y opciones:**
  - Pedir ayuda: correcta, recepción. Incorrectas: pedir un diagnóstico al asistente y esperar una confirmación automática.
  - Cambiar turno: correcta, revisar la alternativa y confirmarla conservando la anterior. Incorrecta: cancelar primero.
  - Entender datos: correcta, aceptar no registra un pago. Incorrecta: aceptar es cobrar.
- **Respuesta:** cada respuesta muestra una explicación sin castigo y el foco pasa a ella. El reintento es libre.
- **Sello y colección:** el sello privado se guarda solo con “Guardar sello”. La colección va de 0 a 3 sellos.
- **Relectura y progreso:** la relectura es idempotente. El progreso se guarda por `cardId`. El reset pide confirmación.
- **Guía sin jugar:** cada tarjeta tiene “Ver la guía sin jugar”.
- **Lo que no tiene:** ranking, rachas, premios, descuentos ni obligación en admin.
