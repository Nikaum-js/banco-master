// Smoke E2E (036/US3) — roteiro fixo determinístico pela UI real, dev-only.
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Cada turno depende de animações reais (rolagem ~1s + passo do peão). Com o passo
  // decidido num único page.evaluate (script.ts), 6 jogadores × 10 rodadas ficou em
  // ~1min20 no benchmark de implementação — 150s dá margem sem se aproximar do teto
  // de 5 min do SC-005 (os 3 specs rodam em paralelo, um por worker).
  timeout: 150_000,
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
