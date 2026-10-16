# DentalOS

> El repositorio se llamaba `DentalOS` y contenía solo este título. Por indicación del operador se usó como destino de la demo **TableFlow** (ver `docs/tableflow/inspection.md`).

# TableFlow · demo frontend local

Demo de gestión gastronómica con dos negocios **ficticios** — **Mesa Clara** (bodegón) y **Ritual Café** (cafetería) — y los 15 módulos M01–M15: carta, configuración y carrito, reservas y espera, salón, pedidos, cocina/barra, caja, administración de carta, stock y recetas, clientes, WhatsApp y llamada simulados, automatizaciones, pasaporte de sabores, catas y reportes/configuración.

**Solo frontend local.** Sin backend, base remota, IA real, autenticación, SDK de pagos, mensajes, llamadas, micrófono ni integraciones. Los roles muestran vistas, no seguridad. Banner **DEMO** permanente; pagos “DEMO” sin validez fiscal. Todo el contenido es de muestra.

## Probarla
- Online (tras el deploy): `https://toti-gauna.github.io/DentalOS/`
- Local:

```bash
npm ci
npm run dev        # http://localhost:5173
```

El estado se guarda en `localStorage` (`tableflow.demo.v1`). Reloj simulado inicial: **lunes 19/10/2026 10:00** (America/Argentina/Buenos_Aires); solo avanza con los controles de la barra de la demo. “Reiniciar demo” borra únicamente las claves TableFlow.

### Recorrido de 60–90 s (restaurante)
1. Barra de la demo → *Saltar a… → Ir a las 12:00* (el salón abre al mediodía).
2. Carta → milanesa → guarnición → *Agregar* → *Mi pedido* → elegí mesa → *Enviar pedido* (folio **O-013**).
3. Rol **Recepción** → aceptar · rol **Cocina / barra** → preparar → listo → servido · rol **Caja** → abrir caja → dividir en 3 → cobrar partes → cerrar cuenta.

Café: perfil *Ritual Café* → flat white (tamaño y leche) → retiro por franja → barra acepta, prepara, marca listo y retirado.

Simulador de WhatsApp/llamada: `#/mesa-clara/simulador` (guion: “Mesa para 4 el lunes a las 20” → 21:45 → confirmar → R-019).

## Verificación
```bash
npm run typecheck   # tsc --noEmit
npm test            # Vitest: dominio, persistencia, invariantes, contraste (144 pruebas)
npm run build       # tsc + vite build → dist/
npm run e2e         # build + Playwright (35 pruebas; usa Chromium instalado)
npm run screens     # regenera docs/tableflow/screens (CAPTURE=1)
```
No hay lint (no se instaló ESLint). La documentación de fase está en `docs/tableflow/`: `inspection.md`, `architecture.md`, `fixtures.md`, `coverage.md`, `checkpoint.md`.

## Deploy
`.github/workflows/deploy.yml`: en cada PR a `main` corre typecheck, pruebas y build (más un job E2E informativo); al integrarse a `main` publica `dist/` en GitHub Pages. Requiere **Settings → Pages → Source: GitHub Actions**. La app usa `HashRouter` y `base: './'`, así que funciona bajo la subruta `/DentalOS/`.

## Límites
Demo comercial pre-venta: no acredita integración con Fudo, Maxirest, Woki, Meitre ni con ningún proveedor; Paila·Co es evidencia de política sin reservas, no cliente. Los valores comerciales de `/#/comercial` provienen del tarifario del 16/10/2026 con vigencia pendiente de revalidar.
