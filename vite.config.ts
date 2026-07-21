import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

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
  const REQUIRED = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
  return {
    name: 'banco-master:require-env',
    apply: 'build',
    config(_, { mode }) {
      if (process.env.VERCEL !== '1' && process.env.REQUIRE_ENV !== '1') return
      const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
      const missing = REQUIRED.filter((k) => !env[k])
      if (missing.length > 0) {
        throw new Error(
          `[banco-master] build de produção abortado: falta ${missing.join(', ')}. ` +
            `Sem elas a sala não persiste e o jogo sobe quebrado — ver docs/RUNBOOK.md §0.`,
        )
      }
    },
  }
}

export default defineConfig({
  define: {
    'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(COMMIT_SHA),
  },
  plugins: [
    requireEnv(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
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
