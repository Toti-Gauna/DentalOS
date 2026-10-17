# Análisis premium total (fase 2c)

Pedido de Ignacio:

- un análisis de diseño premium total: qué mejorar, qué pulir y qué agregar;
- aplicar lo encontrado con componentes nativos de la plataforma;
- fondos animados;
- mejorar todos los SVG de dientes.

Se relevaron 21 rutas a 1440 y 390 px sobre la seed `dentalos-v1`, con el estado de `main` después del PR #4. Las reglas de la demo siguen intactas:

- solo frontend local, sin red ni IA;
- sin diagnóstico;
- banner de demo visible;
- audio solo tras un gesto;
- movimiento reducido respetado;
- contraste AA medido.

## 1. Diagnóstico general

| Tema | Hallazgo | Severidad |
| --- | --- | --- |
| Fondo | El fondo plano arena es correcto pero estático. Las páginas interiores se sienten “documento”, no producto. | Alta (percepción) |
| Cabecera | No acompaña el scroll. En desktop, al bajar en agenda o presupuestos, se pierden el área y la vista. | Media |
| Capas modales | Drawers y diálogos son `div` con foco atrapado a mano. Funcionan, pero no usan la capa superior nativa (`<dialog>`, `::backdrop`, `inert` implícito). | Media (robustez) |
| Transiciones | Cambiar de ruta es un corte seco. El motion causal existe dentro de las pantallas, pero no entre ellas. | Media |
| Encabezados de página | Las interiores del portal (reservar, mis turnos, WhatsApp, llamada, aprender, sede) son solo texto. No tienen la identidad ilustrada del inicio. | Alta |
| Formularios | Los selects y casillas son los del sistema. Correctos, pero sin foco “premium” ni coherencia con los botones. | Media |
| Tablas | Hay IDs que se cortan en dos líneas (`L-` / `010`, `P-` / `010`). Los importes no están alineados a la derecha. En la caja, los negativos no se distinguen. | Alta (pulido) |
| KPI de informes | Los importes grandes (“$ 120.000,00”) y “Sin datos (n=0)” se parten en dos líneas. | Media |
| Personas | Ficha, familia, bandeja y listado no tienen avatar. El equipo sí lo tiene. | Media |
| Estados vacíos | “Sin historial.” y “Sin ofertas.” son texto suelto. | Baja |
| Dientes SVG | Están bien resueltos, pero se ven planos:<ul><li>un solo degradé de esmalte;</li><li>sin translucidez incisal ni brillo especular;</li><li>el oro y la amalgama sin reflejo metálico;</li><li>la caries es una mancha;</li><li>el implante tiene poca rosca.</li></ul> | Alta (pedido explícito) |

## 2. Qué se pule, qué se mejora y qué se agrega

### Pulir

- **Tipografía:**
  - `text-wrap: balance` en títulos y `pretty` en párrafos;
  - tracking negativo en display;
  - IDs y montos con `nowrap` y cifras tabulares;
  - montos alineados a la derecha y negativos en rojo con signo.
- **KPI:** cada tarjeta es un contenedor (`container-type`) y el valor usa unidades de contenedor (`cqi`). No se parte ni desborda; “Sin datos” se muestra más chico.
- **Foco:** doble anillo (claro + azul) en todos los controles. Es más visible que el anterior y se ve más cuidado.
- **Casillas y radios:** siguen siendo `<input>` nativos, ahora con `appearance: none`, check propio y animación de marcado.
- **Selects:** chevron propio. Además, el **select personalizable nativo** (`appearance: base-select`) como mejora progresiva, con desplegable redondeado, sombra y opción elegida marcada. Donde no hay soporte queda el select clásico estilizado.

### Mejorar

- **Cabecera de vidrio (desktop):** es fija, con `backdrop-filter`. La sombra aparece con el scroll mediante **animación por scroll nativa** (`animation-timeline: scroll()`), sin JS. En móvil no se fija, para no tapar el teclado virtual.
- **Botones:** primario con degradé sutil, brillo interno y destello al pasar el puntero; secundario con borde más fino y realce.
- **Capas modales nativas:** Drawer y ConfirmDialog pasan a `<dialog>` con `showModal()`. Eso da:
  - capa superior;
  - `::backdrop` con desenfoque;
  - el resto de la página inerte de forma nativa;
  - Escape por el evento `cancel`;
  - entrada con `@starting-style`.

  El foco vuelve explícitamente al elemento que abrió el diálogo, como antes.
- **Transiciones entre rutas:** **View Transitions API** nativa (`document.startViewTransition`). El contenido hace un fundido corto con leve desplazamiento y la cabecera queda fija. Se desactiva con movimiento reducido o donde no hay soporte.
- **Reserva:**
  - pasos numerados (1 · 2 · 3) con el mismo lenguaje visual;
  - horarios en una grilla de tarjetas compactas con la hora destacada, conservando los radios nativos.
- **WhatsApp:**
  - teléfono con fondo de chat (patrón propio de dientes en SVG);
  - avatar de la clínica en la cabecera;
  - sombra sutil en las burbujas.
