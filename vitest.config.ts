import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Testes da lógica de jogo são puros (sem DOM) — ambiente node (default). Os testes de
// componente (spec 042, FR-026) vivem só em `tests/ui/**/*.test.tsx` e sobem pra jsdom via
// pragma por arquivo (`// @vitest-environment jsdom` na 1ª linha — `environmentMatchGlob`
// não existe mais no vitest 4). Aditivo: nenhum `.test.ts` existente muda de ambiente.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
