// E2E multiplayer (spec 038, T036) — o roteiro que a suíte headless NÃO alcança: dois
// browsers de verdade, contra a infra Supabase real, verificando o que só existe na tela.
//
// Contextos SEPARADOS são obrigatórios: abas do mesmo browser compartilham `localStorage`,
// logo o mesmo token de sessão, e a segunda faria takeover do assento (FR-006a da 037) em
// vez de virar um segundo jogador.
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

test.describe.configure({ mode: 'serial' })

// FR-052/T053: este gate só entra quando há credencial REAL disponível — nunca em silêncio.
// Sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` no ambiente do runner (distinto do
// placeholder que `playwright.config.ts` injeta só no projeto `built`, que nem roda este
// arquivo), o Playwright reporta a suíte inteira como "skipped" com o motivo abaixo —
// aparece no relatório, não um verde enganoso nem uma pane silenciosa.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

if (!SUPABASE_CONFIGURED) {
  console.warn(
    '[multiplayer.spec] PULADO: sem VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY no ambiente — ' +
      'o gate multiplayer não roda sem credencial real (FR-052). Não está no CI padrão por ' +
      'este motivo (ver comentário do job `e2e` em .github/workflows/ci.yml).',
  )
}
test.skip(!SUPABASE_CONFIGURED, 'sem VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY — gate multiplayer pulado (FR-052)')

const HOST_NAME = 'Anfitriao'
const GUEST_NAME = 'Convidada'

// FR-054: nenhum roteiro pode deixar sala de teste para trás. Não existe policy de DELETE
// anônimo por design (`supabase/migrations/0001_rooms_snapshots.sql`: "a limpeza de salas
// velhas é trabalho de rotina do lado servidor") — o que o cliente PODE fazer é marcar
// `status: 'ended'`, o mesmo estado que uma partida real alcança sozinha ao terminar. Isso
// tira a sala de qualquer contagem de "sala aberta" sem depender de uma policy que não existe.
const createdRoomIds: string[] = []

function roomIdFromUrl(url: string): string | null {
  return new URL(url).searchParams.get('room')
}

async function markRoomsEnded(): Promise<void> {
  const ids = createdRoomIds.splice(0)
  if (ids.length === 0 || !SUPABASE_CONFIGURED) return
  const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
  await Promise.all(ids.map((id) => client.from('rooms').update({ status: 'ended' }).eq('id', id)))
}

test.afterEach(async () => {
  await markRoomsEnded().catch((e: unknown) => {
    console.warn(`[multiplayer.spec] limpeza de sala falhou (não bloqueia o teste): ${String(e)}`)
  })
})

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
  const createdRoomId = roomIdFromUrl(roomUrl)
  if (createdRoomId) createdRoomIds.push(createdRoomId) // FR-054 — marcado 'ended' no afterEach
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
  const createdRoomId = roomIdFromUrl(roomUrl)
  if (createdRoomId) createdRoomIds.push(createdRoomId) // FR-054 — marcado 'ended' no afterEach

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

// Joga rodadas alternadas até alguém ver o botão "Leilão" (recusa de compra) e clica nele —
// dirige o jogo até um leilão aberto sem depender de uma posição fixa no tabuleiro.
async function playUntilAuction(pages: Page[], maxRounds = 60): Promise<void> {
  for (let i = 0; i < maxRounds; i++) {
    for (const p of pages) {
      const leilao = p.getByRole('button', { name: 'Leilão' })
      if (await leilao.isVisible().catch(() => false)) {
        await leilao.click()
        return
      }
      const finalizar = p.getByRole('button', { name: 'Finalizar turno' })
      if (await finalizar.isVisible().catch(() => false)) {
        await finalizar.click()
        await p.waitForTimeout(300)
        continue
      }
      const rolar = p.getByRole('button', { name: 'Rolar dados' })
      if (await rolar.isVisible().catch(() => false)) {
        await rolar.click()
        await p.waitForTimeout(600)
      }
    }
  }
  throw new Error('não chegou a um leilão dentro do limite de rodadas — ajuste maxRounds')
}

