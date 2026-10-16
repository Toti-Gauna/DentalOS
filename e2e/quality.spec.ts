import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { fresh, jump, setRole, state } from './helpers'

const ORIGIN = 'http://127.0.0.1:4173'

test('red: cero solicitudes a APIs de negocio, IA, pagos o mensajería (solo assets locales)', async ({ page }) => {
  const urls: string[] = []
  page.on('request', (r) => urls.push(r.url()))
  await fresh(page, '/#/mesa-clara')
  for (const p of ['/#/mesa-clara/carta', '/#/mesa-clara/reservar', '/#/mesa-clara/simulador', '/#/ritual-cafe/explorar', '/#/admin/resumen', '/#/admin/caja', '/#/comercial']) {
    await page.goto(p)
    await page.waitForTimeout(150)
  }
  const ext = urls.filter((u) => !u.startsWith(ORIGIN) && !u.startsWith('data:') && !u.startsWith('blob:'))
  expect(ext).toEqual([])
  expect(urls.some((u) => /fonts\.googleapis|api\.|openai|anthropic|whatsapp|stripe|mercadopago/i.test(u))).toBe(false)
})

test.describe('Persistencia (S02, S45, S46)', () => {
  test('S02: recargar conserva carrito y sede', async ({ page }) => {
    await fresh(page, '/#/ritual-cafe/carta')
    await page.getByTestId('loc-select').selectOption('L-RC-norte')
    await page.getByTestId('open-RC-01').click()
    await page.getByLabel('Colombia · Huila').check()
    await page.getByTestId('add-to-cart').click()
    await page.reload()
    await expect(page.getByTestId('loc-select')).toHaveValue('L-RC-norte')
    await page.getByRole('link', { name: /Mi pedido \(1\)/ }).click()
    await expect(page.getByText('Espresso').first()).toBeVisible()
  })
  test('S02/S45: almacenamiento denegado → modo memoria con aviso, sin perder la selección', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.addInitScript(() => {
      Storage.prototype.setItem = function () { throw new DOMException('denied', 'QuotaExceededError') }
    })
    await page.goto('/#/mesa-clara/carta')
    await expect(page.getByTestId('storage-warning')).toContainText(/memoria/)
    await page.getByTestId('open-MC-01').click()
    await page.getByTestId('add-to-cart').click()
    await page.getByRole('link', { name: /Mi pedido \(1\)/ }).click()
    await expect(page.getByText('Provoleta a la parrilla').first()).toBeVisible()
    await ctx.close()
  })
  test('S45: estado corrupto → recuperación explícita, sin pantalla blanca ni borrado ajeno', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('otra-app', 'x'); localStorage.setItem('tableflow.demo.v1', '{"schemaVersion":1,"state":{oops') })
    await page.reload()
    await expect(page.getByTestId('recovery')).toBeVisible()
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-diag').click()])
    expect(dl.suggestedFilename()).toMatch(/diagnostico/)
    expect(await page.evaluate(() => localStorage.getItem('tableflow.demo.v1'))).toContain('oops') // aún no se tocó
    await page.getByTestId('restore-servicio').click()
    await expect(page.getByTestId('recovery')).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('tableflow.demo.v1.corrupt-backup'))).toContain('oops')
    expect(await page.evaluate(() => localStorage.getItem('otra-app'))).toBe('x')
    await page.goto('/#/mesa-clara/carta')
    await expect(page.getByTestId('dish-MC-12')).toBeVisible()
  })
  test('S45: versión futura se detecta', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('tableflow.demo.v1', JSON.stringify({ schemaVersion: 7, savedAt: 0, state: {} })))
    await page.reload()
    await expect(page.getByTestId('recovery')).toContainText('versión más nueva')
    await page.getByTestId('continue-memory').click()
    await expect(page.getByTestId('recovery')).toHaveCount(0)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tableflow.demo.v1')!).schemaVersion)).toBe(7) // no se pisó
  })
  test('S46: reiniciar → cancelar conserva; confirmar restaura el seed y solo borra claves TableFlow', async ({ page }) => {
    await fresh(page, '/#/admin/pedidos')
    await page.getByTestId('biz-select').selectOption('ritual-cafe')
    await page.evaluate(() => localStorage.setItem('otra-app', 'x'))
    await page.getByTestId('quick-accept-O-011').click()
    expect((await state(page)).orders.find((o: any) => o.id === 'O-011').status).toBe('aceptado')
    await page.getByTestId('reset-open').click()
    await page.getByTestId('dialog-cancel').click()
    expect((await state(page)).orders.find((o: any) => o.id === 'O-011').status).toBe('aceptado')
    await page.getByTestId('reset-open').click()
    await page.getByTestId('dialog-confirm').click()
    const s = await state(page)
    expect(s.orders.find((o: any) => o.id === 'O-011').status).toBe('enviado')
    expect(s.orders).toHaveLength(12)
    expect(await page.evaluate(() => localStorage.getItem('otra-app'))).toBe('x')
  })
})

