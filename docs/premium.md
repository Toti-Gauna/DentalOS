# Análisis premium y arte propio (fase 2b)

Pedido de Ignacio, antes de seguir:

- análisis completo de la web para un diseño destacable y premium del lado paciente y del lado profesional;
- SVG propios por caso (dientes de oro, con caries, ortodoncia, etc.);
- terminar lo pendiente;
- sumar sonidos, personajes y una sección infantil.

Se trabajó sobre la misma rama de la fase 2 (`feat/fase2-ux-motion`). Las reglas no negociables siguen igual:

- solo frontend local, sin red ni IA;
- sin diagnóstico ni recomendaciones;
- banner de demo y “Guardado en este dispositivo” visibles;
- audio solo tras un gesto.

## 1. Análisis pantalla por pantalla (antes → después)

| Pantalla | Qué faltaba para verse premium | Qué se hizo |
| --- | --- | --- |
| Marca y cabecera | Logo genérico de trazo; la cabecera no tenía profundidad. | `BrandMark`: diente sobre degradé teal con una brisa en oro. Sombra suave en la cabecera. Botón “Sonidos: sí/no” con estado en oro. |
| Inicio (M01) | Héroe solo de texto; las tarjetas de motivo eran iguales entre sí; no se veía al equipo. | <ul><li>Escenario ilustrado: sonrisa con una corona de oro y destellos.</li><li>Tarjeta “Tu próximo paso” superpuesta al escenario como pieza oscura.</li><li>Métricas de confianza; “próximo paso” va subrayado en oro dentro del título.</li><li>Tres pasos de “Cómo funciona”.</li><li>Una ilustración propia por motivo (`ServiceArt`).</li><li>Equipo con avatares ilustrados y emblema de especialidad (sin fotos de personas reales).</li><li>Banda “Brisa Chicos”.</li></ul> |
| Brisa Chicos (nuevo, `#/chicos`) | No existía. | Personajes, cuento de la primera visita, reloj de cepillado y álbum de stickers. Ver la sección 3. |
| Pie | Una línea gris. | Pie nocturno con marca, enlaces (incluido “Panel de la clínica”) y la aclaración de demo. |
| Panel: navegación | Lista clara sin jerarquía de marca. | Barra lateral nocturna (`--ink`). El ítem activo es blanco con filete oro; los textos se miden con el contraste renderizado. |
| Odontograma (M09) | Glifo de cinco superficies: correcto, pero abstracto. No distinguía oro de resina ni implante de ausente. | <ul><li>Cada pieza muestra su ilustración anatómica (incisivo, canino, premolar, molar; superior invertida; temporal más chica) según lo realizado. Si hay algo planificado, se suma un borde punteado.</li><li>Se mantiene el glifo de superficies para indicar dónde.</li><li>“Catálogo de registros ilustrados” con los 13 estados.</li></ul> |
| Ortodoncia (M10) | Solo texto. | Aparatología registrada e ilustrada (5 tipos). La profesional la cambia y el cambio queda en el timeline. Hay un catálogo de aparatología. |
| Resto de módulos | Ya rediseñados en la fase 2 (TurnoCard, DateStrip, drawers, MoneySummary, etc.). | Heredan los tokens oro, la sombra premium, el `lift` en tarjetas del portal y el pie nuevo. |

### Criterios que guiaron el “premium”

