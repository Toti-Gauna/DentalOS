# Inventario de assets y licencias

| Asset | Origen | Licencia | Uso |
| --- | --- | --- | --- |
| Newsreader 500/600 y 500 itálica (subset latin) | `@fontsource/newsreader` 5.3.0, empaquetada en `dist/assets` | SIL Open Font License 1.1 | Títulos (dirección A, lote 3) |
| Source Sans 3 400/600/700 (subset latin) | `@fontsource/source-sans-3` 5.x, empaquetada en `dist/assets` | SIL Open Font License 1.1 | Texto, interfaz y tablas |
| Íconos (`src/ui/kit.tsx`) | Trazos SVG propios de este repo | Propios del proyecto | Estados texto+ícono, navegación |
| Logo / favicon (`public/favicon.svg`, `src/ui/art/brand.tsx`) | SVG propio (diente estilizado con brisa en oro) | Propio del proyecto | Marca ficticia Clínica Brisa |
| Tonos de llamada | Generados en runtime con Web Audio (`src/ui/tones.ts`): “habla” 523 Hz/140 ms y “guardado” 659 Hz/170 ms | No es un asset | Opcional, tras gesto |
| Ilustraciones dentales (lateral, vista oclusal, arcadas y sonrisa completa con aparatología en `src/ui/art/teeth.tsx` y `dentition.tsx`), de ortodoncia, motivos, personajes “Brisitos”, juego de Brisa Chicos (`kids.tsx`), marca y avatares (`src/ui/art/*.tsx`) | SVG inline dibujados para este repo (sin trazos de terceros) | Propios del proyecto | Odontograma, ortodoncia, inicio, Brisa Chicos |
| Familia editorial (lote 4: vistas, comprobante, ticket con código, campaña, guía, cierre y juego en `src/ui/art/editorial.tsx`), marco de teléfono (`src/ui/Device.tsx`) y comprobante (`src/ui/Receipt.tsx`) | SVG y CSS propios dibujados para este repo | Propios del proyecto | Selector de vista, botonera, mockups, reserva confirmada y lotes 5–9 |
| Ilustraciones de encabezado del portal (`src/ui/art/pages.tsx`), patrón de fondo del chat, grano del fondo ambiental y chevron de selects | SVG propios (inline o `data:` URI en `app.css`, permitido por la CSP `img-src 'self' data:`) | Propios del proyecto | Encabezados, WhatsApp, fondo animado, formularios |
| Efectos de sonido de interfaz | Sintetizados en runtime con Web Audio (`src/ui/sound.ts`): 9 envolventes cortas de osciladores | No es un asset | Opt-in, apagados por defecto, tras gesto |
| Glifos (sellos, bloque de fecha) | SVG inline propios (`src/ui/components.tsx`, `src/pages/public/Learn.tsx`) | Propios del proyecto | UI |
| Capturas `docs/evidence/` | Generadas por `tests/e2e/evidence.spec.ts` sobre la seed sintética | Propias | Documentación |

Sin imágenes de prospectos, fotos, radiografías, mapas, embeds, CDN ni tracking.

## Dependencias de runtime

| Paquete | Licencia |
| --- | --- |
| react, react-dom 19 | MIT |
| @fontsource/newsreader, @fontsource/source-sans-3 | OFL-1.1 (fuentes), MIT (CSS) |

## Dependencias de desarrollo

TypeScript (Apache-2.0), Vite / @vitejs/plugin-react / Vitest (MIT), ESLint / typescript-eslint / eslint-plugin-react-hooks / globals (MIT), Playwright (Apache-2.0), jsdom (MIT), @types/* (MIT). Ninguna se incluye en el bundle salvo React y las fuentes.

## Auditoría de red

- `dist/` no contiene URLs de red salvo identificadores XML namespace (`http://www.w3.org/...`) y el texto de errores de React (`https://react.dev/errors/`), que no generan requests.
- `build.modulePreload.polyfill = false`: el bundle no usa `fetch`.
- CSP en el `index.html` de build: `connect-src 'none'; font-src 'self'; frame-src 'none'`.
- E2E `los 15 módulos navegan…` registra todas las requests del navegador y falla si alguna sale de `127.0.0.1:4173`.
- ESLint prohíbe `fetch`, `Math.random`, `Date.now` y `dangerouslySetInnerHTML` en el código fuente.
