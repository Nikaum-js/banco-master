import path from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

// Testes da lógica de jogo são puros (sem DOM) — ambiente node (default). Os testes de
// componente (spec 042, FR-026) vivem só em `tests/ui/**/*.test.tsx` e sobem pra jsdom via
// pragma por arquivo (`// @vitest-environment jsdom` na 1ª linha — `environmentMatchGlob`
// não existe mais no vitest 4). Aditivo: nenhum `.test.ts` existente muda de ambiente.
// Os lotes headless (300 partidas seedadas) ficam FORA do `vitest run` padrão: são gate de
// simulação, não teste unitário. No job generalista disputavam os 2 vCPUs com ~100 outros
// arquivos e o lote de 6 jogadores estourou 180s (run 30233981454), enquanto o job
// `simulation` — feito pra isso — rodava um lote curto sozinho num runner inteiro.
// `SIM=1` reabre a exclusão; é o que `bun run test:sim` faz. Precisa ser interruptor e não
// só filtro de linha de comando porque `exclude` do config vence caminho explícito.
const RUN_SIM = process.env.SIM === '1'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: RUN_SIM ? configDefaults.exclude : [...configDefaults.exclude, 'tests/sim/headless/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
