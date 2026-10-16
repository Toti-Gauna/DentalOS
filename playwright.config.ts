import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// Usa el Chromium preinstalado del entorno si existe (sin descargar navegadores); en CI usa el instalado por Playwright.
const local = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium';
const executablePath = existsSync(local) ? local : undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  reporter: process.env.CI ? 'list' : 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: executablePath ? { executablePath } : {},
    trace: 'off',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
