import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

// Usa el Chromium ya instalado en el entorno si existe (no se descarga nada).
const candidates = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
const executablePath = process.env.PW_CHROMIUM ?? candidates.find((p) => existsSync(p))

export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    trace: 'off',
    launchOptions: { executablePath, args: ['--no-sandbox'] },
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