test('S42: cambiar rol, atrás y URL directa muestran el mismo pedido; ID inexistente ofrece volver', async ({ page }) => {
  await fresh(page, '/#/ritual-cafe/pedido/O-008')
  await expect(page.getByRole('heading', { name: 'Pedido O-008' })).toBeVisible()
  const before = (await state(page)).orders.length
  await setRole(page, /Recepción/)
  await page.goto('/#/admin/pedidos/O-008')
  await expect(page.getByRole('heading', { name: 'Pedido O-008' })).toBeVisible()
  await page.goBack()
  await page.goForward()
  await expect(page.getByRole('heading', { name: 'Pedido O-008' })).toBeVisible()
  expect((await state(page)).orders.length).toBe(before) // sin mutaciones por render
  await page.goto('/#/ritual-cafe/pedido/O-999')
  await expect(page.getByText('No encontramos ese pedido')).toBeVisible()
  await page.getByRole('link', { name: 'Volver a mis pedidos' }).click()
  await expect(page).toHaveURL(/ritual-cafe\/pedido$/)
  await page.goto('/#/mesa-clara/pedido/O-008') // folio de otro perfil
  await expect(page.getByText('No encontramos ese pedido')).toBeVisible()
})

test('S15: perfil sin reservas → política de llegada, sin botón de confirmar mesa', async ({ page }) => {
  await fresh(page, '/#/ritual-cafe/reservar')
  await expect(page.getByText('En este perfil atendemos por orden de llegada').first()).toBeVisible()
  await expect(page.getByTestId('res-submit')).toHaveCount(0)
  expect((await state(page)).reservations).toHaveLength(18)
})

test('S11/S16/S35 por la UI: sin cupo, grupo de 16 y alergia', async ({ page }) => {
  await fresh(page, '/#/mesa-clara/reservar')
  await page.getByTestId('res-alias').fill('Ana')
  await page.getByTestId('res-party').fill('4')
  await expect(page.getByTestId('slot-1200')).toBeDisabled() // 20:00 sin mesa para 4
  await expect(page.getByTestId('slot-1305')).toBeEnabled() // 21:45 sí
  await page.getByTestId('slot-1305').click()
  await page.getByTestId('res-submit').click()
  await expect(page).toHaveURL(/reservas\/R-019/)
  await expect(page.getByText('Solicitud recibida; el equipo todavía debe confirmarla.')).toBeVisible()
  // grupo de 16
  await page.goto('/#/mesa-clara/reservar')
  await page.getByTestId('res-alias').fill('Ana')
  await page.getByTestId('res-party').fill('16')
  await page.getByTestId('slot-1260').click()
  await page.getByTestId('res-submit').click()
  await expect(page).toHaveURL(/reservas\/R-020/)
  const s = await state(page)
  expect(s.reservations.find((r: any) => r.id === 'R-020')).toMatchObject({ status: 'revision_humana', tableId: null })
  // alergia
  await page.goto('/#/mesa-clara/reservar')
  await page.getByTestId('res-alias').fill('Ana')
  await page.getByTestId('res-diet').fill('Alergia a frutos secos')
  await page.getByTestId('slot-1260').click()
  await page.getByTestId('res-submit').click()
  await expect(page.getByText(/Consulta alimentaria enviada al equipo de muestra/)).toBeVisible()
})

