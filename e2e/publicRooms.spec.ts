// Spec 054 — jornada real com Supabase e identidades isoladas.
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe.configure({ mode: 'serial' })

const SUPABASE_CONFIGURED = Boolean(
  process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY,
)
test.skip(
  !SUPABASE_CONFIGURED,
  'sem VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY — diretório público exige Supabase real',
)

const contexts: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.close()))
})

async function isolated(
  browser: Browser,
  options: BrowserContextOptions = {},
): Promise<Page> {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', ...options })
  contexts.push(ctx)
  return ctx.newPage()
}

async function createRoom(host: Page): Promise<string> {
  await host.goto('/play')
  await host.getByRole('button', { name: /^Criar sala$/ }).click()
  await host.getByLabel('Seu nome').fill('Host Publico')
  await host.locator('button[aria-label^="Cor "]').first().click()
  await host.getByRole('button', { name: /^Criar sala$/ }).click()
  await expect(host.getByText('Sala aberta')).toBeVisible({ timeout: 20_000 })
  const roomUrl = host.url()
  expect(roomUrl).toContain('?room=')
  return roomUrl
}

async function openDirectory(page: Page): Promise<void> {
  await page.goto('/play')
  await page.getByRole('button', { name: 'Encontrar sala pública' }).click()
  await expect(page.getByRole('heading', { name: 'Mesas abertas agora' })).toBeVisible()
}

