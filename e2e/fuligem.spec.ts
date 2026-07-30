// E2E do segundo mapa jogável (spec 055 / D-069) — Cidade da Fuligem.
//
// Duas metades:
//   1. PARTIDA LOCAL (`?players=N&map=fuligem`) — catálogo aplicado de ponta a ponta,
//      cenário semeado de validação visual (SC-005) e classificação final, sem infra.
//   2. SALA REAL (host + convidado em BrowserContexts separados) — o mapa escolhido na
//      home fica gravado na sala, o convidado o recebe pelo link e o reload preserva.
//      Como o multiplayer.spec, esta metade só roda com credencial Supabase no ambiente
//      (o stack LOCAL `bunx supabase start`, com a migration 0009 aplicada, serve).
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe.configure({ mode: 'serial' })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

// Screenshots da validação visual (SC-005) — fora do repositório por padrão do Playwright
// (`test-results/` é ignorado); o runner pode apontar outro destino via FULIGEM_SHOTS_DIR.
const SHOTS = process.env.FULIGEM_SHOTS_DIR ?? path.join('test-results', 'fuligem-shots')
mkdirSync(SHOTS, { recursive: true })

// As três janelas do brief: desktop, tablet e celular em paisagem (§12.6).
const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '740x360', width: 740, height: 360 },
] as const

async function shoot(page: Page, slug: string): Promise<void> {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.waitForTimeout(250)
    await page.screenshot({ path: path.join(SHOTS, `${slug}--${vp.name}.png`), fullPage: false })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
}

