# Rediseño por fases: análisis completo (portal y panel)

Pedido de Ignacio:

- la página está “más o menos” y todavía muy verde;
- la navegación tiene que estar en el header;
- el footer tiene que tener un botón “Ver panel demo”;
- falta una bottom bar;
- la estructura de cada página es pobre;
- en Chicos, los personajes se saludan de a uno, se ve feo y el juego no funciona;
- falta modo oscuro;
- los SVG de los dientes y las dentaduras son pobres;
- todo tiene que hacerse por fases, con un diseño premium y profesional.

Este documento es el diagnóstico honesto y el plan. Cada fase termina con lint, typecheck, unit, build y e2e en verde. Siguen vigentes las reglas de la demo:

- solo frontend local, sin red ni IA;
- sin diagnóstico;
- banner de demo siempre visible y “Guardado en este dispositivo”;
- los roles son vistas, no seguridad;
- audio solo tras un gesto;
- contraste AA medido.

## 1. Diagnóstico

### 1.1 Lo que se ve primero (los dos lados)

| Problema | Evidencia | Por qué no es premium |
| --- | --- | --- |
| La navegación del portal no está en el header | En el portal, el menú es una fila de píldoras **debajo** del header. En móvil se desplaza en horizontal y esconde ítems. | Un sitio profesional tiene el menú en la cabecera. Las píldoras sueltas parecen un prototipo. |
| El header mezcla producto y herramientas de demo | Logo + “Portal / Panel” + “Sonidos” + “Vista de muestra” en la misma barra. | La marca compite con controles técnicos. Ninguna clínica real tiene un selector de “vista”. |
| Móvil sin bottom bar | En 390 px, el banner, el header y los controles de demo ocupan **~380 de 844 px** antes del contenido (agenda y odontograma). | En móvil, la navegación esperada está abajo, al alcance del pulgar. Hoy se pierde casi la mitad de la pantalla. |
| Footer sin acción | El footer tiene marca, enlaces y aviso. | Falta el CTA de la demo (“Ver panel demo”) y una estructura en columnas. |
| Sin modo oscuro | Solo hay tokens claros. | Es una expectativa básica de un producto premium. |
| Estructura de página plana | Las páginas siguen el patrón eyebrow + H1 + párrafo + tarjetas. | Falta jerarquía (encabezado de página con acciones, migas, secciones con título) y falta ritmo. Todas las páginas se sienten iguales y “documento”. |

### 1.2 Portal de pacientes

| Pantalla | Diagnóstico | Dirección |
| --- | --- | --- |
| Inicio | El héroe está bien resuelto, pero las secciones son una lista de bloques sin narrativa. El equipo queda suelto y las preguntas frecuentes llegan tarde. | <ol><li>Héroe con dentadura completa ilustrada.</li><li>Barra de confianza.</li><li>Servicios en grilla con ilustración.</li><li>“Cómo funciona” en tres pasos visuales.</li><li>Equipo.</li><li>Brisa Chicos.</li><li>Preguntas frecuentes.</li><li>Sedes.</li><li>CTA final.</li></ol> |
| Reservar | Las tres partes (para quién, motivo, horario) están a la vista, pero no hay sensación de avance. El resumen queda abajo en móvil. | Indicador de pasos fijo (1 Para quién → 2 Motivo → 3 Horario → Confirmar) que se completa solo. Resumen lateral fijo en desktop. |
| Mis turnos | Lista correcta, pero el próximo turno no se destaca y el historial vacío no invita a nada. | Próximo turno grande (fecha, hora, profesional, acciones), después el resto y el historial, con el selector de persona más claro. |
| WhatsApp | El teléfono está bien. El contexto de la derecha es un formulario. | Dos paneles tipo app: teléfono y ficha del turno en vivo, con los atajos de prueba como chips. |
| Llamada | El formulario aparece antes de la experiencia. | Pantalla de llamada protagonista (estado, onda, transcripción), con la configuración a un lado. |
| Aprender | Las tarjetas son correctas, pero los sellos son círculos punteados. | Colección con portadas ilustradas y progreso claro. |
| Sede / Servicio | Las páginas están bien, pero son cortas. | Encabezado con ilustración, datos clave en chips, equipo con avatar y CTA. |

### 1.3 Panel de la clínica