async function expectNoBlockingA11y(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).analyze()
  const blocking = violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.impact} ${violation.id}: ${violation.help}`)
  expect(blocking).toEqual([])
}

async function stubDirectory(
  page: Page,
  response: unknown,
  status = 200,
  waitForRelease?: Promise<void>,
): Promise<void> {
  await page.route('**/rest/v1/rpc/list_public_rooms', async (route) => {
    await waitForRelease
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    })
  })
}

test('host, entrada pública e convite privado convergem sem enumerar a sala privada', async ({ browser }) => {
  const host = await isolated(browser)
  const publicGuest = await isolated(browser)
  const privateGuest = await isolated(browser)
  const mobileObserver = await isolated(browser, { viewport: { width: 390, height: 844 } })

  const roomUrl = await createRoom(host)

  // Privada por padrão, sem supor que o banco compartilhado esteja globalmente vazio.
  await openDirectory(mobileObserver)
  await expect(host.getByText(/Privada — só entra/)).toBeVisible()
  const listingsBeforePublish = await mobileObserver
    .locator('.public-room-card strong')
    .allTextContents()

  // Opt-in e listagem mínima.
  await host.getByRole('button', { name: 'Publicar lobby' }).click()
  await expect(host.getByText(/Publicada — aparece no diretório/)).toBeVisible()

  await openDirectory(publicGuest)
  await expect.poll(async () => {
    const labels = await publicGuest.locator('.public-room-card strong').allTextContents()
    return labels.some((label) => !listingsBeforePublish.includes(label))
  }, { timeout: 20_000 }).toBe(true)
  const publicLabels = await publicGuest.locator('.public-room-card strong').allTextContents()
  const roomLabel = publicLabels.find((label) => !listingsBeforePublish.includes(label))
  expect(roomLabel).toMatch(/^Mesa [A-Z0-9]{4}$/)
  const publicCard = publicGuest.locator('.public-room-card').filter({ hasText: roomLabel! })
  await expect(publicCard.getByText('Leilão secreto')).toBeVisible()
  await expect(publicCard.getByText('7 vagas')).toBeVisible()
  await publicGuest.getByLabel('Mínimo de vagas').selectOption('4')
  await publicGuest.getByLabel('Ritual de Largada').selectOption('sealed-bid')
  await expectNoBlockingA11y(publicGuest)

  const body = await publicGuest.locator('body').innerText()
  expect(body).not.toContain(new URL(roomUrl).searchParams.get('room') ?? 'ROOM_ID_MISSING')

  // A admissão pública é alcançável por teclado e ocorre antes de a URL privada aparecer.
  const joinButton = publicCard.getByRole('button', { name: /Entrar na Mesa/ })
  await publicGuest.getByLabel('Mínimo de vagas').focus()
  await publicGuest.keyboard.press('Tab')
  await expect(publicGuest.getByLabel('Ritual de Largada')).toBeFocused()
  let reachedJoin = false
  for (let step = 0; step < 20 && !reachedJoin; step += 1) {
    await publicGuest.keyboard.press('Tab')
    reachedJoin = await joinButton.evaluate((element) => element === document.activeElement)
  }
  expect(reachedJoin).toBe(true)
  await publicGuest.keyboard.press('Enter')
  await expect(publicGuest.getByRole('heading', { name: 'Entrar em mesa pública' })).toBeVisible()
  expect(publicGuest.url()).toContain('?public=')
  await publicGuest.getByLabel('Seu nome').fill('Ana Publica')
  await publicGuest.locator('button[aria-label^="Cor "]').nth(1).click()
  await publicGuest.getByRole('button', { name: 'Confirmar e entrar' }).click()
  await expect(publicGuest.getByText('Sala aberta')).toBeVisible({ timeout: 20_000 })
  await expect(publicGuest).toHaveURL(/\?room=/)
  await expect(host.getByText('Ana Publica')).toBeVisible({ timeout: 20_000 })

  // O convite privado continua no caminho antigo e fora do diretório.
  await privateGuest.goto(roomUrl)
  await expect(privateGuest.getByRole('heading', { name: 'Entrar na sala' })).toBeVisible()
  await privateGuest.getByLabel('Seu nome').fill('Beto Privado')
  await privateGuest.locator('button[aria-label^="Cor "]').first().click()
  await privateGuest.getByRole('button', { name: 'Confirmar e entrar' }).click()
  await expect(privateGuest.getByText('Sala aberta')).toBeVisible({ timeout: 20_000 })
  await expect(host.getByText('Beto Privado')).toBeVisible({ timeout: 20_000 })

  for (const page of [host, publicGuest, privateGuest]) {
    await expect(page.getByText('Host Publico')).toBeVisible()
    await expect(page.getByText('Ana Publica')).toBeVisible()
    await expect(page.getByText('Beto Privado')).toBeVisible()
  }

  // Mobile/teclado: nenhum overflow e foco alcança a ação.
  await mobileObserver.reload()
  await mobileObserver.getByRole('button', { name: 'Encontrar sala pública' }).click()
  await expect(
    mobileObserver.locator('.public-room-card').filter({ hasText: roomLabel! }),
  ).toBeVisible({ timeout: 20_000 })
  const overflow = await mobileObserver.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)
  await expectNoBlockingA11y(mobileObserver)

  // O primeiro estado não-lobby encerra a publicação; a partida privada continua.
  await host.getByRole('button', { name: 'Abrir leilão' }).click()
  await expect(host.getByText('Leilão da Largada')).toBeVisible({ timeout: 20_000 })
  await expect(
    mobileObserver.locator('.public-room-card').filter({ hasText: roomLabel! }),
  ).toHaveCount(0, { timeout: 20_000 })
  await expect(publicGuest.getByText('Leilão da Largada')).toBeVisible({ timeout: 20_000 })
  await expect(privateGuest.getByText('Leilão da Largada')).toBeVisible({ timeout: 20_000 })
})

test('host pode despublicar sem encerrar o lobby', async ({ browser }) => {
  const host = await isolated(browser)
  const observer = await isolated(browser)
  await createRoom(host)
  await openDirectory(observer)
  const beforePublish = await observer.locator('.public-room-card strong').allTextContents()

  await host.getByRole('button', { name: 'Publicar lobby' }).click()
  await expect(host.getByText(/Publicada — aparece/)).toBeVisible()
  await expect.poll(async () => {
    const labels = await observer.locator('.public-room-card strong').allTextContents()
    return labels.some((label) => !beforePublish.includes(label))
  }, { timeout: 20_000 }).toBe(true)
  const publishedLabels = await observer.locator('.public-room-card strong').allTextContents()
  const ownLabel = publishedLabels.find((label) => !beforePublish.includes(label))
  expect(ownLabel).toMatch(/^Mesa [A-Z0-9]{4}$/)

  await host.getByRole('button', { name: 'Tornar privada' }).click()
  await expect(host.getByText(/Privada — só entra/)).toBeVisible()
  await expect(host.getByText('Sala aberta')).toBeVisible()
  await expect(
    observer.locator('.public-room-card').filter({ hasText: ownLabel! }),
  ).toHaveCount(0, { timeout: 20_000 })
})

test('loading, vazio, erro e limite são anunciados sem bloquear a home', async ({ browser }) => {
  const loading = await isolated(browser)
  let releaseLoading: () => void = () => {}
  const pending = new Promise<void>((resolve) => {
    releaseLoading = resolve
  })
  await stubDirectory(loading, { ok: true, listings: [] }, 200, pending)
  await openDirectory(loading)
  await expect(loading.getByText('Buscando mesas públicas…')).toBeVisible()
  await expectNoBlockingA11y(loading)
  releaseLoading()
  await expect(loading.getByText('Nenhuma mesa pública com vagas agora.')).toBeVisible()
  await expect(loading.getByRole('button', { name: /^Criar sala$/ })).toBeVisible()
  await expectNoBlockingA11y(loading)

  const failed = await isolated(browser)
  await stubDirectory(failed, { message: 'indisponível' }, 503)
  await openDirectory(failed)
  await expect(failed.getByRole('alert')).toContainText('Não foi possível carregar')
  await expect(failed.getByRole('button', { name: 'Tentar atualizar' })).toBeVisible()
  await expectNoBlockingA11y(failed)

  const limited = await isolated(browser)
  await stubDirectory(limited, {
    ok: false,
    reason: 'rate-limited',
    retryAfterMs: 5_000,
  })
  await openDirectory(limited)
  await expect(limited.getByText(/tente novamente em instantes/i)).toBeVisible()
  await expect(limited.getByRole('button', { name: 'Tentar atualizar' })).toBeVisible()
  await expectNoBlockingA11y(limited)
})
