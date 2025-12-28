// Captura de screenshots REAIS pro marketing (051, FR-011). Roda contra um dev server
// local (`bun run dev`) com os dados fictícios dos andaimes que o E2E já usa:
// `?players=6` (partida local determinística) e `?scenario=fuligem-*` (mesa semeada do
// segundo mapa, sem depender de Supabase).
//
// Uso: bun run scripts/capture-marketing-shots.ts [--base http://localhost:5173]
// Saída: src/marketing/assets/raw/*.png. A conversão é passo MANUAL:
//   cwebp -q 76 raw/<nome>.png -o src/marketing/assets/<nome>.webp
//   sips -s format jpeg -s formatOptions 82 raw/og.png --out public/og.jpg
// O intermediário da OG fica em raw/, nunca em `public/`: tudo que está lá é copiado
// verbatim pro dist e um PNG de 1,4 MB ao lado do JPEG seria peso publicado à toa.
//
// A OG deixou de ser o tabuleiro nu: desde o redesenho da landing ela é a PRIMEIRA DOBRA
// da landing, que é a identidade que o link agora promete.
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { chromium, type Browser, type Page } from '@playwright/test'
import { driveTurns, step } from '../e2e/script'

const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://localhost:5173'

const RAW_DIR = path.resolve(import.meta.dirname, '../src/marketing/assets/raw')

async function settle(page: Page, ms = 1800): Promise<void> {
  await page.waitForTimeout(ms)
}

// Dirige a partida local até um estado VIVO (propriedades com dono, construção possível)
// e para num momento calmo do turno — sem dado rolando nem modal aberto.
async function boardMidMatch(page: Page): Promise<void> {
  // `?players=` só aceita 3 ou 6 (src/game/store.ts, gancho do smoke E2E) — 6 dá a mesa
  // mais parecida com a promessa da landing ("2 a 8 jogadores").
  await page.goto(`${BASE}/play?players=6`)
  await page.locator('.board-stage').waitFor({ timeout: 30_000 })
  await driveTurns(page, 30)
  // Fecha o que tiver ficado aberto resolvendo mais alguns passos e espera acomodar.
  for (let i = 0; i < 6; i++) await step(page)
  await settle(page)
}

async function captureBoardAndTrade(browser: Browser): Promise<void> {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  })
  const page = await ctx.newPage()
  await boardMidMatch(page)
  await page.screenshot({ path: path.join(RAW_DIR, 'tabuleiro.png'), animations: 'disabled', timeout: 60_000 })
  console.log('✓ tabuleiro.png')

  // Negociação: abre o compositor real e monta uma proposta plausível por cliques
  // (parceiro + primeiros termos disponíveis) — tudo estado de verdade do motor.
  await page.getByRole('button', { name: 'Nova negociação' }).click()
  await settle(page, 900)
  const partner = page.locator('.trade-partner-option, [data-trade-partner], button:has-text("Jogador 2")').first()
  if (await partner.isVisible().catch(() => false)) {
    await partner.click()
    await settle(page, 600)
  }
  const addButtons = page.locator('.trade-property-term__actions button')
  const addCount = Math.min(await addButtons.count(), 2)
  for (let i = 0; i < addCount; i++) {
    await addButtons.nth(i).click().catch(() => {})
    await settle(page, 350)
  }
  await page.screenshot({ path: path.join(RAW_DIR, 'negociacao.png'), animations: 'disabled', timeout: 60_000 })
  console.log('✓ negociacao.png')
  await ctx.close()
}

// A Cidade da Fuligem, pelos cenários semeados de `game/ui/e2eScenario.ts`: mesa rica
// (bairro fechado, escada de construção inteira, hipoteca, Sorte Grande acumulada) e o
// pregão ao vivo. Determinístico e sem credencial — o oposto do lobby real.
async function captureFuligem(browser: Browser): Promise<void> {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  })
  const page = await ctx.newPage()
  for (const [scenario, file] of [
    ['fuligem-showcase', 'fuligem-mesa.png'],
    ['fuligem-auction', 'fuligem-leilao.png'],
  ] as const) {
    await page.goto(`${BASE}/play?players=2&map=fuligem&scenario=${scenario}`)
    await page.locator('.board-stage').waitFor({ timeout: 30_000 })
    await settle(page, 2500)
    await page.screenshot({ path: path.join(RAW_DIR, file), animations: 'disabled', timeout: 60_000 })
    console.log(`✓ ${file}`)
  }
  await ctx.close()
}

// Imagem social (OG): a PRIMEIRA DOBRA DA LANDING em 1200×630 @2x — proporção exata do
// card. O cabeçalho sai (não é conteúdo do cartão) e o hero é forçado à altura do card.
async function captureOg(browser: Browser): Promise<void> {
  const ctx = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`)
  await page.addStyleTag({
    content: '.mk-header, .mk-skip { display: none !important } .fx-hero { min-height: 630px !important; padding-top: 2.5rem }',
  })
  await settle(page, 2000)
  await page.screenshot({
    path: path.join(RAW_DIR, 'og.png'),
    clip: { x: 0, y: 0, width: 1200, height: 630 },
    animations: 'disabled',
    timeout: 60_000,
  })
  console.log('✓ og.png')
  await ctx.close()
}

// `--only board,fuligem,og` recaptura só uma parte.
const ONLY = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1].split(',')
  : ['board', 'fuligem', 'og']

mkdirSync(RAW_DIR, { recursive: true })
const browser = await chromium.launch()
try {
  if (ONLY.includes('board')) await captureBoardAndTrade(browser)
  if (ONLY.includes('fuligem')) await captureFuligem(browser)
  if (ONLY.includes('og')) await captureOg(browser)
} finally {
  await browser.close()
}
console.log('capturas concluídas em', RAW_DIR)
