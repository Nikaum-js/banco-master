import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { validateSupabaseEnv } from './src/config/supabaseEnv'

// Referência do commit publicado (044, FR-048): aparece no rodapé da home e vira o
// `release` do Sentry, para um relato de erro apontar a versão exata. A Vercel e o
// GitHub Actions já expõem o sha; local fica vazio e o rodapé simplesmente não mostra.
const COMMIT_SHA =
  process.env.VITE_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? ''

/**
 * Build de PRODUÇÃO sem as variáveis obrigatórias falha aqui, em vez de publicar uma
 * tela branca (044, FR-047). O rigor só vale onde publicar é o resultado: na Vercel
 * (`VERCEL=1`) ou quando alguém pede explicitamente (`REQUIRE_ENV=1`). O `bun run build`
 * do CI e do desenvolvimento continua passando sem credencial — ele existe para provar
 * que o bundle compila, não para publicar.
 */
function requireEnv(): Plugin {
  return {
    name: 'magnata-imobiliario:require-env',
    apply: 'build',
    config(_, { mode }) {
      if (process.env.VERCEL !== '1' && process.env.REQUIRE_ENV !== '1') return
      const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
      const issues = validateSupabaseEnv({
        url: env.VITE_SUPABASE_URL,
        anonKey: env.VITE_SUPABASE_ANON_KEY,
      })
      if (issues.length > 0) {
        throw new Error(
          `[magnata-imobiliario] build de produção abortado: configuração Supabase inválida (${issues.join(', ')}). ` +
            `Sem elas a sala não persiste e o jogo sobe quebrado — ver docs/RUNBOOK.md §0.`,
        )
      }
    },
  }
}

/**
 * Domínio público do site (051). Canonical, Open Graph, robots.txt e sitemap.xml saem
 * daqui — nunca hardcoded nas páginas. Sem `VITE_SITE_URL` no ambiente, vale o domínio
 * de produção da Vercel que já era o canonical antes da landing existir.
 */
const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://magnata-imobiliario.vercel.app').replace(/\/+$/, '')

/**
 * Página de apoio voluntário, linkada no rodapé das três páginas públicas. Mora aqui
 * pelo mesmo motivo do SITE_URL: repetida em três HTML ela existiria só para divergir.
 *
 * Livepix, e a escolha é por AVULSO: o gesto que o rodapé oferece é alguém dar R$ 10 uma
 * vez e seguir a vida, não assinar nada. Apoia.se e Catarse são recorrentes por desenho
 * (modelo Patreon) e resolveriam outro problema. Entre os de doação avulsa, Livepix aceita
 * Pix e cobra em real — num público brasileiro que doa valor pequeno, pedir cartão é o que
 * mais derruba conversão. Nenhuma delas cobra mensalidade de quem recebe: a conta é
 * percentual sobre o que entra, então mês sem doação custa zero.
 *
 * Pix direto sairia de graça e foi descartado por custo TÉCNICO, não financeiro: "copiar
 * chave" exige JavaScript, e estas páginas têm zero JS por contrato (scripts/audit-marketing-bundle.ts
 * quebra o CI se vazar um). Página hospedada é um `href` e não pesa no bundle.
 *
 * `VITE_SUPPORT_URL` sobrescreve sem tocar no código — é por onde a página muda se a
 * plataforma mudar.
 */
const SUPPORT_URL = process.env.VITE_SUPPORT_URL ?? 'https://livepix.gg/nikaum'

/** Perfil do autor. Mesma razão de morar aqui: repetido em três páginas. */
const AUTHOR_GITHUB_URL = process.env.VITE_AUTHOR_GITHUB_URL ?? 'https://github.com/Nikaum-js'

// Params que sempre significaram "estou indo pro jogo" quando apareciam na raiz.
// `/` agora é a landing: quem chega com um deles é redirecionado pra `/play` com a
// query intacta — é o mesmo contrato dos redirects do vercel.json, valendo em dev e
// preview (o E2E roda nos dois). A lista cobre convite (`room`), criação (`host`),
// andaime local (`local`/`players`), e os hooks de dev/E2E.
const GAME_QUERY_PARAMS = ['room', 'host', 'local', 'players', 'multi', 'sons', 'ui-lab', 'e2eCrashCasca', 'scenario']

// Rotas limpas de marketing/jogo → arquivo HTML do build MPA (051). Em produção quem
// faz isso são os rewrites do vercel.json; aqui é a paridade pro dev server e pro preview.
const CLEAN_ROUTES: Record<string, string> = {
  // Com appType 'mpa' o preview perde o fallback que servia a raiz — o mapeamento
  // explícito devolve o index sem reabrir o catch-all de SPA.
  '/': '/index.html',
  '/play': '/play.html',
  '/how-to-play': '/how-to-play.html',
  '/faq': '/faq.html',
}

