import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@wearegeng/agent': resolve(__dirname, 'packages/agent'),
    },
  },
  test: {
    include: ['packages/agent/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/vendor/**', 'dist/**'],
  },
})
