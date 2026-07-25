// E2E multiplayer (spec 038, T036) — o roteiro que a suíte headless NÃO alcança: dois
// browsers de verdade, contra a infra Supabase real, verificando o que só existe na tela.
//
// Contextos SEPARADOS são obrigatórios: abas do mesmo browser compartilham `localStorage`,
// logo o mesmo token de sessão, e a segunda faria takeover do assento (FR-006a da 037) em
// vez de virar um segundo jogador.
import { test, expect, type BrowserContext, type Page } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

const HOST_NAME = 'Anfitriao'
const GUEST_NAME = 'Convidada'

// Preenche nome + escolhe a 1ª cor e a 1ª peça livres, e confirma.
async function fillIdentity(page: Page, name: string, cta: RegExp): Promise<void> {
  await page.getByPlaceholder('Como aparecer na mesa').fill(name)
  await page.locator('button[aria-label^="Cor "]').first().click()
  await page.locator('button[aria-pressed]').filter({ hasText: /^[^ ]$/ }).first().click().catch(() => {})
  await page.getByRole('button', { name: cta }).click()
}

test('dois browsers jogam a mesma partida, cada um da sua perspectiva', async ({ browser }) => {
  const hostCtx: BrowserContext = await browser.newContext()
  const guestCtx: BrowserContext = await browser.newContext()
  const host = await hostCtx.newPage()
  const guest = await guestCtx.newPage()

  const errors: string[] = []
  for (const p of [host, guest]) {
    p.on('pageerror', (e) => errors.push(e.message))
  }

  // — 1. Tela inicial: a porta de entrada existe sem editar URL (FR-021) —
  await host.goto('/')
  await expect(host.getByRole('button', { name: 'Criar sala' })).toBeVisible()

  await host.getByRole('button', { name: 'Criar sala' }).click()
  await fillIdentity(host, HOST_NAME, /^Criar sala$/)

  // — 2. Sala aberta: link compartilhável e o host sentado —
  await expect(host.getByText('Sala aberta')).toBeVisible({ timeout: 20_000 })
  await expect(host.getByText(HOST_NAME)).toBeVisible()
  const roomUrl = host.url()
  expect(roomUrl).toContain('?room=')

  // — 3. Convidada entra pelo link (FR-002) —
  await guest.goto(roomUrl)
  await expect(guest.getByText('Entrar na sala')).toBeVisible({ timeout: 20_000 })
  await fillIdentity(guest, GUEST_NAME, /^Entrar$/)
  await expect(guest.getByText('Sala aberta')).toBeVisible({ timeout: 20_000 })

  // O anfitrião vê a chegada — sem recarregar nada.
  await expect(host.getByText(GUEST_NAME)).toBeVisible({ timeout: 20_000 })

  // — 4. Início: ordem sorteada aparece para os dois (FR-030) —
  await host.getByRole('button', { name: /Iniciar partida/ }).click()
  for (const p of [host, guest]) {
    await expect(p.getByText('Ordem da mesa')).toBeVisible({ timeout: 20_000 })
    await p.getByRole('button', { name: 'Começar' }).click()
    await expect(p.locator('.board-stage')).toBeVisible({ timeout: 20_000 })
  }

  // — 5. Identidade real: nomes na mesa, nenhum `pN` (FR-008/009 · SC-002) —
  for (const p of [host, guest]) {
    await expect(p.getByText(HOST_NAME).first()).toBeVisible()
    await expect(p.getByText(GUEST_NAME).first()).toBeVisible()
    const body = (await p.locator('body').innerText()).replace(/\s+/g, ' ')
    expect(body, 'id técnico vazou para a tela').not.toMatch(/\bp[1-8]\b/)
  }

  // — 6. Perspectiva: só o ator tem o controle de rolar (FR-002 · SC-001) —
  const rollHost = host.getByRole('button', { name: 'Rolar dados' })
  const rollGuest = guest.getByRole('button', { name: 'Rolar dados' })
  const hostRolls = await rollHost.isVisible()
  const guestRolls = await rollGuest.isVisible()
  expect(hostRolls !== guestRolls, 'exatamente um dos dois deve poder rolar').toBe(true)

  const ator = hostRolls ? host : guest
  const observador = hostRolls ? guest : host
  const nomeAtor = hostRolls ? HOST_NAME : GUEST_NAME
  // Quem observa lê de quem o jogo está esperando, em vez de um botão morto (FR-003).
  // No turno normal isso vive na arena ("Vez de <nome>"); decisões fora do turno usam a
  // barra "Aguardando <nome>".
  await expect(observador.getByText(new RegExp(`Vez de ${nomeAtor}|Aguardando`))).toBeVisible()

  // — 7. Mão privada: cada tela mostra a PRÓPRIA mão (FR-005/006 · princípio VI) —
  for (const p of [host, guest]) {
    await expect(p.getByText('Minhas Cartas')).toBeVisible()
  }

  // — 8. Uma jogada real propaga para os dois (SC-001) —
  await ator.getByRole('button', { name: 'Rolar dados' }).click()
  // O comando volta difundido e move o peão nas DUAS telas: o saldo/posição do ator muda
  // também na tela de quem observa (convergência visível — SC-001).
  await expect(observador.getByText(/Vez de|Aguardando|Resolva|Finalize/).first()).toBeVisible({ timeout: 20_000 })

  expect(errors, `erros de runtime: ${JSON.stringify(errors)}`).toEqual([])

  await hostCtx.close()
  await guestCtx.close()
})

