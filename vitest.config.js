import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.js', 'tests/**/*.test.ts'],
    exclude: ['.claude/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
