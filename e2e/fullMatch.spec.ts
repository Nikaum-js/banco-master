// Gate de partida completa (044/T050, FR-050/FR-051). Sobe a versão CONSTRUÍDA (`vite
// preview` — projeto `built` de `playwright.config.ts`) e conduz pela interface REAL até a
// última falência, conferindo `phase: 'ended'` (via a tela — nunca lemos o estado interno)
// e a classificação: vencedor, patrimônio, propriedades e a rodada da queda.
//
// HONESTIDADE DO GATE (restrição da spec, D10 do plan): a partida É SEMEADA
// (`?scenario=endgame`, `e2e/script.ts`/`src/game/ui/e2eScenario.ts`) — mesa de 2, um
// jogador perto da falência, estado que passa pelos MESMOS reducers de produção. O que este
// gate prova é o CAMINHO (falência → fim de jogo → classificação na tela), não que partidas
// inteiras jogadas do zero não quebram — isso é o `sim:batch`, que já roda 30 partidas por PR
// no motor. Um gate que prometesse mais do que isso seria pior que gate nenhum.
import { test, expect } from '@playwright/test'
import { trackRuntimeErrors, gotoEndgameScenario } from './script'

test('partida semeada roda até a última falência e mostra a classificação final', async ({ page }) => {
  console.log(
    '[fullMatch] ATENÇÃO: partida SEMEADA via ?scenario=endgame (D10) — prova o caminho ' +
      'falência → fim de jogo → classificação pela UI real, não uma partida jogada do zero ' +
      '(o sim:batch cobre partidas inteiras no motor, em lote).',
  )

  const errors = trackRuntimeErrors(page)
  const start = Date.now()

  await gotoEndgameScenario(page)

  await expect(page.locator('.board-stage')).toBeVisible()
  const declareBankruptcy = page.getByRole('button', { name: 'Declarar falência' })
  await expect(declareBankruptcy).toBeEnabled()

  await declareBankruptcy.click()

  // — Fim de jogo (via a TELA — `phase: 'ended'` só é afirmado pelo que o EndGameScreen mostra) —
  await expect(page.getByText('VENCEDOR')).toBeVisible()
  // `.first()`: "Jogador 2" também aparece na lista lateral por trás do overlay — o nome que
  // importa aqui é o do cabeçalho de vencedor, não uma contagem de ocorrências na tela.
  await expect(page.getByText('Jogador 2').first()).toBeVisible() // credor — sobrevive à falência semeada

  const rows = page.locator('table tbody tr')
  await expect(rows).toHaveCount(2) // 2 jogadores, 2 linhas — nenhum órfão, nenhum agrupamento "sem posição"

  // Classificação: vencedor em 1º, eliminado em 2º. A coluna "Queda" saiu na v1.27 — ela só
  // repetia a ordem que a própria classificação já expressa; o que se afirma agora é a ORDEM.
  const winnerRow = rows.nth(0)
  const eliminatedRow = rows.nth(1)
  await expect(winnerRow).toContainText('1º')
  await expect(winnerRow).toContainText('Jogador 2')
  await expect(eliminatedRow).toContainText('2º')
  await expect(eliminatedRow).toContainText('Jogador 1')

  // Contas novas da v1.27 (caixa, países, construções, maior aluguel): o eliminado zera em todas,
  // e é o travessão que prova que a coluna existe e está preenchida em vez de vazia.
  await expect(eliminatedRow).toContainText('—')

  // Patrimônio: o vencedor herdou caixa + as 4 propriedades (§9.2 — sem empréstimo ativo, o
  // credor herda tudo); o eliminado fica em 0, por definição de falência.
  await expect(winnerRow).toContainText('R$')
  await expect(eliminatedRow).toContainText('R$ 0')

  // Duração: sempre dita, nunca "indisponível" — `startedAt` real (Date.now() - 65s) no seed.
  await expect(page.getByText(/\d+ (min|s)\b/)).toBeVisible()
  await expect(page.getByText('duração indisponível')).toHaveCount(0)

  const elapsedMs = Date.now() - start
  console.log(`[fullMatch] gate concluído em ${elapsedMs}ms (partida semeada — não é o tempo de uma partida real)`)

  expect(errors, `erros de runtime: ${JSON.stringify(errors)}`).toEqual([])
})
