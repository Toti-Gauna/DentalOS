# Dirección visual (lote 2 · R-VIS-02 y R-VIS-03)

**Estado: pendiente de la elección de Ignacio.** No hay una aprobación previa documentada (se revisaron `docs/checkpoint.md`, `docs/design.md`, los documentos de fases anteriores y la auditoría). Ninguna propuesta está aprobada por defecto, y el silencio no cuenta como aprobación.

## Dónde verlas

Las propuestas están en la ruta aislada **`#/propuestas`**, cargada en diferido. No forma parte de la navegación de la demo y no se descarga si no se visita.

- Una propuesta: `#/propuestas?v=una&p=a|b|c&m=claro|oscuro`
- Comparar la misma pantalla: `#/propuestas?v=comparar&s=inicio|agenda|reserva|whatsapp&m=claro|oscuro`

Las tres usan **el mismo contenido real** del seed:

- el turno A-0012 de Martina (control de ortodoncia, jueves 22/10 a las 10:00, Sillón 2);
- la agenda de hoy (lunes 19/10, 5 turnos en 3 sillones);
- los horarios libres de primera consulta;
- el flujo de WhatsApp: horario ocupado, alternativa, versión 2 y recordatorio anulado.

Cada propuesta muestra:

- Inicio del paciente y Hoy/agenda (escritorio, 1180 px);
- Reserva y WhatsApp (teléfono, 390 px);
- muestras de carga, de movimiento (“turno confirmado”) y de la familia de la marca;
- paleta con roles, contraste medido, tipografía, grilla, densidad, superficies y movimiento;
- todo en claro y en oscuro.

## Resumen de las tres

| | A · Editorial clínico cálido | B · Soft glass sobrio | C · Minimalismo tecnológico humano |
| --- | --- | --- | --- |
| Idea | Papel cálido, títulos serif y filetes finos; evoluciona el teal y oro actual | Bruma aqua y lila, paneles esmerilados y formas suaves | Neutros precisos, cobalto y menta, datos en monoespaciada |
| Tipografía (local, OFL) | Newsreader + Source Sans 3 | Plus Jakarta Sans | IBM Plex Sans + IBM Plex Mono |
| Acento claro / oscuro | `#1E5C55` / `#6BBFB1` | `#09617D` / `#5BC6DE` | `#2949D6` / `#7D93FF` |
| Radios (tarjeta, control, chip) | 6 / 6 / píldora | 24 / 14 / píldora | 10 / 8 / 6 |
| Densidad | Media; aireada en el portal | Media-baja; formas grandes | Alta en el panel; media en el portal |
| Movimiento | 180–420 ms, trazo y sello | 220–560 ms, desenfoque que se aclara y anillos | 140–320 ms, líneas y cifras que avanzan |
| Componente distintivo | Folio del turno (boleto con borde perforado) | Píldora de vidrio con anillo de cuenta regresiva | Riel de tiempo y estados con forma |
| Peor contraste medido (texto ≥ 4.5 · foco ≥ 3) | texto 5.3:1 · foco 3.9:1 (claro) | texto 4.9:1 · foco 4.9:1 (claro, sobre el peor fondo del vidrio) | texto 5.3:1 · foco 6.1:1 (claro) |
| Riesgo principal | Que se vea “revista” y pierda densidad en el panel | Legibilidad del vidrio y costo de `backdrop-filter` en equipos modestos | Que se vuelva frío o “de software” para pacientes |

## Familia de la marca (2E)

El brief tiene **una sola marca ficticia**, Clínica Brisa, con dos sedes (Centro y Norte) y dos especialidades (general y ortodoncia), más el espacio infantil Brisa Chicos. **No hay otros negocios ni variantes reales que inventariar.** No se fuerzan cinco marcas para imitar a TableFlow.

Dentro de la marca se distinguen tres recorridos, cada uno por su composición y su contenido:

- **General:** portal, reserva y panel, con el acento principal.
- **Ortodoncia:** el mismo sistema con el segundo acento, para continuidad y controles indicados por la profesional.
- **Brisa Chicos:** personajes y juegos, con colores más cálidos sin salir de la marca.

Cada propuesta muestra esta familia en su muestra “Familia de la marca”.

## Cómo responder

Hay tres formas:

- **Elegir una letra:** A, B o C.
- **Combinar**, por ejemplo: “A en el portal con la agenda de C”.
- **Pedir correcciones concretas**, por ejemplo: “B, pero con menos lila y radios de 16”.

## Registro de la elección

| Campo | Valor |
| --- | --- |
| Fecha | — |
| Elección | — |
| Combinaciones | — |
| Correcciones pedidas | — |
| Tokens congelados en | — (L3: `src/styles/app.css`) |
| Fuentes que se quitan | — (las de las propuestas descartadas) |

Con la elección registrada:

- R-VIS-03 pasa a `probado` (evidencia: este documento).
- L3 aplica la dirección a todo el portal y el panel.