1. **Ilustración con intención, no decoración.** Cada SVG representa un dato real de la demo, como el estado de una pieza, la aparatología, el motivo o la especialidad. No hay stock genérico.
2. **Oro como único acento.**
   - Se usa en el subrayado del título, el filete de navegación, la corona, los destellos, el anillo de avatar y los stickers ganados.
   - Para texto solo se usa `--gold-ink` (#7a5410), que mide 5,9:1 sobre `--gold-50`.
3. **Dos tonos de interfaz, intactos.** El portal sigue siendo cálido y aireado (radios de 14–16 px); el panel, denso y nocturno en la navegación (radios de 8–10 px).
4. **Profundidad medida.** Tres sombras (`--shadow`, `--shadow-lift`, `--shadow-premium`). Hay “lift” al pasar el puntero solo en tarjetas del portal, y desaparece con movimiento reducido.
5. **Los degradados nunca van detrás de texto medible.** Los fondos con mesh o círculos usan pseudo-elementos o escenarios sin texto, así el test de contraste renderizado sigue midiendo cada texto real.

## 2. Arte propio (todo SVG inline, sin archivos ni red)

| Componente | Casos |
| --- | --- |
| `src/ui/art/teeth.tsx` · `ToothArt` | <ul><li>**13 estados:** sano, caries (hallazgo), resina, amalgama, corona de oro, corona de porcelana, conducto, implante, sellador, fractura (hallazgo), bracket, extracción indicada y pieza ausente.</li><li>**4 anatomías:** incisivo, canino, premolar y molar.</li><li>**Variantes:** superior invertida, temporal y planificado (borde punteado).</li><li>**`SmileArt`:** la sonrisa del héroe.</li></ul> |
| `src/ui/art/ortho.tsx` · `OrthoArt` | Brackets metálicos, brackets estéticos, alineadores, retenedor fijo y retenedor removible. |
| `src/ui/art/services.tsx` · `ServiceArt` | Una composición por cada uno de los 6 motivos de la seed. |
| `src/ui/art/characters.tsx` · `ToothCharacter` | Los Brisitos, 4 personajes con 5 expresiones cada uno (feliz, guiño, valiente, dormido, sorpresa):<ul><li>Muela Mora (molar)</li><li>Colmillo Coco (canino, vincha deportiva)</li><li>Incisivo Ivo (anteojos)</li><li>Dientecito Lía (diente de leche, moño dorado)</li></ul> |
| `src/ui/art/brand.tsx` | `BrandMark` (logo) y `ProAvatar` (iniciales, anillo oro y emblema de especialidad). |

**Dominio.** Se sumaron registros a la lista cerrada `PROCEDURES`: caries (hallazgo), resina, amalgama, sellador, corona de porcelana, corona de oro, conducto, implante, fractura (hallazgo), bracket, extracción indicada y pieza ausente.

- “Restauración” y “Corona” quedan por compatibilidad.
- “Hallazgo” y “extracción indicada” son registros que escribe la profesional; la demo no los infiere.

**Comando nuevo y seed.**

- El comando `episodeSetAppliance` valida contra una lista cerrada, rechaza `SIN_CAMBIOS`, escribe el timeline (`aparatologia`) y registra auditoría.
- La seed suma 11 registros de odontograma, para que el catálogo se vea con datos reales (P-008 tiene oro, implante, ausente, caries + resina planificada y fractura). `schemaVersion` sigue en 1: `appliance` es opcional.

## 3. Brisa Chicos (`#/chicos`)

La estética lúdica queda confinada a esta ruta; el resto conserva el tono adulto pedido en el PROMPT 1. Contenido:

- **Conocé a los Brisitos.**
  - Saludar a cada personaje le cambia la expresión y da un sticker.
  - Con los cuatro saludados se gana “Equipo completo”.
  - Saludar de nuevo no duplica.
- **Cuento de la primera visita.** Cinco pasos con personaje, texto en región viva y puntos de progreso. Al terminar se gana un sticker.
- **Reloj de cepillado.**
  - Dura 2 minutos (o 20 s en la “demo rápida” para presentar) y avanza por 4 zonas.
  - Muestra un anillo de progreso y a Coco “cepillando”.
  - Se puede pausar, seguir y reiniciar.
  - Hay sticker al primer cepillado y “Diente de oro” al tercero.
  - El intervalo solo avanza el reloj; sonidos y stickers reaccionan al valor (sin efectos dentro de `setState`).
- **Álbum.**
  - Ocho stickers, privados, guardados solo en este dispositivo.
  - Sin ranking, rachas ni canje.
  - “Vaciar álbum” pide confirmación.
- **Responsables.** Enlace a reservar y a los turnos de la familia (Carla → Tomás y Lola). Un aviso aclara que los consejos son generales y que lo define la odontóloga.

## 4. Sonidos (`src/ui/sound.ts`)

- **Síntesis Web Audio:** osciladores con envolvente corta; no hay archivos, voz ni red.
- **Efectos:** `tap`, `toggle`, `success`, `error`, `message`, `stamp`, `tick`, `pop` y `fanfare`.
- **Preferencia:** está **apagada por defecto** y se guarda en la UI (`dentalos.demo.v1:ui`).
- **Creación del AudioContext:** solo al activarla, o en el próximo clic o tecla si ya estaba activa. Al recargar no hay autoplay.
- **Mapeo automático de resultados del store (`store.onResult`):**
  - error → `error`;
  - chat → `message`;
  - sello educativo → `stamp`;
  - respuesta correcta → `success`;
  - avance de reloj del simulador → `tick`;
  - el resto de los commits → `success`.
- **Cierre:** ocultar la pestaña o apagar la preferencia cierra el contexto.
- **Convivencia con la llamada:** los dos tonos de la llamada simulada (`src/ui/tones.ts`) siguen siendo un control aparte. Su prueba e2e sigue verificando que en la llamada suenan solo sus dos tonos.

## 5. Accesibilidad del arte

- Las ilustraciones decorativas usan `aria-hidden`. Las que informan llevan `role="img"` y `<title>` (por ejemplo, “Ilustración: Brackets estéticos” o el reloj “Quedan 15 segundos”).
- El estado de cada pieza se sigue anunciando en el nombre accesible del botón (“Pieza 16, 1 registro(s): Corona de oro realizado”). La ilustración nunca es la única fuente.
- Las animaciones (flotar, cepillar, destellos, lift) se apagan con `prefers-reduced-motion`.
- `#/chicos` se sumó a la medición de contraste renderizado (1440 y 390 px) y al control de 320 px sin scroll horizontal.

## 6. Límites

- No se pudo escuchar el audio real ni probar con un lector de pantalla real en el contenedor. Se verificó con un AudioContext instrumentado y con semántica y foco.
- Los personajes y avatares son ilustraciones propias de la marca ficticia; no representan a personas reales.