async function expectNoBlockingA11y(page: Page, label: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).analyze()
  const blocking = violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.impact} ${violation.id}: ${violation.help}`)
  expect(blocking, `${label}: violações serious/critical`).toEqual([])
}

// ---------------------------------------------------------------------------------------------
// 1. Partida local: o catálogo da Fuligem de ponta a ponta.
// ---------------------------------------------------------------------------------------------

test('partida local no mapa fuligem apresenta o catálogo inteiro do tabuleiro', async ({ page }) => {
  await page.goto('/play?players=2&map=fuligem')
  await expect(page.locator('.board-stage')).toBeVisible({ timeout: 20_000 })

  // O eixo visual é o mapa (D-069): o atributo do tema segue a seleção explícita.
  await expect(page.locator('html')).toHaveAttribute('data-board-theme', 'fuligem')

  // Conteúdo do catálogo nas 40 casas: bairros, ferrovias, minas e Sorte Grande.
  await expect(page.getByText('Ladeira do Barreiro')).toBeVisible()
  await expect(page.getByText('Rua Treze de Maio')).toBeVisible()
  await expect(page.getByText('Alameda das Palmeiras')).toBeVisible()
  await expect(page.getByText('Estação Bonfim')).toBeVisible()
  await expect(page.getByText('Estação do Vale')).toBeVisible()
  await expect(page.getByText('Sorte Grande', { exact: true })).toBeVisible()
  await expect(page.getByText('Bilhete de Trem', { exact: true })).toBeVisible()
  await expect(page.getByText('Pátio das Máquinas', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Represa do Salto', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Baixada das Olarias', { exact: true })).toHaveCount(0)
  // O vocabulário aprovado NÃO renomeia Acaso/Tesouro/GO/Prisão.
  await expect(page.getByText('Acaso').first()).toBeVisible()
  await expect(page.getByText('Tesouro').first()).toBeVisible()

  await expectNoBlockingA11y(page, 'tabuleiro fuligem')
  await shoot(page, 'tabuleiro-inicio')

  // Um turno real roda sobre o catálogo (mesmo motor): rolar dados funciona.
  await page.getByRole('button', { name: /Rolar dados/ }).click()
  await expect(page.locator('.board-stage')).toBeVisible()
})

test('cenário semeado mostra compras, hipoteca, bairro completo, estação e pote', async ({ page }) => {
  await page.goto('/play?players=2&scenario=fuligem-showcase&map=fuligem')
  await expect(page.locator('.board-stage')).toBeVisible({ timeout: 20_000 })

  // Hipoteca com PLACA (padrão além de cor, FR-009/§12.6).
  await expect(page.getByText('HIPOTECADA')).toBeVisible()
  // Sorte Grande com pote acumulado.
  await expect(page.getByText('1.850')).toBeVisible()
  await shoot(page, 'tabuleiro-comprado-hipoteca-bairro-completo')

  // Escritura da ferrovia com Estação de Carga (regra do hangar intacta, rótulo do mapa).
  await page.getByRole('button', { name: /Estação Bonfim/ }).click()
  await expect(page.getByText('Estação de Carga').first()).toBeVisible()
  await shoot(page, 'ferrovia-estacao-de-carga')
  await page.keyboard.press('Escape')

  // Compositor de troca fala a língua do mapa.
  const newTrade = page.getByRole('button', { name: 'Nova negociação' })
  await expect(newTrade).toBeVisible({ timeout: 10_000 })
  await newTrade.click()
  await expect(page.getByText(/Bilhete de Trem/).first()).toBeVisible({ timeout: 10_000 })
  await shoot(page, 'troca')
})

test('leilão preserva a leitura do caixa dos rivais', async ({ page }) => {
  await page.goto('/play?players=2&scenario=fuligem-auction&map=fuligem')
  await expect(page.getByRole('heading', { name: 'Leilão ao vivo' })).toBeVisible({ timeout: 20_000 })

  const overlay = page.locator('[data-veil="clear"]')
  await expect(overlay).toBeVisible()
  await expect(overlay).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(overlay).toHaveCSS('backdrop-filter', 'none')
  const players = page.getByRole('list', { name: 'Participantes da partida' })
  await expect(players.getByText('R$1.420', { exact: true })).toBeVisible()
  await expect(players.getByText('R$860', { exact: true })).toBeVisible()

  await expectNoBlockingA11y(page, 'leilão fuligem com caixa visível')
  await shoot(page, 'leilao-caixa-visivel')
})

test('classificação final chega pelo caminho real no mapa fuligem', async ({ page }) => {
  await page.goto('/play?players=2&scenario=endgame&map=fuligem')
  await expect(page.locator('.board-stage')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: /Declarar falência/ }).click()
  await expect(page.getByText(/Classificação|classificação/).first()).toBeVisible({ timeout: 20_000 })
  await shoot(page, 'classificacao-final')
})

// ---------------------------------------------------------------------------------------------
// 2. Sala real: mapa gravado na sala, convidado herda, reload preserva.
// ---------------------------------------------------------------------------------------------

if (!SUPABASE_CONFIGURED) {
  console.warn(
    '[fuligem.spec] Metade multiplayer PULADA: sem VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY — '
      + 'suba o stack local (`bunx supabase start`, migration 0009) e exporte as credenciais.',
  )
}

const SEAT_COUNT = 8

async function fillIdentity(page: Page, name: string, cta: RegExp, free = SEAT_COUNT): Promise<void> {
  const colors = page.locator('button[aria-label^="Cor "]')
  await expect(colors).toHaveCount(free, { timeout: 20_000 })
  await page.getByLabel('Seu nome').fill(name)
  await colors.first().click()
  await page.getByRole('button', { name: cta }).click()
}

test('host escolhe a Cidade da Fuligem na home; convidado e reload recebem o mesmo mapa', async ({ browser }) => {
  test.skip(!SUPABASE_CONFIGURED, 'sem credencial Supabase — sala real precisa de infra')
  test.setTimeout(240_000)

  const hostCtx = await browser.newContext({ reducedMotion: 'reduce' })
  const guestCtx = await browser.newContext({ reducedMotion: 'reduce' })
  const host = await hostCtx.newPage()
  const guest = await guestCtx.newPage()

  // Home: os DOIS mapas jogáveis; seleção da Fuligem antes de criar (FR-004).
  await host.goto('/play')
  await expect(host.getByText('Cidades do Mundo').first()).toBeVisible({ timeout: 20_000 })
  await shoot(host, 'home-atlas')
  await host.getByRole('button', { name: 'Selecionar o mapa Cidade da Fuligem' }).click()
  await expect(host.locator('html')).toHaveAttribute('data-board-theme', 'fuligem', { timeout: 10_000 })
  await expectNoBlockingA11y(host, 'home fuligem')
  await shoot(host, 'home-fuligem')

  // Criar sala com o mapa selecionado.
  const nameInput = host
    .locator('[data-home-theme="fuligem"]')
    .getByLabel('Seu nome')
  await nameInput.fill('Anfitria')
  await host
    .locator('[data-home-theme="fuligem"]')
    .getByRole('button', { name: /^Criar sala$/ })
    .click()
  await fillIdentity(host, 'Anfitria', /^Criar sala$/)
  await expect(host.getByText('Sala aberta')).toBeVisible({ timeout: 30_000 })
  await expect(host.locator('html')).toHaveAttribute('data-board-theme', 'fuligem')
  const roomUrl = host.url()
  expect(new URL(roomUrl).searchParams.get('room')).toBeTruthy()

  // Convidado entra pelo LINK (sem `map=` na URL): o mapa vem da SALA publicada.
  await guest.goto(roomUrl)
  await expect(guest.getByText('Entrar na sala')).toBeVisible({ timeout: 30_000 })
  await expect(guest.locator('html')).toHaveAttribute('data-board-theme', 'fuligem', { timeout: 20_000 })
  await shoot(guest, 'identidade-convidado')
  await fillIdentity(guest, 'Convidada', /^Confirmar e entrar$/, SEAT_COUNT - 1)
  await expect(host.getByText('Convidada')).toBeVisible({ timeout: 30_000 })
  await expectNoBlockingA11y(host, 'lobby fuligem')
  await shoot(host, 'lobby-2-jogadores')

  // O convite privado e seu QR também vestem o mapa autoritativo da sala.
  await host.getByRole('button', { name: 'Compartilhar sala' }).click()
  await expect(host.getByRole('img', { name: 'QR Code do convite da sala' })).toBeVisible()
  await shoot(host, 'convite-sala')
  await host.keyboard.press('Escape')

  // Reload do host: o mapa persiste pela sala (migration 0009), nunca por estado local.
  await host.reload()
  await expect(host.getByText('Sala aberta')).toBeVisible({ timeout: 30_000 })
  await expect(host.locator('html')).toHaveAttribute('data-board-theme', 'fuligem', { timeout: 20_000 })

  // Reload do convidado idem.
  await guest.reload()
  await expect(guest.locator('html')).toHaveAttribute('data-board-theme', 'fuligem', { timeout: 30_000 })

  await hostCtx.close()
  await guestCtx.close()
})

test('ritual por Maior dado mantém a continuidade visual da fuligem', async ({ browser }) => {
  test.skip(!SUPABASE_CONFIGURED, 'sem credencial Supabase — sala real precisa de infra')
  test.setTimeout(180_000)

  const hostCtx = await browser.newContext({ reducedMotion: 'reduce' })
  const guestCtx = await browser.newContext({ reducedMotion: 'reduce' })
  const host = await hostCtx.newPage()
  const guest = await guestCtx.newPage()

  await host.goto('/play')
  await host.getByRole('button', { name: 'Selecionar o mapa Cidade da Fuligem' }).click()
  await host
    .locator('[data-home-theme="fuligem"]')
    .getByRole('button', { name: /^Criar sala$/ })
    .click()
  await fillIdentity(host, 'Anfitria', /^Criar sala$/)
  await expect(host.getByText('Sala aberta')).toBeVisible({ timeout: 30_000 })
  const roomUrl = host.url()

  await guest.goto(roomUrl)
  await expect(guest.getByText('Entrar na sala')).toBeVisible({ timeout: 30_000 })
  await fillIdentity(guest, 'Convidada', /^Confirmar e entrar$/, SEAT_COUNT - 1)
  await expect(host.getByText('Convidada')).toBeVisible({ timeout: 30_000 })

  const diceMode = host.getByRole('button', { name: /Maior dado/ })
  await diceMode.click()
  await expect(diceMode).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 })
  await host.getByRole('button', { name: 'Abrir disputa' }).click()
  await expect(host.getByRole('heading', { name: 'Disputa de dados' })).toBeVisible({ timeout: 20_000 })
  await shoot(host, 'disputa-maior-dado')

  await hostCtx.close()
  await guestCtx.close()
})

test('lobby cheio: oito assentos acendem a fábrica', async ({ browser }) => {
  test.skip(!SUPABASE_CONFIGURED, 'sem credencial Supabase — sala real precisa de infra')
  test.setTimeout(300_000)

  const hostCtx = await browser.newContext({ reducedMotion: 'reduce' })
  const host = await hostCtx.newPage()
  await host.goto('/play')
  await host.getByRole('button', { name: 'Selecionar o mapa Cidade da Fuligem' }).click()
  await host
    .locator('[data-home-theme="fuligem"]')
    .getByRole('button', { name: /^Criar sala$/ })
    .click()
  await fillIdentity(host, 'Anfitria', /^Criar sala$/)
  await expect(host.getByText('Sala aberta')).toBeVisible({ timeout: 30_000 })
  const roomUrl = host.url()

  const contexts = [hostCtx]
  for (let i = 2; i <= 8; i += 1) {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' })
    contexts.push(ctx)
    const page = await ctx.newPage()
    await page.goto(roomUrl)
    await expect(page.getByText('Entrar na sala')).toBeVisible({ timeout: 30_000 })
    await fillIdentity(page, `Sócio ${i}`, /^Confirmar e entrar$/, SEAT_COUNT - (i - 1))
    await expect(host.getByText(`Sócio ${i}`)).toBeVisible({ timeout: 30_000 })
  }

  // As oito seções de janela do complexo acendem (uma por assento).
  await expect(host.locator('[data-fuligem-seat][data-lit]')).toHaveCount(8, { timeout: 20_000 })
  await shoot(host, 'lobby-cheio')

  // O Leilão da Largada é a 13ª superfície da matriz visual.
  await host.getByRole('button', { name: 'Abrir leilão' }).click()
  await expect(host.getByRole('heading', { name: 'Leilão da Largada' })).toBeVisible({ timeout: 20_000 })
  await shoot(host, 'leilao-largada')

  for (const ctx of contexts) await ctx.close()
})
