// Captura de screenshots REAIS pro marketing (051, FR-011). Roda contra um dev server
// local (`bun run dev`) com os dados fictícios dos andaimes que o E2E já usa:
// `?players=4` (partida local determinística) e a sala real de `?host=1` (Supabase do
// `.env`, marcada como `ended` no fim — mesma higiene FR-054 do multiplayer.spec).
//
// Uso: bun run scripts/capture-marketing-shots.ts [--base http://localhost:5173]
// Saída: src/marketing/assets/raw/*.png (o build converte pra WebP fora daqui) e
// public/og.png (imagem social, 1200×630 @2x).
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { chromium, type Browser, type Page } from '@playwright/test'
import { driveTurns, step } from '../e2e/script'

const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://localhost:5173'

const RAW_DIR = path.resolve(import.meta.dirname, '../src/marketing/assets/raw')
const PUBLIC_DIR = path.resolve(import.meta.dirname, '../public')

// Assentos fictícios — nomes claramente de exemplo, nenhum identificador real.
const LOBBY_SEATS = ['Marina', 'Rafa', 'Bia'] as const

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

// Imagem social (OG): o tabuleiro em 1200×630 @2x — proporção exata do card.
async function captureOg(browser: Browser): Promise<void> {
  const ctx = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  })
  const page = await ctx.newPage()
  await boardMidMatch(page)
  await page.screenshot({ path: path.join(PUBLIC_DIR, 'og.png'), animations: 'disabled', timeout: 60_000 })
  console.log('✓ og.png')
  await ctx.close()
}

// Lobby real: precisa de VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY no ambiente (o Bun lê o
// .env sozinho). Sem credencial, avisa e segue — as outras capturas não dependem disso.
async function captureLobby(browser: Browser): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.warn('! lobby.png PULADO: sem VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY no ambiente')
    return
  }

  // Mesma espera do e2e/multiplayer.spec: a lista de cores começa cheia (8) e só encolhe
  // quando a prévia da sala chega — clicar antes disso pega cor tomada e o pedido volta
  // `color-taken`. `free` = 8 − assentos já ocupados.
  const fillIdentity = async (page: Page, name: string, cta: RegExp, free: number) => {
    await page.waitForFunction(
      (n) => document.querySelectorAll('button[aria-label^="Cor "]').length === n,
      free,
      { timeout: 20_000 },
    )
    await page.getByLabel('Seu nome').fill(name)
    await page.locator('button[aria-label^="Cor "]').first().click()
    await page.getByRole('button', { name: cta }).click()
  }

  const hostCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  })
  const host = await hostCtx.newPage()
  await host.goto(`${BASE}/play?host=1`)
  await fillIdentity(host, LOBBY_SEATS[0], /^Criar sala$/, 8)
  await host.getByText('Sala aberta').waitFor({ timeout: 30_000 })
  const roomUrl = host.url()
  const roomId = new URL(roomUrl).searchParams.get('room')

  const guestCtxs = []
  for (const [i, name] of LOBBY_SEATS.slice(1).entries()) {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' })
    guestCtxs.push(ctx)
    const guest = await ctx.newPage()
    await guest.goto(roomUrl)
    await guest.getByText('Entrar na sala').waitFor({ timeout: 20_000 })
    await fillIdentity(guest, name, /^Confirmar e entrar$/, 8 - (i + 1))
    await host.getByText(name).waitFor({ timeout: 20_000 })
  }

  await settle(host)
  await host.screenshot({ path: path.join(RAW_DIR, 'lobby.png'), animations: 'disabled', timeout: 60_000 })
  console.log('✓ lobby.png')

  for (const ctx of guestCtxs) await ctx.close()
  await hostCtx.close()

  // Higiene FR-054: sala de captura não fica aberta pra trás.
  if (roomId) {
    const { createClient } = await import('@supabase/supabase-js')
    await createClient(url, key).from('rooms').update({ status: 'ended' }).eq('id', roomId)
    console.log(`✓ sala ${roomId} marcada como ended`)
  }
}

// `--only board,og,lobby` recaptura só uma parte — recapturar tudo cria sala nova à toa.
const ONLY = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1].split(',')
  : ['board', 'og', 'lobby']

mkdirSync(RAW_DIR, { recursive: true })
const browser = await chromium.launch()
try {
  if (ONLY.includes('board')) await captureBoardAndTrade(browser)
  if (ONLY.includes('og')) await captureOg(browser)
  if (ONLY.includes('lobby')) await captureLobby(browser)
} finally {
  await browser.close()
}
console.log('capturas concluídas em', RAW_DIR)