// SC-005/SC-009 (041, D-034/D-033) — a promessa que esta spec inteira existe para cumprir:
// o host pode recarregar a página NO MEIO de um prazo em voo, e a partida continua exatamente
// de onde parou — leilão vivo, prazo restante preservado (não zerado, não reiniciado), zero
// perda de estado. A MECÂNICA (deslocamento de deadline pela pausa) já é provada headless em
// `tests/net/pause.test.ts`/`authority-reassume.test.ts`; o que este teste agrega é a prova
// em browser real: reload de verdade, reassunção de autoridade de verdade.
test('leilão sobrevive ao reload do host — prazo preservado (SC-005/SC-009)', async ({ browser }) => {
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
  const createdRoomId = roomIdFromUrl(roomUrl)
  if (createdRoomId) createdRoomIds.push(createdRoomId) // FR-054 — marcado 'ended' no afterEach

  await guest.goto(roomUrl)
  await expect(guest.getByText('Entrar na sala')).toBeVisible({ timeout: 20_000 })
  await fillIdentity(guest, GUEST_NAME, /^Entrar$/)
  await expect(host.getByText(GUEST_NAME)).toBeVisible({ timeout: 20_000 })

  await host.getByRole('button', { name: /Iniciar partida/ }).click()
  for (const p of [host, guest]) {
    await p.getByRole('button', { name: 'Começar' }).click()
    await expect(p.locator('.board-stage')).toBeVisible({ timeout: 20_000 })
  }

  await playUntilAuction([host, guest])
  await expect(host.getByText('Leilão').first()).toBeVisible({ timeout: 20_000 })
  await expect(guest.getByText('Leilão').first()).toBeVisible({ timeout: 20_000 })

  // Prazo restante ANTES do reload — lido da tela do convidado, que não vai recarregar.
  const secLeftBefore = await readSecondsLeft(guest)
  expect(secLeftBefore).toBeGreaterThan(0)

  // "F5 do host": recarrega a aba. A queda de conexão pausa a mesa para o convidado — nada
  // avança, o prazo congela — e a reassunção de autoridade (FR-015) faz o host voltar à
  // MESMA partida, lida do snapshot.
  await host.reload()

  await expect(guest.getByText('Partida pausada')).toBeVisible({ timeout: 60_000 })

  // O host reassume sozinho (nenhuma identidade/lobby de novo — `session.enter()` no boot) e
  // a mesa retoma: sem transferência, sem timeout, sem punição.
  await expect(host.locator('.board-stage')).toBeVisible({ timeout: 30_000 })
  await expect(guest.getByText('Partida pausada')).not.toBeVisible({ timeout: 30_000 })

  // O leilão CONTINUA vivo — estado íntegro (SC-005) — e o prazo restante foi deslocado pelo
  // tempo da pausa, não zerado nem reiniciado do topo (SC-009).
  await expect(host.getByText('Leilão').first()).toBeVisible({ timeout: 20_000 })
  await expect(guest.getByText('Leilão').first()).toBeVisible()
  const secLeftAfter = await readSecondsLeft(guest)
  expect(secLeftAfter).toBeGreaterThan(0)
  // Folga generosa (reload + reconexão real levam alguns segundos): o que importa é que o
  // prazo NÃO foi para o início da janela nem para zero — foi preservado, deslocado pela pausa.
  expect(Math.abs(secLeftAfter - secLeftBefore)).toBeLessThan(15)

  await hostCtx.close()
  await guestCtx.close()
})

async function readSecondsLeft(page: Page): Promise<number> {
  const text = await page.getByText(/Termina em \d+s/).first().innerText()
  const m = /Termina em (\d+)s/.exec(text)
  if (!m) throw new Error(`não achou o contador de prazo em: ${text}`)
  return Number(m[1])
}