// A pausa por desconexão depende do Presence do Realtime, e o tempo até o `leave` NÃO é
// determinístico: fechamento limpo da aba emite na hora; queda abrupta (crash, cabo, aba
// morta) só é notada quando o heartbeat do Phoenix expira — medido em ~60-75s aqui. Um gate
// não pode depender disso, então este passo é OPT-IN (`E2E_PRESENCE=1 bunx playwright test`).
// A MECÂNICA da pausa já é provada headless em `tests/net/pause.test.ts` (7 casos, incluindo
// a exceção D-029); o que este teste agrega é só a superfície visual.
test('queda do convidado pausa a mesa e diz quem caiu', async ({ browser }) => {
  test.skip(!process.env.E2E_PRESENCE, 'depende do heartbeat do Realtime — rode com E2E_PRESENCE=1')
  test.slow()

  const hostCtx = await browser.newContext()
  const guestCtx = await browser.newContext()
  const host = await hostCtx.newPage()
  const guest = await guestCtx.newPage()

  await host.goto('/')
  await host.getByRole('button', { name: 'Criar sala' }).click()
  await fillIdentity(host, HOST_NAME, /^Criar sala$/)
  await expect(host.getByText('Sala aberta')).toBeVisible({ timeout: 20_000 })
  const roomUrl = host.url()

  await guest.goto(roomUrl)
  await expect(guest.getByText('Entrar na sala')).toBeVisible({ timeout: 20_000 })
  await fillIdentity(guest, GUEST_NAME, /^Entrar$/)
  await expect(host.getByText(GUEST_NAME)).toBeVisible({ timeout: 20_000 })

  await host.getByRole('button', { name: /Iniciar partida/ }).click()
  for (const p of [host, guest]) {
    await p.getByRole('button', { name: 'Começar' }).click()
    await expect(p.locator('.board-stage')).toBeVisible({ timeout: 20_000 })
  }

  await guest.close()
  await guestCtx.close()

  await expect(host.getByText('Partida pausada')).toBeVisible({ timeout: 150_000 })
  await expect(host.getByText(new RegExp(GUEST_NAME)).first()).toBeVisible()
  await expect(host.getByText(/Nada se perde/).first()).toBeVisible() // sem timeout, sem punição
  await hostCtx.close()
})
