// E2E fronteira de erro (spec 042, T036, D-035, FR-025) — dois browsers de verdade, contra a
// infra Supabase real. A queda da CASCA de sessão de um cliente precisa chegar ao OUTRO como
// desconexão comum (§11.3), sem causa de pausa nova — e reabrir o link precisa retomar pelo
// caminho normal de reconexão (041). A MECÂNICA da pausa por desconexão já é provada headless
// (tests/net/pause.test.ts) e a de `leaveOnFatalError` também (tests/net/leaveOnFatalError.test.ts);
// o que este teste agrega é só a superfície visual — presença de verdade, dois browsers.
//
// Depende do heartbeat/presença do Realtime (mesma classe de flakiness do teste de queda em
// `multiplayer.spec.ts`) — OPT-IN (`E2E_PRESENCE=1 bunx playwright test`).
import { test, expect, type Page } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

const HOST_NAME = 'Anfitriao'
const GUEST_NAME = 'Convidada'

async function fillIdentity(page: Page, name: string, cta: RegExp): Promise<void> {
  await page.getByLabel('Seu nome').fill(name)
  await page.locator('button[aria-label^="Cor "]').first().click()
  await page.getByRole('button', { name: cta }).click()
}

test('a casca do convidado cai → o host vê pausa por desconexão → reabrir o link retoma', async ({ browser }) => {
  test.skip(!process.env.E2E_PRESENCE, 'depende do heartbeat do Realtime — rode com E2E_PRESENCE=1')
  test.slow()

  const hostCtx = await browser.newContext()
  const guestCtx = await browser.newContext()
  const host = await hostCtx.newPage()
  const guest = await guestCtx.newPage()

  await host.goto('/')
  await host.getByRole('button', { name: 'Começar uma partida' }).click()
  await fillIdentity(host, HOST_NAME, /^Criar sala$/)
  await expect(host.getByText('Sala aberta')).toBeVisible({ timeout: 20_000 })
  const roomUrl = host.url()

  await guest.goto(roomUrl)
  await expect(guest.getByText('Entrar na sala')).toBeVisible({ timeout: 20_000 })
  await fillIdentity(guest, GUEST_NAME, /^Confirmar e entrar$/)
  await expect(guest.getByText('Sala aberta')).toBeVisible({ timeout: 20_000 })
  await expect(host.getByText(GUEST_NAME)).toBeVisible({ timeout: 20_000 })

  await host.getByRole('button', { name: 'Abrir leilão' }).click()
  for (const p of [host, guest]) {
    await expect(p.getByText('Leilão da Largada')).toBeVisible({ timeout: 20_000 })
  }
  await host.getByLabel('Valor do lance').fill('350')
  await host.getByRole('button', { name: 'Lacrar lance de $350' }).click()
  await guest.getByLabel('Valor do lance').fill('500')
  await guest.getByRole('button', { name: 'Lacrar lance de $500' }).click()
  await Promise.all([
    expect(host.locator('.board-stage')).toBeVisible({ timeout: 20_000 }),
    expect(guest.locator('.board-stage')).toBeVisible({ timeout: 20_000 }),
  ])

  // — A casca do convidado cai (hook de E2E — FR-025) —
  const guestErrors: string[] = []
  guest.on('pageerror', (e) => guestErrors.push(e.message))
  const crashUrl = new URL(guest.url())
  crashUrl.searchParams.set('e2eCrashCasca', '1')
  await guest.goto(crashUrl.toString())

  // A tela de falha aparece — nunca em branco (FR-001) — e não é um erro de PÁGINA (React a
  // conteve): `pageerror` só dispara pra exceção que ESCAPA da árvore, não pra uma capturada.
  await expect(guest.getByText(/sessão foi interrompida/i)).toBeVisible({ timeout: 20_000 })
  expect(guestErrors, `a fronteira deveria conter, não deixar escapar: ${JSON.stringify(guestErrors)}`).toEqual([])

  // O host vê a mesa pausar por desconexão, nomeando o convidado — mesma mensagem de
  // qualquer outra queda (§11.3), sem causa nova (heartbeat do Realtime, ~60-75s).
  await expect(host.getByText('Partida pausada')).toBeVisible({ timeout: 90_000 })
  await expect(host.getByText(GUEST_NAME)).toBeVisible()

  // — Reabrir o link (link limpo, sem o parâmetro de crash) retoma pelo caminho normal —
  await guest.getByRole('button', { name: /Reabrir a sala/i }).click()
  await expect(guest.locator('.board-stage')).toBeVisible({ timeout: 20_000 })
  await expect(host.getByText('Partida pausada')).toBeHidden({ timeout: 20_000 })

  await hostCtx.close()
  await guestCtx.close()
})