function marketingRoutes(): Plugin {
  const middleware = (
    req: { url?: string },
    res: { statusCode: number; setHeader(k: string, v: string): void; end(): void },
    next: () => void,
  ) => {
    const url = new URL(req.url ?? '/', 'http://local.test')
    if (url.pathname === '/' && GAME_QUERY_PARAMS.some((p) => url.searchParams.has(p))) {
      res.statusCode = 307
      res.setHeader('Location', `/play${url.search}`)
      res.end()
      return
    }
    const target = CLEAN_ROUTES[url.pathname]
    if (target) req.url = `${target}${url.search}`
    next()
  }
  return {
    name: 'magnata-imobiliario:marketing-routes',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
      // Pós-middleware (roda DEPOIS do static): rota desconhecida responde o 404 real,
      // com status 404 — a mesma semântica que a Vercel dá ao dist/404.html. Sem isso o
      // preview devolvia 200 vazio (appType mpa) e a validação de status mentia.
      return () => {
        server.middlewares.use((_req, res) => {
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(fs.readFileSync(path.resolve(__dirname, 'dist/404.html'), 'utf-8'))
        })
      }
    },
  }
}

/**
 * Metadados de site (051, FR-007): troca `%SITE_URL%` nos HTML (canonical/OG absolutos),
 * injeta a meta de verificação do Search Console quando `VITE_GSC_VERIFICATION` existir
 * (passo manual documentado em docs/SEO.md) e emite robots.txt + sitemap.xml no build —
 * gerados aqui para nunca divergirem do domínio configurado.
 */
function siteMeta(): Plugin {
  // Só conteúdo público entra no sitemap. `/play` é a aplicação privada; qualquer
  // `?room=<id>` serve o mesmo HTML com `noindex`, então nenhuma credencial vira URL SEO.
  const routes = ['/', '/how-to-play', '/faq']
  return {
    name: 'magnata-imobiliario:site-meta',
    transformIndexHtml(html) {
      const gsc = process.env.VITE_GSC_VERIFICATION
      return {
        html: html
          .replaceAll('%SITE_URL%', SITE_URL)
          .replaceAll('%SUPPORT_URL%', SUPPORT_URL)
          .replaceAll('%AUTHOR_GITHUB_URL%', AUTHOR_GITHUB_URL),
        tags: gsc
          ? [{ tag: 'meta', attrs: { name: 'google-site-verification', content: gsc }, injectTo: 'head' as const }]
          : [],
      }
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
      })
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...routes.map((route) => `  <url><loc>${SITE_URL}${route === '/' ? '/' : route}</loc></url>`),
          '</urlset>',
          '',
        ].join('\n'),
      })
    },
  }
}

export default defineConfig({
  // MPA de verdade (051): sem fallback de history pro index.html — a raiz é a landing
  // e rota desconhecida é 404, como em produção (Vercel serve dist/404.html).
  appType: 'mpa',
  define: {
    'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(COMMIT_SHA),
  },
  plugins: [
    requireEnv(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    marketingRoutes(),
    siteMeta(),
  ],
  build: {
    // O manifest é a PROVA da separação de bundles (051, FR-006/SC-003): a auditoria
    // pós-build lê daqui que os entrypoints de marketing não alcançam Supabase/engine.
    manifest: true,
    rollupOptions: {
      input: {
        landing: path.resolve(__dirname, 'index.html'),
        play: path.resolve(__dirname, 'play.html'),
        howToPlay: path.resolve(__dirname, 'how-to-play.html'),
        faq: path.resolve(__dirname, 'faq.html'),
        notFound: path.resolve(__dirname, '404.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    fs: {
      // Rodando de uma worktree do git (`.claude/worktrees/<nome>`), o `node_modules` que
      // resolve é o da raiz do repositório — FORA da raiz servida. Sem liberá-lo, o Vite
      // recusa os arquivos de fonte com 403, e o E2E — que trata todo erro de console como
      // falha — quebra por motivo de ambiente, não de código. No checkout principal o caminho
      // encontrado é o próprio, e esta entrada não muda nada.
      allow: [__dirname, ...nodeModulesDirs()],
    },
  },
})

// TODOS os `node_modules` da árvore acima, não só o primeiro: numa worktree existe um
// `node_modules` local raso, e o store de verdade (`.pnpm/…`, de onde saem os arquivos de
// fonte) fica no da RAIZ do repositório. Parar no primeiro deixaria o segundo de fora, que é
// exatamente o que estava dando 403. Caminho REAL, porque o pnpm resolve por symlink e é o
// alvo que o Vite confere.
function nodeModulesDirs(): string[] {
  const found: string[] = []
  let dir = __dirname
  for (;;) {
    const candidate = path.join(dir, 'node_modules')
    if (fs.existsSync(candidate)) found.push(fs.realpathSync(candidate))
    const parent = path.dirname(dir)
    if (parent === dir) return found
    dir = parent
  }
}
