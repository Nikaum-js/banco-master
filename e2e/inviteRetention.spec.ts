import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createClient } from '@supabase/supabase-js'

test.describe.configure({ mode: 'serial' })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

if (!SUPABASE_CONFIGURED) {
  console.warn(
    '[inviteRetention.spec] PULADO: sem VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY reais — ' +
      'convite + lobby de revanche exigem dois BrowserContexts sobre uma sala viva.',
  )
}
test.skip(
  !SUPABASE_CONFIGURED,
  'sem VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY — gate multiplayer pulado',
)

const HOST_NAME = 'Anfitria'
const GUEST_NAME = 'Convidado'
const SEAT_COUNT = 8

function roomIdFromUrl(url: string): string {
  const roomId = new URL(url).searchParams.get('room')
  if (!roomId) throw new Error(`URL de sala inválida: ${url}`)
  return roomId
}

async function fillIdentity(page: Page, name: string, cta: RegExp, free = SEAT_COUNT): Promise<void> {
  const colors = page.locator('button[aria-label^="Cor "]')
  await expect(colors).toHaveCount(free, { timeout: 20_000 })
  await page.getByLabel('Seu nome').fill(name)
  await colors.first().click()
  await page.getByRole('button', { name: cta }).click()
}

async function accessToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    for (const value of Object.values(localStorage)) {
      try {
        const candidate = JSON.parse(value) as { access_token?: unknown }
        if (typeof candidate.access_token === 'string') return candidate.access_token
      } catch {
        // Preferências locais que não são JSON não pertencem ao Supabase Auth.
      }
    }
    return null
  })
  if (!token) throw new Error('sessão Supabase da página não foi encontrada')
  return token
}

