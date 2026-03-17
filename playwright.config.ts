// Smoke E2E (036/US3) — roteiro fixo determinístico pela UI real, dev-only. Estendido em
// 044/T052 (FR-051) com um segundo projeto (`built`) que roda sobre `vite preview`: o gate
// de partida completa e o de acessibilidade precisam provar o que de fato seria promovido,
// não o dev server.
import { defineConfig, devices } from '@playwright/test'

// Credenciais Supabase FALSAS (044/T052) — só para `isSupabaseConfigured()` devolver `true`
// e o projeto `built` alcançar a tela de lobby (`?host=1`) em vez de "Multiplayer
// indisponível". Nunca abrem conexão de verdade: nenhum teste do gate padrão SUBMETE o
// formulário (`e2e/a11y.spec.ts` só audita a tela). Se `VITE_SUPABASE_URL`/
// `VITE_SUPABASE_ANON_KEY` reais já estiverem no ambiente, eles prevalecem — isto é só o piso.
const FAKE_SUPABASE_URL = 'https://e2e-placeholder.supabase.co'
const FAKE_SUPABASE_ANON_KEY = 'sb_publishable_e2e_placeholder_key_x'

function testPort(name: string, fallback: string): string {
  const value = process.env[name] ?? fallback
  if (!/^\d{2,5}$/.test(value) || Number(value) > 65_535) {
    throw new Error(`${name} precisa ser uma porta TCP válida`)
  }
  return value
}

const DEV_PORT = testPort('PLAYWRIGHT_DEV_PORT', '5173')
const PREVIEW_PORT = testPort('PLAYWRIGHT_PREVIEW_PORT', '4173')

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
    baseURL: `http://localhost:${DEV_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // Smoke E2E (036) + multiplayer (038/042) — dev server, como sempre foi.
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/fullMatch.spec.ts', '**/a11y.spec.ts', '**/avatarSkins.spec.ts'],
    },
    {
      // FR-051 (044/T052): partida completa e acessibilidade rodam sobre a versão
      // CONSTRUÍDA — o que o CI promoveria —, nunca o dev server.
      name: 'built',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PREVIEW_PORT}` },
      testMatch: ['**/fullMatch.spec.ts', '**/a11y.spec.ts', '**/avatarSkins.spec.ts'],
    },
  ],
  webServer: [
    {
      command: `bun run dev -- --port ${DEV_PORT} --strictPort`,
      url: `http://localhost:${DEV_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // `build && preview` no mesmo comando: cada execução audita um bundle fresco, nunca
      // um `dist/` esquecido de uma rodada anterior.
      command: `bun run build && bun run preview -- --port ${PREVIEW_PORT} --strictPort`,
      url: `http://localhost:${PREVIEW_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? FAKE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? FAKE_SUPABASE_ANON_KEY,
      },
    },
  ],
})
