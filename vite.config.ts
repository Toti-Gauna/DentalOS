/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// CSP solo en el build (el dev server de Vite necesita websocket para HMR).
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'";
const cspPlugin = (): Plugin => ({
  name: 'dentalos-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

// base relativa: funciona en GitHub Pages (subruta) y en preview local. Rutas hash: sin rewrites.
export default defineConfig({
  base: './',
  plugins: [react(), cspPlugin()],
  build: { assetsInlineLimit: 0, sourcemap: false, chunkSizeWarningLimit: 700, modulePreload: { polyfill: false } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
