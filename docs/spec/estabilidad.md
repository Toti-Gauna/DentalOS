# Estabilidad de la suite e2e (lote 1)

## Síntoma
Auditoría del 17/10: en `main` @ `73c5e75`, de 7 corridas de la suite, una tuvo 1 falla sin nombre conservado (62 pasadas, 1 fallida, 1 omitida). Las otras 6 dieron 63/63.

## Método
1. Reporter `list` (conserva nombres) y `--trace retain-on-failure`, 5 corridas completas seguidas, salida a archivo.
2. La falla se reprodujo en la corrida 2 de 5.
3. Corrección, repetición dirigida del subconjunto afectado con carga alta (4 workers sobre 4 núcleos) y suite completa de nuevo.

## Hallazgo 1 — carrera por reloj en vivo (causa del síntoma original)
- Test: `premium.spec.ts` › “juego «Cazá los bichitos»…”.
- Error: `locator.click: Test timeout` con `element is not enabled` sobre `Diente 4 de arriba: ¡tiene un bichito!`.
- Causa: `page.clock.install` **no detiene** el tiempo; sigue corriendo en vivo además de los saltos de `runFor`. El juego (30 s) podía terminar entre `dirty.count()` y `dirty.first().click()`; al terminar, el tablero se deshabilita con el bichito todavía listado. Es una carrera del test, no un defecto del producto: el juego deshabilita correctamente los dientes al terminar.
- Corrección: helper `pausedClock()` que instala el reloj y lo pausa (`clock.pauseAt`) tras cargar la página, para que el tiempo avance solo con `runFor`. Se aplicó a los tres tests con reloj controlado (juego con reloj, juego sin apuro, reloj de cepillado).

## Hallazgo 2 — test demasiado costoso bajo carga (descubierto al verificar)
- Con el reloj ya pausado y 4 workers sobre 4 núcleos (carga de sistema ~12), el test del juego fallaba **siempre** por timeout (~33 s): hacía 60 vueltas de `count/click/runFor(500)`, cada una con idas y vueltas al navegador.
- Un bichito vive 4 s (`GERM_LIFE = 8` ticks de 500 ms). Cepillar cada 2 s lo alcanza siempre, así que el bucle pasó a 15 vueltas de `runFor(2000)` (en el modo sin apuro, 20 vueltas de 2 s).
- No se subió ningún timeout, no se agregaron reintentos y no se omitió ningún test.

## Verificación
- Subconjunto (juego con reloj, juego sin apuro, reloj de cepillado) × 20 repeticiones × 4 workers: **60/60**.
- Suite completa: ver el registro de corridas al final de este archivo.

## Nota de método
La primera corrección (solo pausar el reloj) **no** bastó: la repetición bajo carga lo mostró. Sin esa verificación el hallazgo 2 habría quedado oculto.

## Registro de corridas
| Corrida | Resultado |
| --- | --- |
| Antes de la corrección, 5 corridas completas | 4 × 63 pasadas; 1 × **1 fallida** + 62 pasadas (la del hallazgo 1) |
| Después de la corrección, 5 corridas completas seguidas (reporter `list`) | 5 × **63 pasadas + 1 omitida a propósito** (capturas) |

Límite: la falla original aparecía en ~1 de 5 corridas, así que 5 corridas en verde reducen mucho la probabilidad de que siga ahí, pero no la descartan. La repetición ×20 con carga alta (60/60) es la evidencia más fuerte. Si reaparece una intermitencia, se registra aquí con su nombre antes de tocar nada.
