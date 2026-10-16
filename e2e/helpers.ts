import { expect, type Page } from '@playwright/test'

export async function setRole(page: Page, label: RegExp) {
  const opts = await page.getByTestId('role-select').locator('option').allTextContents()
  const m = opts.find((o) => label.test(o))
  if (!m) throw new Error(`rol no encontrado: ${label}`)
  await page.getByTestId('role-select').selectOption({ label: m })
}
export async function state(page: Page) {
  return page.evaluate(() => (window as any).__tableflow.getState())
}
export async function fresh(page: Page, path = '/') {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.goto(path)
  await page.reload()
  await expect(page.getByText('Datos ficticios').first()).toBeVisible()
}
export async function jump(page: Page, label: string) {
  await page.getByTestId('clock-jump').selectOption({ label })
}
