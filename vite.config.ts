import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // .claude/ guarda cópias de trabalho de outras sessões; e2e/ roda no Playwright.
    exclude: [...configDefaults.exclude, '.claude/**', 'e2e/**'],
  },
})
