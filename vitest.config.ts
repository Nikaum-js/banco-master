import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Testes da lógica de jogo são puros (sem DOM) — ambiente node.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
