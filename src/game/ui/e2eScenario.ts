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
import { createRoom, joinRoom, SEAT_COLORS } from '@/net/room'
import { useRoomStore } from '@/net/roomStore'

const DEBTOR_ID = 'p1'
const CREDITOR_ID = 'p2'
const DEBT_AMOUNT = 500 // > caixa + hipoteca do primeiro título em qualquer mapa publicado
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

  // Deriva os lotes do estado semeado do mapa ativo. Índices fixos eram válidos no Atlas,
  // mas podiam apontar para Tesouro no Fuligem e quebravam o cenário antes de renderizar.
  const [debtorProperty, ...creditorProperties] = Object.keys(g.titles).map(Number)
  if (debtorProperty === undefined || creditorProperties.length < 3) {
    throw new Error('Cenário de fim de jogo exige ao menos quatro títulos compráveis')
  }
  g.titles[debtorProperty].ownerId = debtor.id
  for (const pos of creditorProperties.slice(0, 3)) g.titles[pos].ownerId = creditor.id

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

// `?players=2&scenario=avatar-skin` mantém o tabuleiro local, mas injeta a mesma identidade
// pública de uma sala real. O E2E consegue então provar que forma + skin chegam ao token,
// HUD e painéis sem abrir uma sala remota ou depender de credenciais.
function applyE2EAvatarSkinScenario(): void {
  if (typeof window === 'undefined') return
  if (new URLSearchParams(window.location.search).get('scenario') !== 'avatar-skin') return

  let room = createRoom('avatar-visual-test', {
    uid: 'visual-p1',
    name: 'Cartola',
    color: SEAT_COLORS[0],
    avatar: 'prism-face',
    skin: 'cartola',
  })
  const guest = joinRoom(room, {
    uid: 'visual-p2',
    name: 'Astronauta',
    color: SEAT_COLORS[1],
    avatar: 'totem-face',
    skin: 'astronauta',
  })
  if (!guest.ok) throw new Error(`Cenário visual inválido: ${guest.reason}`)
  room = { ...guest.room, status: 'playing' }
  useRoomStore.setState({ room, myUid: 'visual-p1' })
}

applyE2EAvatarSkinScenario()

// `?players=2&scenario=fuligem-showcase&map=fuligem` (055/SC-005): estado LEGAL de mesa
// rica para a validação visual do segundo mapa — bairro completo com construções (oficinas,
// fábrica, Complexo, Torre de Ferro), hipoteca com placa, Ferrovia com Estação de Carga e
// Sorte Grande acumulada. `scenario=fuligem-auction` reutiliza a mesma mesa e abre um
// leilão real, para conferir o modal junto do caixa dos rivais. Mesmo andaime dos cenários
// acima: só ativa com o parâmetro, nenhum reducer é tocado — o estado plantado é exatamente
// o que o motor produziria.
function applyE2EFuligemShowcaseScenario(): void {
  if (typeof window === 'undefined') return
  const scenario = new URLSearchParams(window.location.search).get('scenario')
  if (scenario !== 'fuligem-showcase' && scenario !== 'fuligem-auction') return

  const g = createSeedState(['p1', 'p2'], Date.now() - 65_000)
  const [ana, bia] = g.players
  ana.cash = 1420
  bia.cash = 860

  // Vila Bonfim completa (pos 6/8/9) com a escada visível: 4 oficinas,
  // fábrica e Torre de Ferro — o trilho de conexão do Bairro Completo acende.
  g.titles[6] = { ...g.titles[6], ownerId: ana.id, houses: 4 }
  g.titles[8] = { ...g.titles[8], ownerId: ana.id, houses: 0, hotel: true }
  g.titles[9] = { ...g.titles[9], ownerId: ana.id, houses: 0, hotel: true, hotel2: true, skyscraper: true }
  // Estação Bonfim (pos 5) com Estação de Carga.
  g.titles[5] = { ...g.titles[5], ownerId: ana.id, hangar: true }
  // Propriedades da adversária: uma hipotecada (placa HIPOTECADA) e uma normal.
  g.titles[11] = { ...g.titles[11], ownerId: bia.id, mortgaged: true }
  g.titles[13] = { ...g.titles[13], ownerId: bia.id }
  // Sorte Grande acumulada — o pote físico cresce.
  g.centerPot = 1850
  if (scenario === 'fuligem-auction') {
    g.turn = { ...g.turn, state: 'casa-a-resolver', pendingResolve: true }
    g.resolution = {
      kind: 'auction',
      auction: {
        pos: 33,
        currentBid: 420,
        highBidder: bia.id,
        activeBidders: [ana.id, bia.id],
        deadline: Date.now() + 60_000,
      },
    }
  }

  useGameStore.setState({ game: g })

  let room = createRoom('fuligem-visual', {
    uid: 'fuligem-p1',
    name: 'Ana',
    color: SEAT_COLORS[0],
    avatar: 'prism-face',
    skin: 'cartola',
  }, { boardId: 'fuligem' })
  const guest = joinRoom(room, {
    uid: 'fuligem-p2',
    name: 'Bia',
    color: SEAT_COLORS[1],
    avatar: 'totem-face',
    skin: 'aviador',
  })
  if (!guest.ok) throw new Error(`Cenário fuligem inválido: ${guest.reason}`)
  room = { ...guest.room, status: 'playing' }
  useRoomStore.getState().setRoom(room)
  useRoomStore.setState({ myUid: 'fuligem-p1' })
}

applyE2EFuligemShowcaseScenario()
