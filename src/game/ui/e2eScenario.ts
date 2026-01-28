// Hook de cenário semeado para o gate de partida completa (044/T049, D10 do plan:
// specs/044-polimento-lancamento/plan.md#d10--partida-completa-no-gate-é-partida-semeada-e-isso-é-honesto).
//
// `?scenario=endgame` monta um estado LEGAL de mesa de 2 perto da falência — um jogador com
// uma propriedade e caixa curto, dívida pendente que ele não cobre nem liquidando tudo (§9.1)
// — para `e2e/fullMatch.spec.ts` e `e2e/a11y.spec.ts` chegarem direto na decisão de falência
// pela interface real, sem depender de dezenas de rolagens de dado (isso o `sim:batch` já
// cobre, no motor, em lote). Mesmo tipo de andaime que `?players=N` (036, `game/store.ts`) e
// `?e2eCrashCasca` (042, `net/ui/OnlineGate.tsx`): só ativa com o parâmetro presente, nunca
// muda o caminho de jogo padrão.
//
// NENHUMA regra nova: `resolution: { kind: 'debt', ... }` é exatamente o formato que
// `economy/resolveRentable.ts:30` grava quando o aluguel estoura o caixa; quem PROCESSA a
// falência é o reducer de produção (`falencia.ts`, via `declare-bankruptcy`) — este módulo só
// planta o gatilho e deixa o motor decidir (inclusive herança de propriedade e patrimônio).
//
// Import de `@/game/store`/`@/game/setup` é LEITURA — nada aqui edita o motor (restrição da
// Fase 7: `src/game/` fora de `ui/` fica intocado).
import { useGameStore } from '@/game/store'
import { createSeedState } from '@/game/setup'
import type { GameState } from '@/game/turn/types'

const DEBTOR_ID = 'p1'
const CREDITOR_ID = 'p2'
const DEBTOR_PROPERTY = 1 // Roma (brown, preço 60) — "uma casa" (D10)
const CREDITOR_PROPERTIES = [5, 7, 9] // Pisa/Cairo/Gizé — patrimônio visível na classificação
const DEBT_AMOUNT = 500 // > liquidationValue(devedor) = 20 (caixa) + 30 (hipoteca de Roma) = 50
const DEBTOR_CASH = 20
const CREDITOR_CASH = 3000
const SEEDED_ROUND = 12 // "perto do fim" (D10) — cosmético; `matchSummary` só lê o valor
// Duração sempre "1 min" (nunca "indisponível") sem depender do timing exato do teste —
// `startedAt` fica no passado o bastante pra sobreviver ao tempo de boot + clique real.
const STARTED_MS_AGO = 65_000

function buildEndgameScenario(): GameState {
  const g = createSeedState([DEBTOR_ID, CREDITOR_ID], Date.now() - STARTED_MS_AGO)
  // `turnOrder` é identidade em `createSeedState` — mesma prática de
  // `tests/game/falencia/eliminationOrder.test.ts` (`bankruptAt`).
  const [debtor, creditor] = g.players
  debtor.cash = DEBTOR_CASH
  creditor.cash = CREDITOR_CASH

  g.titles[DEBTOR_PROPERTY].ownerId = debtor.id
  for (const pos of CREDITOR_PROPERTIES) g.titles[pos].ownerId = creditor.id

  g.round = SEEDED_ROUND
  g.activeSeat = 0 // assento do devedor
  g.turn = { ...g.turn, state: 'casa-a-resolver', pendingResolve: true }
  g.resolution = { kind: 'debt', amount: DEBT_AMOUNT, creditorId: creditor.id }

  return g
}

// Chamado uma vez, na avaliação do módulo (mesmo timing do `freshGame(initialPlayerIds())`
// de `store.ts` — o import de `useGameStore` já força a store a existir antes desta linha
// rodar). No-op sem o parâmetro: custo zero fora do gate.
function applyE2EEndgameScenario(): void {
  if (typeof window === 'undefined') return
  if (new URLSearchParams(window.location.search).get('scenario') !== 'endgame') return
  useGameStore.setState({ game: buildEndgameScenario() })
}

applyE2EEndgameScenario()
