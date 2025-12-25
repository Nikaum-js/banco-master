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

export default defineConfig({
  testDir: './e2e',
  // Os smokes longos de 2/3/6 jogadores usam reduced-motion: provam os mesmos comandos e
  // estados sem pagar ~1s por rolagem. A coreografia normal fica isolada em
  // diceAnimation.spec.ts. O teto alto continua necessário para multiplayer/infra real.
  timeout: 240_000,
  // UM worker (043, T045). Os smokes (2/3/6 jogadores) dirigem centenas de comandos pela
  // UI real. A spec multiplayer é limitada por LATÊNCIA:
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
  projects: [
    {
      // Smoke E2E (036) + multiplayer (038/042) — dev server, como sempre foi.
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [
        '**/fullMatch.spec.ts',
        '**/a11y.spec.ts',
        '**/avatarSkins.spec.ts',
        '**/responsive.spec.ts',
        '**/pregao.spec.ts',
      ],
    },
    {
      // FR-051 (044/T052): partida completa e acessibilidade rodam sobre a versão
      // CONSTRUÍDA — o que o CI promoveria —, nunca o dev server.
      name: 'built',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173' },
      // `responsive.spec.ts` entra aqui pelo mesmo motivo dos outros três, e por
      // um a mais: a rota 404 de verdade só existe no preview (o fallback está em
      // `configurePreviewServer`), então em dev o gate de 404 mediria uma página
      // que o Vite nunca serviu.
      testMatch: [
        '**/fullMatch.spec.ts',
        '**/a11y.spec.ts',
        '**/avatarSkins.spec.ts',
        '**/responsive.spec.ts',
        // D-078: o pregão passa a caber até seis lotes, e a prova é geométrica (alvo de
        // toque, transbordo, ação alcançável em 667×375 e 740×360). Mesma razão dos outros:
        // o que se promove é o bundle.
        '**/pregao.spec.ts',
      ],
    },
  ],
  webServer: [
    {
      command: 'bun run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // `build && preview` no mesmo comando: cada execução audita um bundle fresco, nunca
      // um `dist/` esquecido de uma rodada anterior.
      command: 'bun run build && bun run preview -- --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? FAKE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? FAKE_SUPABASE_ANON_KEY,
      },
    },
  ],
})
