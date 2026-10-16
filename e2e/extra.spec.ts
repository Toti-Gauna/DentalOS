import { test, expect } from '@playwright/test'
import { fresh, setRole, state } from './helpers'

test('S05/S09 por la UI: pedido vacío sin folio; búsqueda sin resultados y limpieza', async ({ page }) => {
  await fresh(page, '/#/mesa-clara/pedido')
  await page.getByTestId('send-empty').click()
  await expect(page.getByTestId('order-error')).toContainText('Tu pedido está vacío')
  await expect(page.getByText(/Pedido O-013/)).toHaveCount(0)
  expect((await state(page)).orders).toHaveLength(12)
  await page.goto('/#/mesa-clara/carta')
  await page.getByTestId('menu-search').fill('zzz123')
  await expect(page.getByText('No encontramos platos con esos filtros')).toBeVisible()
  await page.getByTestId('clear-filters').click()
  await expect(page.getByTestId('dish-MC-12')).toBeVisible()
  await page.getByTestId('menu-search').fill('pasta')
  await expect(page.getByTestId('dish-MC-07')).toBeVisible() // encuentra variantes por etiqueta
})

test('S10 por la UI: retiro 03:00 → fuera de horario con próximas franjas válidas y sin pedido', async ({ page }) => {
  await fresh(page, '/#/ritual-cafe/carta')
  await page.getByTestId('open-RC-01').click()
  await page.getByLabel('Colombia · Huila').check()
  await page.getByTestId('add-to-cart').click()
  await page.goto('/#/ritual-cafe/pedido')
  await page.getByLabel(/Nombre para el retiro/).fill('Sofi')
  await page.getByTestId('pickup-time').fill('03:00')
  await page.getByTestId('send-order').click()
  await expect(page.getByTestId('order-error')).toContainText('Fuera de horario')
  await expect(page.getByTestId('order-error')).toContainText('10:15')
  expect((await state(page)).orders).toHaveLength(12)
})

test('S24 por la UI: el pago reintentado con el mismo comprobante no se duplica', async ({ page }) => {
  await fresh(page, '/#/admin/caja')
  await setRole(page, /Caja/)
  await page.getByTestId('biz-select').selectOption('ritual-cafe')
  await page.goto('/#/admin/caja')
  await page.locator('[data-testid^="acct-S-"]').first().click()
  await page.getByTestId('pay-amount').fill('1000')
  await page.getByTestId('pay-btn').click()
  const n = (await state(page)).payments.length
  await page.getByTestId('pay-retry').click()
  expect((await state(page)).payments.length).toBe(n)
  await expect(page.getByTestId('receipt')).toHaveCount(1)
})
