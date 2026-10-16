import { test, expect } from '@playwright/test'

test('arranca y muestra el banner DEMO', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto('/')
  await expect(page.getByText('Datos ficticios').first()).toBeVisible()
  await page.screenshot({ path: 'e2e/screens/landing.png', fullPage: true })
  await page.goto('/#/mesa-clara/carta')
  await expect(page.getByTestId('dish-MC-12')).toBeVisible()
  await page.screenshot({ path: 'e2e/screens/carta.png', fullPage: true })
  expect(errors).toEqual([])
})
