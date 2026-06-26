// Auditoria da separação de bundles (051, FR-006/SC-003). A prova tem dois lados:
//
// 1. As páginas de marketing construídas (dist/*.html) não referenciam NENHUM arquivo
//    JavaScript — o único JS delas é o fallback de redirect, inline e de ~10 linhas.
//    Sem <script src>, não há como Supabase/engine/Zustand/Motion chegarem ao visitante.
// 2. O manifest confirma que todo o grafo do jogo pende de play.html, e informa os
//    tamanhos dos dois lados.
//
// Uso: bun run build && bun run scripts/audit-marketing-bundle.ts (exit 1 se vazar).
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

interface ManifestChunk {
  file: string
  src?: string
  imports?: string[]
  dynamicImports?: string[]
  css?: string[]
}

const ROOT = path.resolve(import.meta.dirname, '..')
const DIST = path.join(ROOT, 'dist')
const MARKETING_PAGES = ['index.html', 'how-to-play.html', 'faq.html', '404.html']

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`
}

function sizeOf(file: string): number {
  try {
    return statSync(path.join(DIST, file)).size
  } catch {
    return 0
  }
}

function gzipSizeOf(file: string): number {
  try {
    return gzipSync(readFileSync(path.join(DIST, file))).byteLength
  } catch {
    return 0
  }
}

let failed = false

console.log('— Páginas de marketing (dist) —')
for (const page of MARKETING_PAGES) {
  const html = readFileSync(path.join(DIST, page), 'utf-8')
  const scriptRefs = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1])
  const cssRefs = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1])
  const imgRefs = [...html.matchAll(/<img[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1])
  const cssSize = cssRefs.reduce((total, ref) => total + sizeOf(ref.replace(/^\//, '')), 0)
  const imgSize = imgRefs.reduce((total, ref) => total + sizeOf(ref.replace(/^\//, '')), 0)
  const ok = scriptRefs.length === 0
  console.log(
    `${ok ? '✓' : '✗'} ${page}: ${scriptRefs.length} js externo, css ${kb(cssSize)}, imagens ${kb(imgSize)} (${imgRefs.length})`,
  )
  if (!ok) {
    failed = true
    for (const ref of scriptRefs) console.error(`    vazou script: ${ref}`)
  }
}

console.log('— Entrypoint do jogo (manifest) —')
const manifest = JSON.parse(readFileSync(path.join(DIST, '.vite/manifest.json'), 'utf-8')) as Record<
  string,
  ManifestChunk
>
const seen = new Set<string>()
const queue = ['play.html']
while (queue.length > 0) {
  const key = queue.pop()!
  if (seen.has(key) || !manifest[key]) continue
  seen.add(key)
  queue.push(...(manifest[key].imports ?? []), ...(manifest[key].dynamicImports ?? []))
}
const gameFiles = new Set<string>()
for (const key of seen) {
  gameFiles.add(manifest[key].file)
  for (const css of manifest[key].css ?? []) gameFiles.add(css)
}
const gameJs = [...gameFiles].filter((f) => f.endsWith('.js'))
const gameCss = [...gameFiles].filter((f) => f.endsWith('.css'))
console.log(
  `  play.html: ${gameJs.length} js (${kb(gameJs.reduce((t, f) => t + sizeOf(f), 0))}), ` +
    `${gameCss.length} css (${kb(gameCss.reduce((t, f) => t + sizeOf(f), 0))})`,
)

// `/play` importa `App.tsx` imediatamente depois do bootstrap. A partir daí, só os
// imports ESTÁTICOS pertencem à primeira tela; sala, Supabase, tabuleiro e o segundo mapa
// precisam continuar atrás de imports dinâmicos. O orçamento usa gzip, o custo próximo do
// que viaja pela rede, e é largo o bastante para pequenas variações do bundler sem aceitar
// de volta o baseline de ~258 KiB.
const initialKeys = new Set<string>()
const initialQueue = ['play.html', 'src/App.tsx']
while (initialQueue.length > 0) {
  const key = initialQueue.pop()!
  if (initialKeys.has(key) || !manifest[key]) continue
  initialKeys.add(key)
  initialQueue.push(...(manifest[key].imports ?? []))
}
const initialFiles = new Set<string>()
for (const key of initialKeys) {
  initialFiles.add(manifest[key].file)
  for (const css of manifest[key].css ?? []) initialFiles.add(css)
}
const initialJs = [...initialFiles].filter((file) => file.endsWith('.js'))
const initialCss = [...initialFiles].filter((file) => file.endsWith('.css'))
const initialJsGzip = initialJs.reduce((total, file) => total + gzipSizeOf(file), 0)
const initialCssGzip = initialCss.reduce((total, file) => total + gzipSizeOf(file), 0)
const initialSource = initialJs
  .map((file) => readFileSync(path.join(DIST, file), 'utf-8'))
  .join('\n')

console.log('— Primeira tela de /play —')
console.log(`  js inicial: ${kb(initialJsGzip)} gzip em ${initialJs.length} arquivo(s)`)
console.log(`  css inicial: ${kb(initialCssGzip)} gzip em ${initialCss.length} arquivo(s)`)

if (initialJsGzip > 210 * 1024) {
  console.error(`✗ js inicial excede 210 KiB gzip: ${kb(initialJsGzip)}`)
  failed = true
}
if (initialCssGzip > 53 * 1024) {
  console.error(`✗ css inicial excede 53 KiB gzip: ${kb(initialCssGzip)}`)
  failed = true
}
if (initialSource.includes('supabase')) {
  console.error('✗ Supabase vazou para a primeira tela de /play.')
  failed = true
}
if (initialSource.includes('fuligem-puff-city')) {
  console.error('✗ o cenário completo da Fuligem vazou para a home Atlas inicial.')
  failed = true
}

// Sanidade inversa: o grafo do jogo TEM que conter Supabase — se não contiver, esta
// auditoria está lendo a coisa errada e o "✓" acima não vale nada. As dependências não
// ganham entrada própria no manifest, então a prova é o CONTEÚDO dos chunks do jogo.
const gameHasSupabase = gameJs.some((file) =>
  readFileSync(path.join(DIST, file), 'utf-8').includes('supabase'),
)
if (!gameHasSupabase) {
  console.error('✗ sanidade: o grafo de play.html não contém Supabase — auditoria inválida.')
  failed = true
}

if (failed) {
  console.error('\nAUDITORIA FALHOU.')
  process.exit(1)
}
console.log('\nAuditoria ok: marketing sem nenhum JS externo; jogo isolado em play.html.')
