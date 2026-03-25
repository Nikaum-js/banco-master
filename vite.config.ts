import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
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