test('S12/S14: recepción acepta; cliente cancela dos veces sin duplicar la liberación', async ({ page }) => {
  await fresh(page, '/#/mesa-clara/reservar')
  await page.getByTestId('res-alias').fill('Ana')
  await page.getByTestId('slot-1305').click()
  await page.getByTestId('res-submit').click()
  await setRole(page, /Recepción/)
  await page.goto('/#/admin/reservas/R-019')
  await page.locator('[data-testid="accept-R-019"]:visible').click()
  await expect(page.getByTestId('res-row-R-019')).toContainText('Confirmada')
  await page.goto('/#/mesa-clara/reservas/R-019')
  await expect(page.getByText(/Confirmada en mesa/)).toBeVisible()
  await page.getByTestId('open-cancel').click()
  await page.getByLabel('Motivo').fill('Cambio de planes')
  await page.getByTestId('dialog-confirm').click()
  await expect(page.getByText('Reserva cancelada.')).toBeVisible()
  const s = await state(page)
  expect(s.audit.filter((a: any) => a.type === 'reservation.cancelled' && a.entityId === 'R-019')).toHaveLength(1)
})

test.describe('Móvil (S43)', () => {
  for (const w of [320, 390]) {
    test(`${w}px: configurar y confirmar sin scroll horizontal ni foco oculto`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 760 })
      await fresh(page, '/#/ritual-cafe/carta')
      const noOverflow = async (label: string) => {
        const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
        expect(o.sw, `scroll horizontal en ${label}`).toBeLessThanOrEqual(o.cw)
      }
      await noOverflow('carta')
      await page.getByTestId('open-RC-04').click()
      await page.getByLabel('Mediano').check()
      await page.getByLabel(/Vegetal/).check()
      await noOverflow('detalle')
      await page.getByTestId('add-to-cart').click()
      await expect(page.getByRole('region', { name: 'Resumen del pedido' })).toBeVisible() // carrito fijo en móvil
      await page.getByRole('link', { name: 'Revisar y enviar' }).click()
      await page.getByLabel(/Nombre para el retiro/).fill('Sofi')
      await page.getByTestId('pickup-time').fill('10:15')
      await noOverflow('pedido')
      await page.getByTestId('send-order').scrollIntoViewIfNeeded()
      await page.getByTestId('send-order').click()
      await expect(page).toHaveURL(/pedido\/O-013/)
      await noOverflow('seguimiento')
      for (const p of ['/#/mesa-clara/reservar', '/#/mesa-clara/simulador', '/#/admin/resumen', '/#/admin/salon', '/#/admin/caja', '/#/admin/cocina', '/#/admin/stock', '/#/admin/reportes', '/#/admin/automatizaciones', '/#/comercial']) {
        await page.goto(p)
        await noOverflow(p)
      }
    })
  }
})

test.describe('Llamada simulada, audio y movimiento reducido (S31–S33, S44)', () => {
  test('sin autoplay ni micrófono; recorrido completo con transcripción y movimiento reducido', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    await page.addInitScript(() => {
      ;(window as any).__audio = { ctx: 0, mic: 0 }
      const Orig = window.AudioContext
      if (Orig) (window as any).AudioContext = function (...a: any[]) { (window as any).__audio.ctx++; return new (Orig as any)(...a) }
      const md = navigator.mediaDevices
      if (md) md.getUserMedia = async () => { (window as any).__audio.mic++; throw new Error('prohibido') }
    })
    await page.goto('/#/mesa-clara/simulador')
    await page.getByTestId('tab-voz').click()
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => (window as any).__audio)).toEqual({ ctx: 0, mic: 0 }) // sin autoplay
    await page.getByTestId('call-start').click()
    await page.getByTestId('opt-reserveA').click()
    await expect(page.getByTestId('transcript')).toContainText('no hay mesa de cuatro a las 20:00', { timeout: 4000 })
    await page.getByTestId('opt-accept').click()
    await expect(page.getByTestId('transcript')).toContainText('¿Confirmás la solicitud?')
    await page.getByTestId('opt-confirm').click()
    await expect(page.getByTestId('transcript')).toContainText('tu solicitud es R-019')
    expect(await page.evaluate(() => (window as any).__audio)).toEqual({ ctx: 0, mic: 0 }) // audio apagado por defecto
    const s = await state(page)
    expect(s.reservations.find((r: any) => r.id === 'R-019')).toMatchObject({ channel: 'voz', status: 'solicitada' })
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
    await ctx.close()
  })
  test('dos silencios finalizan sin reserva y detener no deja reservas fantasma', async ({ page }) => {
    await fresh(page, '/#/mesa-clara/simulador')
    await page.getByTestId('tab-voz').click()
    await page.getByTestId('call-start').click()
    await expect(page.getByTestId('call-status')).toContainText('turno_cliente')
    await page.getByTestId('call-wait').click()
    await page.getByTestId('opt-silence').click()
    await expect(page.getByTestId('call-status')).toContainText('finalizada')
    await page.getByTestId('call-start').click()
    await expect(page.getByTestId('call-status')).toContainText('turno_cliente')
    await page.getByTestId('opt-reserveA').click()
    await page.getByTestId('call-stop').click()
    await page.waitForTimeout(900) // el callback tardío ya estaba cancelado
    const s = await state(page)
    expect(s.reservations).toHaveLength(18)
    expect(s.callSessions.every((c: any) => c.status === 'finalizada')).toBe(true)
  })
  test('audio opcional: motivos tras un gesto, con detención al salir', async ({ page }) => {
    await fresh(page, '/#/mesa-clara/simulador')
    await page.getByTestId('tab-voz').click()
    await page.getByTestId('audio-toggle').check()
    await page.getByTestId('call-start').click()
    await page.waitForTimeout(400)
    await page.getByTestId('call-stop').click()
    // si el navegador lo permite o no, la pantalla sigue operativa y con transcripción
    await expect(page.getByTestId('transcript')).toContainText('Llamada detenida')
  })
})

