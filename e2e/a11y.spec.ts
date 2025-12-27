// Gate de acessibilidade (044/T051, FR-022, D9 do plan). `axe` só encontra o que está
// RENDERIZADO — metade do que importa mora em modal de decisão, que só existe com uma
// partida em curso — então este roteiro usa o mesmo andaime determinístico de
// `e2e/script.ts` (036) pra levar a interface até cada parada do caminho de jogo (spec.md
// §"Caminho de jogo") e roda `@axe-core/playwright` em cada uma.
//
// Falha em violação `serious`/`critical` (D-039 — rebaixar isso exige ADR nova, não uma
// linha de código). `moderate`/`minor` só são relatadas: um gate que também quebra nelas
// vira negociação, e alguém o desliga.
//
// Roda sobre a versão CONSTRUÍDA (projeto `built`, playwright.config.ts) — o mesmo motivo
// de T052/FR-051: o que o PR promoveria é o bundle de produção, não o dev server.
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { trackRuntimeErrors, step, gotoEndgameScenario } from './script'

interface ViolationRow {
  id: string
  impact: string | null | undefined
  help: string
  nodes: number
}

const BLOCKING_IMPACTS = new Set(['serious', 'critical'])

async function auditStop(page: Page, label: string, report: Record<string, ViolationRow[]>): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).analyze()
  report[label] = violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length }))
}

// Clica passos do roteiro fixo (script.ts) até um botão com o nome dado aparecer — SEM
// clicá-lo. É como paramos bem no instante em que a decisão abre, pra auditar a TELA de
// decisão em vez de já ter resolvido ela.
async function driveUntilVisible(page: Page, name: string | RegExp, maxSteps = 500): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    if (await page.getByRole('button', { name }).first().isVisible().catch(() => false)) return
    await step(page)
  }
  throw new Error(`não chegou a um botão "${String(name)}" dentro de ${maxSteps} passos`)
}

test('caminho de jogo não tem violação de acessibilidade serious/critical', async ({ page }) => {
  test.setTimeout(180_000)
  // Movimento reduzido (044/motion.ts, D7 do plan) ANTES de navegar: sem isso, o `axe` às
  // vezes flagra um `color-contrast` fantasma no meio de uma transição do Motion (opacity
  // interpolando entre 0 e 1 no instante exato do scan) — falso positivo de timing, não uma
  // violação real. Rodar sob movimento reduzido também é, por si, uma superfície do caminho
  // de jogo que vale auditar (T076/T072).
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors = trackRuntimeErrors(page)
  const report: Record<string, ViolationRow[]> = {}

  // — 1. Home —
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^Criar sala$/ })).toBeVisible()
  await auditStop(page, 'home', report)

  // — 2. Lobby ("Criar sala") — o projeto `built` sobe com credenciais Supabase FALSAS
  // (playwright.config.ts) só pra passar de "Multiplayer indisponível" pro formulário; o
  // roteiro NUNCA submete (sem rede real disponível no gate padrão, ver aviso da "pausa" abaixo).
  await page.goto('/?host=1')
  await expect(page.getByLabel('Seu nome')).toBeVisible()
  await auditStop(page, 'lobby', report)

  // — 3. Tabuleiro —
  await page.goto('/?players=2')
  await expect(page.locator('.board-stage')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Rolar dados' })).toBeVisible()
  await auditStop(page, 'tabuleiro', report)

  // — 4. Modal de compra — e — 5. modal de leilão (mesma sessão: recusar a compra abre o leilão) —
  await driveUntilVisible(page, /^Comprar/)
  await auditStop(page, 'modal de compra', report)
  await page.getByRole('button', { name: 'Leilão' }).click()
  await expect(page.getByRole('heading', { name: 'Leilão ao vivo' })).toBeVisible()
  await auditStop(page, 'modal de leilão', report)

  // — 6. Fim de jogo — partida SEMEADA (D10, mesmo aviso de fullMatch.spec.ts): prova a TELA,
  // não uma partida jogada do zero.
  console.log(
    '[a11y] fim de jogo auditado sobre partida SEMEADA (?scenario=endgame, D10) — prova a tela, não uma partida jogada do zero.',
  )
  await gotoEndgameScenario(page)
  await page.getByRole('button', { name: 'Declarar falência' }).click()
  await expect(page.getByText('VENCEDOR')).toBeVisible()
  await auditStop(page, 'fim de jogo', report)

  // — Relatório completo, sempre impresso — SC-008: o gate precisa ser legível, não só
  // vermelho/verde. `serious`/`critical` reprovam (D-039); `moderate`/`minor` só entram no log.
  const blocking: string[] = []
  let total = 0
  for (const [screen, violations] of Object.entries(report)) {
    for (const v of violations) {
      total++
      const line = `[a11y] ${screen}: impact=${v.impact ?? '?'} ${v.id} (${v.nodes} nó(s)) — ${v.help}`
      console.log(line)
      if (v.impact && BLOCKING_IMPACTS.has(v.impact)) blocking.push(line)
    }
  }
  if (total === 0) console.log('[a11y] nenhuma violação em nenhuma parada.')

  // AVISO DE COBERTURA (honestidade do gate, mesmo princípio do D10): "pausa/reconexão"
  // (banner de partida pausada) fica FORA desta varredura. Ele só existe com uma SALA real —
  // Realtime + heartbeat de presença —, a mesma classe de dependência que já é opt-in em
  // `e2e/multiplayer.spec.ts` (`E2E_PRESENCE=1` + credenciais reais). Fabricar esse estado
  // sem infra real seria simular a tela, não auditar a de produção.
  console.log(
    '[a11y] COBERTURA: "pausa/reconexão" (multiplayer) não está nesta varredura — depende de sala ' +
      'real (Realtime + heartbeat), fora do padrão do gate. Ver e2e/multiplayer.spec.ts (E2E_PRESENCE=1).',
  )

  expect(blocking, `violações serious/critical:\n${blocking.join('\n')}`).toEqual([])
  expect(errors, `erros de runtime: ${JSON.stringify(errors)}`).toEqual([])
})