| Pantalla | Diagnóstico | Dirección |
| --- | --- | --- |
| Shell | La barra lateral oscura funciona, pero no tiene grupos ni encabezado propio. La cabecera repite los controles de la demo. | <ul><li>Barra lateral con grupos (Operación · Pacientes · Clínica · Gestión).</li><li>Cabecera del panel con migas, buscador ⌘K y modo oscuro.</li><li>Controles de la demo en la franja de la demo.</li><li>Bottom bar en móvil: Agenda · Bandeja · Personas · Buscar · Más.</li></ul> |
| Hoy y agenda | Es la mejor pantalla, pero las acciones y los KPI compiten. | Barra de herramientas de página (fecha, vista, acciones) y KPI más compactos. |
| Bandeja | Lista con mucho aire vacío. | Lista + panel de detalle en desktop, con contadores en las pestañas. |
| Personas / Ficha | Tabla y ficha correctas, pero planas. | Ficha con cabecera de persona (avatar, ID, vínculos, acciones) y secciones en pestañas o tarjetas. |
| Odontograma | Las piezas son botones en dos filas. La ilustración es lateral (vista vestibular), así que el cuadrito de superficies queda aparte. | **Odontograma anatómico:** arcadas superior e inferior en forma de U, vista oclusal de cada pieza y las cinco superficies **sobre el diente mismo**, como en software clínico. |
| Ortodoncia | La ilustración es chica y frontal, de un solo sector. | Dentadura frontal completa (ambas arcadas) con la aparatología registrada. |
| Presupuestos / Informes | Bien resueltos tras la fase 2c. | Barra de herramientas común y tablas con mejor alineación. |

### 1.4 Brisa Chicos

- **Bug real del juego.** “Cepillarme con el reloj” y “Leer el cuento” eran enlaces `#cepillado` y `#cuento`. El router por hash los tomaba como rutas y mostraba **“No encontramos esta página”**. Ya está corregido en el PR #5 (botones que desplazan, con prueba).
- **Personajes de a uno.** Cada uno en una tarjeta con su botón “Saludar”. Se ve como un formulario. → **Escena grupal:** los cuatro juntos en un escenario ilustrado, con animación de reposo (respiran, parpadean). Al tocar a uno, habla con un globo de diálogo. “¡Hola a todos!” los hace saludar a la vez.
- **Falta un juego de verdad.** El reloj funciona, pero es pasivo. → Minijuego **“¡A limpiar la sonrisa!”**:
  - aparecen bacterias sobre una dentadura ilustrada;
  - tocarlas (o Enter / espacio con teclado) las cepilla;
  - dura 30 segundos, tiene puntaje y estrellas, y da sticker al lograrlo;
  - con movimiento reducido, las bacterias quedan quietas.

### 1.5 Arte dental

- La pieza lateral (vista vestibular) mejoró en la fase 2c, pero **no hay vistas oclusales ni arcadas**. Las “dentaduras” son seis coronas planas bajo una encía.
- La dirección:
  - un set **oclusal** por tipo de pieza: molar con cúspides y surcos, premolar con dos cúspides, canino con cúspide central e incisivo con borde incisal;
  - **arcadas** en U con 16 piezas permanentes o 10 temporales;
  - **dentadura frontal completa** (superior e inferior, encías con volumen, sombra interna de la boca), con brackets, alineadores o retenedores encima.

## 2. Plan por fases

| Fase | Objetivo | Entregables | Criterio de aceptación |
| --- | --- | --- | --- |
| **0. Análisis** | Diagnóstico y plan | Este documento | Revisado con Ignacio |
| **1. Sistema de diseño v3 + modo oscuro** | Base visual coherente en claro y oscuro | <ul><li>Tokens semánticos (superficie, texto, borde, acento, estados) con variantes claro y oscuro.</li><li>Preferencia Sistema/Claro/Oscuro guardada en el dispositivo.</li><li>Selector en la cabecera.</li><li>Arte y fondos adaptados.</li></ul> | Contraste AA medido en ambos temas (unit + e2e renderizado). Sin parpadeo al cargar. |
| **2. Shell y navegación** | Navegación profesional en los dos lados | <ul><li>Header de producto con el menú adentro.</li><li>Franja de demo con sus controles (área, vista, sonidos, qué es la demo).</li><li>Footer en columnas con **“Ver panel demo”**.</li><li>**Bottom bar** en móvil (portal y panel) con hoja “Más”.</li><li>Barra lateral del panel con grupos.</li><li>Plantillas de página (encabezado con migas y acciones, secciones).</li></ul> | En 390 px el contenido empieza antes de los 200 px. Teclado y lector: landmarks y foco correctos. |
| **3. Estructura de páginas** | Cada página con jerarquía y ritmo | Portal (inicio, reservar con indicador de pasos, mis turnos, WhatsApp, llamada, aprender, sede, servicio) y panel (agenda, bandeja, ficha, presupuestos, informes, espera, tareas, config) sobre las plantillas | Las e2e de flujos siguen en verde. Capturas antes y después. |
| **4. Arte dental v4** | Dentaduras de nivel profesional | <ul><li>Set oclusal.</li><li>Odontograma anatómico en arcadas con superficies sobre la pieza.</li><li>Dentadura frontal completa (héroe y ortodoncia).</li><li>Catálogo actualizado.</li></ul> | Las piezas se eligen con teclado y su nombre accesible incluye los registros. Las 5 superficies se pueden seleccionar. |
| **5. Brisa Chicos v2** | Que se vea y se juegue bien | Escena grupal interactiva, minijuego accesible, reloj integrado y stickers | El juego se completa con mouse, toque y teclado. Pruebas con reloj controlado. |
| **6. QA y entrega** | Cierre verificable | Pruebas nuevas, evidencia en claro y oscuro, documentación y PR | Todo en verde en 3 corridas. |

