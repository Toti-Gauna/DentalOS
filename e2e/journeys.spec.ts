import { test, expect } from '@playwright/test'
import { fresh, jump, setRole, state } from './helpers'

test.describe('Recorrido protagonista: restaurante (Mesa Clara)', () => {
  test('carta → plato con modificadores → pedido → recepción → cocina → servido → división de cuenta → cierre', async ({ page }) => {
    await fresh(page, '/#/mesa-clara')
    // el salón abre a las 12:00: se avanza el reloj de la demo
    await jump(page, 'Ir a las 12:00 (almuerzo)')
    await expect(page.getByTestId('sim-clock')).toContainText('12:00')
    await page.getByRole('link', { name: 'Carta', exact: true }).click()
    await page.getByTestId('open-MC-12').click()
    await expect(page.getByTestId('item-dialog')).toBeVisible()
    // falta guarnición: error junto al grupo y no agrega
    await page.getByTestId('add-to-cart').click()
    await expect(page.getByRole('alert').filter({ hasText: 'Elegí guarnición' })).toBeVisible()
    await page.getByLabel('Papas fritas').check()
    await page.getByRole('button', { name: 'Más' }).click()
    await expect(page.getByTestId('subtotal')).toHaveText('$ 37.000,00')
    await page.getByTestId('add-to-cart').click()
    await page.getByRole('link', { name: /Mi pedido/ }).first().click()
    await page.getByTestId('mesa-select').selectOption({ label: /M2 ·/ as never }).catch(async () => {
      await page.getByTestId('mesa-select').selectOption('T-MC-02')
    })
    // doble clic: un solo folio
    await page.getByTestId('send-order').dblclick()
    await expect(page).toHaveURL(/pedido\/O-013/)
    expect((await state(page)).orders.filter((o: any) => o.operationId).length).toBe(13)
    await expect(page.getByRole('heading', { name: 'Pedido O-013' })).toBeVisible()
    await expect(page.getByText('Solicitud recibida; el equipo todavía debe aceptarla.')).toBeVisible()

    // recepción acepta
    await setRole(page, /Recepción/)
    await page.goto('/#/admin/pedidos/O-013')
    await page.getByTestId('admin-accept').click()
    await expect(page.locator('.callout.ok')).toContainText('O-013 aceptado')

    // cocina prepara y marca listo; el mozo sirve
    await setRole(page, /Cocina/)
    await page.getByTestId('nav-cocina').click()
    await page.getByTestId('k-prepare-O-013').click()
    await page.getByTestId('k-ready-O-013').click()
    await page.getByTestId('k-deliver-O-013').click()
    expect((await state(page)).orders.find((o: any) => o.id === 'O-013').status).toBe('servido')

    // caja: abrir, dividir en 3, pagar, cerrar
    await setRole(page, /Caja/)
    await page.getByTestId('nav-caja').click()
    await page.getByTestId('float').fill('20000')
    await page.getByTestId('open-cash').click()
    const acct = page.locator('[data-testid^="acct-S-"]').last()
    await acct.click()
    await page.getByTestId('split-n').fill('3')
    await page.getByTestId('split-btn').click()
    await expect(page.getByTestId('shares')).toContainText('$ 12.333,33')
    for (const i of [0, 1, 2]) await page.getByTestId(`pay-share-${i}`).click()
    await expect(page.getByTestId('balance')).toHaveText('$ 0,00')
    await expect(page.getByTestId('receipt')).toHaveCount(3)
    await page.getByTestId('close-account').click()
    const s = await state(page)
    expect(s.orders.find((o: any) => o.id === 'O-013').status).toBe('cerrado')
    expect(s.payments.filter((p: any) => p.sessionId === s.orders.find((o: any) => o.id === 'O-013').sessionId).reduce((a: number, p: any) => a + p.amountCents, 0)).toBe(3_700_000)
    await page.screenshot({ path: 'e2e/screens/restaurante-caja.png', fullPage: true })
  })
})

test.describe('Recorrido cafetería (Ritual Café)', () => {
  test('sede → café configurado → retiro → barra acepta → listo → retiro', async ({ page }) => {
    await fresh(page, '/#/ritual-cafe/carta')
    await page.getByTestId('loc-select').selectOption('L-RC-norte')
    await expect(page.getByTestId('dish-RC-07')).toHaveCount(0) // el V60 solo se sirve en Centro
    await page.getByTestId('loc-select').selectOption('L-RC-centro')
    await page.getByTestId('open-RC-04').click()
    await page.getByLabel('Mediano').check()
    await page.getByLabel(/Vegetal/).check()
    await expect(page.getByTestId('subtotal')).toHaveText('$ 7.300,00')
    await page.getByTestId('add-to-cart').click()
    await page.getByRole('link', { name: /Mi pedido/ }).first().click()
    await page.getByTestId('pickup-time').fill('10:15')
    await page.getByLabel(/Nombre para el retiro/).fill('Sofi')
    await page.getByTestId('send-order').click()
    await expect(page).toHaveURL(/pedido\/O-013/)
    await setRole(page, /Cocina/)
    await page.getByTestId('nav-cocina').click()
    await page.getByTestId('station-barra').click()
    await page.getByTestId('k-accept-O-013').click()
    await page.getByTestId('k-prepare-O-013').click()
    await page.getByTestId('k-ready-O-013').click()
    await page.goto('/#/ritual-cafe/pedido/O-013')
    await expect(page.getByText('¡Listo!')).toBeVisible()
    await expect(page.getByText(/código 013/)).toBeVisible()
    await page.goto('/#/admin/cocina')
    await page.getByTestId('k-deliver-O-013').click()
    expect((await state(page)).orders.find((o: any) => o.id === 'O-013').status).toBe('retirado')
    await page.screenshot({ path: 'e2e/screens/cafe-cocina.png', fullPage: true })
  })
})
