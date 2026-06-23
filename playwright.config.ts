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

// Quais servidores subir. O `webServer` do Playwright é GLOBAL — não dá pra amarrar um
// servidor a um projeto —, então toda invocação subia os DOIS, e o job que só roda specs de
// dev server pagava um `vite build` inteiro (~25s) para um preview que nenhum teste abria.
// `PW_SERVERS` corta isso onde se sabe o escopo (a CI); o default continua subindo ambos,
// porque localmente `bunx playwright test` sem argumento roda specs dos dois projetos.
const SERVER_SCOPES = ['both', 'dev', 'built'] as const
type ServerScope = (typeof SERVER_SCOPES)[number]

const rawScope = process.env.PW_SERVERS ?? 'both'
if (!SERVER_SCOPES.includes(rawScope as ServerScope)) {
  // Falhar aqui, e não com "connection refused" no meio do teste: um typo em `PW_SERVERS`
  // silenciosamente derrubaria o servidor que as specs selecionadas precisam.
  throw new Error(`PW_SERVERS inválido: "${rawScope}". Esperado um de: ${SERVER_SCOPES.join(', ')}.`)
}
const serverScope = rawScope as ServerScope
const wantsDevServer = serverScope !== 'built'
const wantsBuiltServer = serverScope !== 'dev'

// Quantos workers. Ver a nota em `workers:` — o default 1 é o que a spec multiplayer exige,
// e só quem sabe que não vai rodá-la (os jobs de browser da CI) levanta esse número.
const workers = Number(process.env.PW_WORKERS) || 1

const devServer = {
  command: 'bun run dev',
  url: 'http://localhost:5173',
  reuseExistingServer: !process.env.CI,
  timeout: 30_000,
}

const builtServer = {
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
}

export default defineConfig({
  testDir: './e2e',
  // Os smokes longos de 2/3/6 jogadores usam reduced-motion: provam os mesmos comandos e
  // estados sem pagar ~1s por rolagem. A coreografia normal fica isolada em
  // diceAnimation.spec.ts. O teto alto continua necessário para multiplayer/infra real.
  timeout: 240_000,
  // UM worker por default (043, T045), e o motivo é UMA spec. Os smokes (2/3/6 jogadores)
  // dirigem centenas de comandos pela UI real; a spec multiplayer é limitada por LATÊNCIA,
  // esperando difusão de rede com tetos de 20s. Rodando juntas na mesma máquina, as
  // primeiras matam de fome a segunda — medido: a multiplayer leva 7s sozinha e 4 MINUTOS
  // em paralelo, estourando os tetos e falhando por contenção, não por defeito. Um teste
  // que só passa quando a máquina está livre não prova nada.
  //
  // O que essa medição NÃO justifica é serializar quem não depende de rede. Os jobs de
  // browser da CI não rodam `multiplayer.spec.ts` (precisa de credencial e de infra real),
  // então lá o `1` só estava desperdiçando os vCPUs do runner: eles levantam `PW_WORKERS`.
  // O default continua 1, que é o que vale numa execução local sem argumento — a única
  // que pode arrastar a multiplayer junto.
  workers,
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
  webServer: [...(wantsDevServer ? [devServer] : []), ...(wantsBuiltServer ? [builtServer] : [])],
})