- **Tablas del panel:** fila resaltada al pasar el puntero; IDs que no se cortan; importes a la derecha.
- **Informes:** barras de datos dentro de las tablas “Turnos por estado” y “No cancelados por profesional”. La tabla sigue siendo la fuente accesible; la barra es decorativa.

### Agregar

1. **Fondos animados “aurora”:** una capa fija de manchas desenfocadas que se mueven lento (solo `transform`, en GPU), más grano sutil. Hay un tono por área:
   - **portal:** teal y oro cálido;
   - **panel:** teal frío, más tenue, para no competir con los datos;
   - **Brisa Chicos:** burbujas de colores.

   Con movimiento reducido quedan quietas. El peor caso de mezcla (mancha al máximo sobre el fondo) se mide en el test de contraste de tokens.
2. **Ilustración en cada encabezado del portal (`PageArt`):** calendario con diente (reservar), ticket de turno (mis turnos), burbujas (WhatsApp), auricular con ondas (llamada), libro con sello (aprender) y fachada de la sede.
3. **Paleta de comandos ⌘K / Ctrl+K en el panel:** `<dialog>` nativo para ir a cualquier módulo o abrir la ficha de una persona por ID o nombre. Se maneja con flechas, Enter y Escape. Hay un botón “Buscar” visible para quien no usa atajos.
4. **Popover nativo “¿Qué es esta demo?”:** botón en el banner que abre un `popover` (API nativa, se cierra al tocar afuera) con el alcance de la demo. En pantallas anchas se ancla al botón con **CSS anchor positioning**. El banner sigue siempre visible.
5. **Preguntas frecuentes en el inicio:** acordeón **exclusivo nativo** (`<details name>`) con apertura animada (`::details-content` + `interpolate-size`) donde hay soporte.
6. **Avatares de personas:** iniciales sobre un degradé estable por ID en ficha, familia, listado y bandeja. Son ilustraciones, no fotos.
7. **Estados vacíos con personaje:** en el portal, Coco dormido en “Sin historial”.
8. **Borde oro animado:** la tarjeta “Tu próximo paso” tiene un borde cónico que gira lento (`@property` animable nativo).
9. **Brisa Chicos:**
   - confeti de CSS al ganar un sticker;
   - rebote del personaje al saludar;
   - burbujas animadas de fondo.
10. **Sede:** avatares del equipo y fachada ilustrada.
11. **Llamada:** onda de voz animada mientras la llamada está activa, sin audio de voz.

## 3. Dientes SVG: de bien a premium

Mismo componente (`ToothArt`), misma API y mismos 13 estados.

- **Anatomía:**
  - siluetas más finas por tipo;
  - molar con cuatro cúspides y surcos oclusales;
  - premolar con dos cúspides;
  - canino con cíngulo;
  - incisivo con mamelones sutiles en el borde.
- **Luz:** fuente única arriba a la izquierda.
  - Esmalte en tres capas: base cálida cervical, cuerpo marfil y borde incisal translúcido azulado.
  - Brillo especular desenfocado (`feGaussianBlur`) y luz de borde.
  - Sombra de contacto suave.
- **Raíz:** dentina con degradé propio y unión amelo-cementaria suave, en vez de una línea.
- **Estados:**
  - **Corona de oro:** degradé metálico de cinco paradas, banda de reflejo y destello.
  - **Porcelana:** brillo perlado.
  - **Amalgama:** gris plata con reflejo y borde oscuro de la obturación.
  - **Resina:** casi del color del diente, con contorno fino.
  - **Caries:** lesión irregular de dos tonos con halo de desmineralización.
  - **Conducto:** vista en corte translúcido de cámara y conductos obturados.
  - **Implante:** tornillo de titanio con rosca, pilar y corona.
  - **Fractura:** grieta con astillado.
  - **Sellador:** película brillante en las fosas.
  - **Bracket:** acero con aletas, ranura y arco.
  - **Extracción indicada:** marca en rojo de registro.
  - **Ausente:** silueta fantasma.
- **Sonrisa del inicio y ortodoncia:** aplican el mismo tratamiento de esmalte. La encía tiene volumen y brillo.
- **Personajes:** brillo especular en el esmalte.

## 4. Riesgos y cómo se controlan

| Riesgo | Control |
| --- | --- |
| Que un fondo animado baje el contraste | Opacidad máxima acotada. Test de tokens con el peor color mezclado para tinta, secundario y primario. Las tarjetas siguen sobre superficie sólida. |
| Movimiento excesivo | Todo se apaga con `prefers-reduced-motion`. Las animaciones solo usan `transform`/`opacity` y nunca bloquean un commit. |
| Que una API nativa no esté disponible | Mejora progresiva con `@supports` o detección. Sin View Transitions el cambio es instantáneo; sin `base-select`, select clásico; sin `interpolate-size`, el acordeón abre sin animar. |
| Que la cabecera fija tape contenido | Solo es fija en desktop, con `scroll-padding-top`. Las pruebas de teclado virtual siguen a 390 px. |
| Que el diálogo nativo cambie el foco | Se conserva la devolución explícita del foco. Las pruebas de Escape y foco existentes siguen vigentes. |
