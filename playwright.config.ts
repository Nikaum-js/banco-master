// Smoke E2E (036/US3) — roteiro fixo determinístico pela UI real, dev-only.
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Cada turno depende de animações reais (rolagem ~1s + passo do peão). Com o passo
  // decidido num único page.evaluate (script.ts), 6 jogadores × 10 rodadas ficou em
  // ~1min20 no benchmark de implementação — 150s dá margem sem se aproximar do teto
  // de 5 min do SC-005.
  timeout: 240_000,
  // UM worker (043, T045). As specs de simulação (2/3/6 jogadores) são limitadas por CPU:
  // dirigem centenas de turnos pela UI real. A spec multiplayer é limitada por LATÊNCIA:
  // espera difusão de rede com tetos de 20s. Rodando juntas na mesma máquina, as primeiras
  // matam de fome a segunda — medido: a multiplayer leva 7s sozinha e 4 MINUTOS em paralelo,
  // estourando os tetos e falhando por contenção, não por defeito. Um teste que só passa
  // quando a máquina está livre não prova nada; serializar troca tempo de parede por um
  // resultado que significa a mesma coisa toda vez.
  workers: 1,
  fullyParallel: false,
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