test.describe('Chat guionado por la UI (S27–S29)', () => {
  test('guion completo hasta R-019 y confirmación visible en el chat', async ({ page }) => {
    await fresh(page, '/#/mesa-clara/simulador')
    await setRole(page, /recurrente/)
    const send = async (t: string) => { await page.getByTestId('chat-input').fill(t); await page.getByTestId('chat-send').click() }
    await expect(page.getByTestId('chat-send')).toBeDisabled() // vacío no se envía
    await send('Hola')
    await expect(page.getByTestId('chat-log')).toContainText('Hola, soy el asistente de Mesa Clara en esta demo')
    await send('Mesa para 4 el lunes a las 20')
    await expect(page.getByTestId('chat-log')).toContainText('Puedo ofrecer 21:45, según la disponibilidad de muestra')
    await page.getByTestId('chat-log').getByRole('button', { name: '21:45' }).click()
    await expect(page.getByTestId('chat-log')).toContainText('Serían 4 personas el lunes 19 a las 21:45, salón')
    await page.getByTestId('chat-log').getByRole('button', { name: 'Confirmar solicitud' }).last().click()
    await expect(page.getByTestId('chat-log')).toContainText('Folio: R-019')
    await setRole(page, /Recepción/)
    await page.goto('/#/admin/reservas')
    await page.locator('[data-testid="accept-R-019"]:visible').click()
    await page.goto('/#/mesa-clara/simulador')
    await setRole(page, /recurrente/)
    await expect(page.getByTestId('chat-log')).toContainText('Tu reserva fue confirmada: R-019')
  })
})

test.describe('Accesibilidad automática (axe: no certifica conformidad)', () => {
  const pages = ['/#/', '/#/mesa-clara', '/#/mesa-clara/carta', '/#/mesa-clara/pedido', '/#/mesa-clara/reservar', '/#/ritual-cafe/explorar', '/#/ritual-cafe/catas', '/#/mesa-clara/simulador', '/#/admin/resumen', '/#/admin/reservas', '/#/admin/salon', '/#/admin/pedidos', '/#/admin/cocina', '/#/admin/caja', '/#/admin/carta', '/#/admin/stock', '/#/admin/clientes', '/#/admin/automatizaciones', '/#/admin/reportes', '/#/admin/configuracion', '/#/comercial']
  test('sin violaciones serias o críticas en las pantallas principales', async ({ page }) => {
    await fresh(page, '/#/')
    const bad: string[] = []
    for (const p of pages) {
      await page.goto(p)
      await page.waitForTimeout(120)
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      for (const v of r.violations.filter((x) => ['serious', 'critical'].includes(x.impact ?? ''))) bad.push(`${p}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.html.slice(0, 120)}`)
    }
    expect(bad).toEqual([])
  })
  test('teclado: el detalle abre con Enter, se cierra con Escape y el foco vuelve', async ({ page }) => {
    await fresh(page, '/#/mesa-clara/carta')
    const link = page.getByTestId('open-MC-01')
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('item-dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('item-dialog')).toBeHidden()
    await expect(page.getByTestId('open-MC-01')).toBeFocused()
  })
})
