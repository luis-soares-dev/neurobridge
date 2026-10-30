// Testes de ponta a ponta no navegador. O Supabase é simulado pela interceptação de rede
// (e2e/fixtures.ts): nenhum teste acessa o banco real.
import { defineConfig } from '@playwright/test'

const PORT = 5175

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 120_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Localmente usa o Chrome instalado; na CI, o Chromium do Playwright.
    channel: process.env.CI ? undefined : 'chrome',
    locale: 'pt-BR',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54399',
      VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
    },
  },
})