## 3. Principios de diseño para todas las fases

1. **Producto primero, demo al costado.** La cabecera es la de una clínica real. Todo lo que es demo (vista, área, sonidos, alcance) vive en la franja de la demo, que sigue siempre visible.
2. **Jerarquía de página fija.** Migas → título → descripción → acciones → contenido en secciones con título. Una sola acción primaria por vista.
3. **Ritmo.** Espaciado de 8 px, secciones a 64–96 px en el portal y 24–32 px en el panel. Radios de 20–24 px en el portal y de 10–12 px en el panel.
4. **Color con intención.** Teal profundo y oro como único acento. Los estados siempre llevan texto e ícono. En el modo oscuro, el teal se aclara y el oro se suaviza, sin negro puro.
5. **Movimiento que explica.** Solo `transform`/`opacity`, de 150 a 300 ms. Con movimiento reducido, todo queda quieto y el resultado se sigue viendo.
6. **Arte que informa.** Cada ilustración representa un dato (estado de pieza, aparatología, motivo). La decorativa es `aria-hidden`.

## 4. Estado de las fases

Rama `feat/fase3-rediseno`, que sale de `feat/fase2c-premium` (PR #5). Un commit por fase.

| Fase | Estado | Commit | Qué quedó |
| --- | --- | --- | --- |
| 0 + 1 | Hecha | `67cb0c8` | <ul><li>Este análisis.</li><li>Tokens con `light-dark()` para claro y oscuro; todos los colores fijos migrados.</li><li>Preferencia Sistema/Claro/Oscuro en la cabecera, aplicada antes de pintar.</li><li>Contraste medido en los dos temas: 100 pares unitarios + contraste renderizado en 20 rutas × 2 anchos × 2 temas.</li></ul> |
| 2 | Hecha | `514a33f` | <ul><li>Franja de demo con “Controles de la demo” (área, vista, sonidos y alcance).</li><li>Cabecera de producto con el menú adentro; búsqueda en la cabecera del panel.</li><li>Barra lateral agrupada (Operación, Pacientes, Gestión) y migas.</li><li>Pie en columnas con **“Ver panel demo”**.</li><li>**Bottom bar** en móvil con hoja “Más”; se oculta con el teclado abierto.</li></ul> |
| 3 | Hecha | `92423d0` | Inicio con beneficios, sedes, preguntas y cierre; reserva con indicador de pasos; mis turnos con el próximo destacado y cuenta regresiva; fichas con avatar; secciones con título en portal y panel. |
| 4 | Hecha | `75f6a17` | <ul><li>Odontograma anatómico: arcadas en U con cada pieza en vista oclusal y las superficies marcadas sobre el diente (también temporal).</li><li>Panel de la pieza con vista oclusal y lateral; leyenda y catálogo oclusales.</li><li>Sonrisa completa con labios, encías y aparatología en el inicio y en ortodoncia.</li></ul> |
| 5 | Hecha | `33f00c9` | <ul><li>Los cuatro Brisitos juntos en escena: “¡Hola, Brisitos!” los hace saludar a la vez; tocar a uno muestra su globo.</li><li>Juego “Cazá los bichitos” con reloj (30 s, estrellas y récord) o sin apuro; se juega con toque, mouse y teclado.</li><li>Álbum de 8 stickers que conserva el progreso guardado.</li></ul> |
| 6 | Hecha | este PR | Lint, typecheck, 154 unit, build y 63 e2e en verde en 3 corridas; evidencia en claro y oscuro (`docs/evidence/after/*-dark.jpg`); documentación. |