async function expectNoBlockingA11y(page: Page, label: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).analyze()
  const blocking = violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.impact} ${violation.id}: ${violation.help}`)
  expect(blocking, `${label}: violações serious/critical`).toEqual([])
}

test('convite, preset e histórico convergem no lobby de revanche', async ({ browser }, testInfo) => {
  const hostCtx = await browser.newContext({
    reducedMotion: 'reduce',
    permissions: ['clipboard-read', 'clipboard-write'],
    viewport: { width: 1440, height: 960 },
  })
  const guestCtx = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 740, height: 360 },
  })

  await hostCtx.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        ;(window as unknown as { __lastRoomShare?: ShareData }).__lastRoomShare = data
      },
    })
  })

  const host = await hostCtx.newPage()
  const guest = await guestCtx.newPage()
  const externalRequests: string[] = []
  let appOrigin = ''
  host.on('request', (request) => {
    const url = request.url()
    if (appOrigin && !url.startsWith(appOrigin) && !url.startsWith(SUPABASE_URL!)) {
      externalRequests.push(url)
    }
  })

  await host.goto('/play')
  await host.getByRole('button', { name: /^Criar sala$/ }).click()
  await fillIdentity(host, HOST_NAME, /^Criar sala$/)
  await expect(host.getByText('Sala aberta')).toBeVisible({ timeout: 20_000 })

  const roomUrl = host.url()
  appOrigin = new URL(roomUrl).origin
  const roomId = roomIdFromUrl(roomUrl)
  const shareTrigger = host.getByRole('button', { name: 'Compartilhar sala' })
  await shareTrigger.click()

  const dialog = host.getByRole('dialog', { name: 'Compartilhar sala' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('img', { name: 'QR Code do convite da sala' })).toBeVisible()
  await expect(dialog.getByText(roomUrl, { exact: true })).toBeVisible()

  await dialog.getByRole('button', { name: 'Compartilhar pelo dispositivo' }).click()
  await expect.poll(async () => host.evaluate(
    () => (window as unknown as { __lastRoomShare?: ShareData }).__lastRoomShare ?? null,
  )).toEqual({
    title: 'Magnata Imobiliário',
    text: 'Entre na minha sala privada do Magnata Imobiliário:',
    url: roomUrl,
  })

  await dialog.getByRole('button', { name: 'Copiar link da sala' }).click()
  await expect(dialog.getByText('Link copiado. Agora é só colar onde quiser.')).toBeVisible()
  await expect.poll(() => host.evaluate(() => navigator.clipboard.readText())).toBe(roomUrl)
  expect(externalRequests, 'o QR local não pode chamar serviço externo').toEqual([])

  await host.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(shareTrigger).toBeFocused()

  await guest.goto(roomUrl)
  await expect(guest.getByText('Entrar na sala')).toBeVisible({ timeout: 20_000 })
  await fillIdentity(guest, GUEST_NAME, /^Confirmar e entrar$/, SEAT_COUNT - 1)
  await expect(host.getByText(GUEST_NAME)).toBeVisible({ timeout: 20_000 })

  await guest.getByRole('button', { name: 'Compartilhar sala' }).click()
  const fallbackDialog = guest.getByRole('dialog', { name: 'Compartilhar sala' })
  const whatsapp = fallbackDialog.getByRole('link', { name: 'Abrir no WhatsApp' })
  await expect(whatsapp).toHaveAttribute(
    'href',
    `https://wa.me/?text=${encodeURIComponent(`Entre na minha sala privada do Magnata Imobiliário: ${roomUrl}`)}`,
  )
  await expect(fallbackDialog.getByText(/copie e cole o link copiado no Discord/)).toBeVisible()
  await guest.keyboard.press('Escape')

  const hostDicePreset = host.getByRole('button', { name: /Maior dado/ })
  const guestDicePreset = guest.getByRole('button', { name: /Maior dado/ })
  await hostDicePreset.click()
  await expect(hostDicePreset).toHaveAttribute('aria-pressed', 'true')
  await expect(guestDicePreset).toHaveAttribute('aria-pressed', 'true')
  await expect(guestDicePreset).toBeDisabled()
  await expect.poll(() => host.evaluate(() => localStorage.getItem('bm.room-preset'))).toBe('dice-roll')

  const token = await accessToken(host)
  const hostDb = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: preview, error: previewError } = await hostDb.rpc('room_preview', { room_id: roomId })
  expect(previewError).toBeNull()
  const roomPreview = preview as {
    seats: Array<{
    historyId: string
    playerId: string
    name: string
    color: string
    avatar: string
    skin: string
    }>
    openingAuction: unknown
  }
  const seats = roomPreview.seats

  const matchHistory = [{
    generation: 0,
    endedAt: Date.now() - 30_000,
    durationMs: 600_000,
    rounds: 12,
    standings: seats.map((seat, index) => ({
      historyId: seat.historyId,
      playerId: seat.playerId,
      name: seat.name,
      color: seat.color,
      avatar: seat.avatar,
      skin: seat.skin,
      rank: index + 1,
      netWorth: index === 0 ? 5_000 : 2_500,
      properties: index === 0 ? 6 : 3,
      eliminatedAtRound: index === 0 ? null : 12,
    })),
  }]

  const roomWriteArgs = {
    room_id: roomId,
    status: 'lobby',
    seats,
    match_generation: 1,
    opening_mode: 'dice-roll',
    opening_auction: roomPreview.openingAuction ?? null,
    match_history: matchHistory,
  }
  const { error: updateError } = await hostDb.rpc('write_room', roomWriteArgs)
  expect(updateError).toBeNull()

  await Promise.all([host.reload(), guest.reload()])
  await Promise.all([
    expect(host.getByText('Sala aberta')).toBeVisible({ timeout: 30_000 }),
    expect(guest.getByText('Sala aberta')).toBeVisible({ timeout: 30_000 }),
  ])
  await expect(host.getByRole('button', { name: /Maior dado/ })).toHaveAttribute('aria-pressed', 'true')

  for (const page of [host, guest]) {
    const history = page.getByText('Histórico da sala', { exact: true })
    await expect(history).toBeVisible()
    await history.click()
    await expect(page.getByText('1 partida', { exact: true })).toBeVisible()
    await expect(page.getByText('Estatísticas da sala')).toBeVisible()
    await expect(page.getByText('Partida 1', { exact: true })).toBeVisible()
    await expect(page.getByText('12 rodadas · 10min')).toBeVisible()
  }

  await Promise.all([
    expectNoBlockingA11y(host, 'lobby de revanche desktop'),
    expectNoBlockingA11y(guest, 'lobby de revanche compacto'),
  ])
  await host.screenshot({
    path: testInfo.outputPath('lobby-revanche-desktop.png'),
    fullPage: true,
  })
  await guest.screenshot({
    path: testInfo.outputPath('lobby-revanche-compacto.png'),
    fullPage: true,
  })

  await hostDb.rpc('write_room', { ...roomWriteArgs, status: 'ended' })
  await hostCtx.close()
  await guestCtx.close()
})
