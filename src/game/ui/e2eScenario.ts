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
import { maybeOpenLandAuction, placeLandBid } from '@/game/economy/landAuction'
import { busSideOf } from '@/game/turn/turnMachine'
import { isRentableKind } from '@/game/economy/titles'
import { THEME } from '@/game/theme'
import { BOARD } from '@/lib/boardData'

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

// `?scenario=pregao&lots=N` (N de 1 a `LAND_AUCTION_THRESHOLD`, default 6) — pregão de
// ESCASSEZ aberto, para o gate responsivo, o de acessibilidade e a inspeção visual. Combina
// com `&map=fuligem`: `applyMapFromUrl` já trocou o `BOARD` ativo quando este módulo roda.
//
// O pregão não é PLANTADO, é DISPARADO: o cenário deixa exatamente `N` terrenos sem dono e
// chama `maybeOpenLandAuction`, o reducer de produção. Se o gatilho da §7.5 quebrar, a tela
// simplesmente não abre e o teste falha — que é o comportamento útil de um andaime. Plantar
// um `landAuction` literal daria uma tela verde sobre um motor morto.
function applyE2EPregaoScenario(): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  if (params.get('scenario') !== 'pregao') return

  const teto = THEME.LAND_AUCTION_THRESHOLD
  const pedidos = Number(params.get('lots'))
  const livres = Number.isFinite(pedidos) && pedidos >= 1 ? Math.min(pedidos, teto) : teto

  const g = createSeedState(['p1', 'p2', 'p3'], Date.now() - 65_000)
  g.players[0].cash = 1_480
  g.players[1].cash = 920
  g.players[2].cash = 610
  g.round = 14

  // Todo terreno comprável fica com dono, menos os `livres` primeiros: é o estado de véspera
  // de escassez que o gatilho lê. Alternar o dono evita uma mesa em que só p1 tem escritura.
  const compraveis = BOARD.filter((sq) => isRentableKind(sq.kind)).map((sq) => sq.pos)
  compraveis.slice(livres).forEach((pos, i) => {
    g.titles[pos].ownerId = i % 2 === 0 ? 'p1' : 'p2'
  })

  const now = Date.now()
  let aberto = maybeOpenLandAuction(g, now)
  if (!aberto.landAuction) throw new Error('Cenário de pregão não abriu — gatilho da §7.5 mudou')

  // Um lote disputado e outro na ponta do jogador local: a tela precisa mostrar os três
  // estados que o jogador compara (sem lance, lance de rival, lance seu), não só o vazio.
  const lotes = aberto.landAuction.lots.map((l) => l.pos)
  if (lotes.length >= 2) aberto = placeLandBid(aberto, 'p2', lotes[0], 180, now)
  if (lotes.length >= 3) aberto = placeLandBid(aberto, 'p1', lotes[1], 240, now)

  useGameStore.setState({ game: aberto })

  let room = createRoom('pregao-visual', {
    uid: 'pregao-p1',
    name: 'Ana',
    color: SEAT_COLORS[0],
    avatar: 'prism-face',
    skin: 'cartola',
  }, { boardId: params.get('map') === 'fuligem' ? 'fuligem' : 'atlas' })
  for (const [i, who] of [['pregao-p2', 'Bia'], ['pregao-p3', 'Caio']].entries()) {
    const guest = joinRoom(room, {
      uid: who[0],
      name: who[1],
      color: SEAT_COLORS[i + 1],
      avatar: 'totem-face',
      skin: i === 0 ? 'aviador' : 'astronauta',
    })
    if (!guest.ok) throw new Error(`Cenário de pregão inválido: ${guest.reason}`)
    room = guest.room
  }
  useRoomStore.getState().setRoom({ ...room, status: 'playing' })
  useRoomStore.setState({ myUid: 'pregao-p1' })
}

applyE2EPregaoScenario()

// `?scenario=acoes&modo=bus|prisao|compra` — a ZONA DE AÇÃO do miolo cheia, para o gate
// responsivo. É a região com mais variação da tela (de um botão a três) e a que mais
// aperta em retrato de celular, onde o miolo útil fica em ~240px; sem gancho, alcançá-la
// dependia de rolar o dado até cair na casa certa, o que não é determinístico.
//
// Mesmo andaime dos demais: só ativa com o parâmetro, nenhum reducer é tocado, e o estado
// plantado é exatamente o que o motor produziria — as flags lidas por `diceArenaView`
// (`aguardando-finalizacao`, `prisao-decisao`, `pendingResolve`) são as de produção.
function applyE2EAcoesScenario(): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  if (params.get('scenario') !== 'acoes') return
  const modo = params.get('modo') ?? 'bus'

  const g = createSeedState(['p1', 'p2'], Date.now() - 65_000)
  const [eu] = g.players
  eu.cash = 2_400
  g.activeSeat = 0
  g.round = 7

  if (modo === 'prisao') {
    // Preso: "Tentar dupla" + "Pagar fiança" — o par que o jogador relatou apertado.
    eu.pos = BOARD.findIndex((sq) => sq.kind === 'corner-jail')
    eu.jail = { inJail: true, attempts: 0 }
    g.turn = { ...g.turn, state: 'prisao-decisao' }
  } else if (modo === 'compra') {
    // Comprar + Leilão, com a casa a resolver sob o peão.
    const alvo = Object.keys(g.titles).map(Number).find((pos) => !g.titles[pos].ownerId)
    if (alvo === undefined) throw new Error('Cenário de ações exige um título sem dono')
    eu.pos = alvo
    g.turn = { ...g.turn, state: 'casa-a-resolver', pendingResolve: true }
    g.resolution = { kind: 'purchase', pos: alvo }
  } else {
    // O PIOR caso: fim de turno com Bus Ticket em mão — dois botões, e três na Fuligem,
    // onde o desvio pela ferrovia (D-073) acrescenta o de embarque.
    eu.busTickets = 3
    // Fora de canto: `canUseBusTicket` recusa sobre canto (FR-003a).
    eu.pos = BOARD.findIndex((sq, i) => i > 0 && busSideOf(i) !== null && sq.kind === 'property')
    g.turn = { ...g.turn, state: 'aguardando-finalizacao' }
  }

  useGameStore.setState({ game: g })

  const room = createRoom('acoes-visual', {
    uid: 'acoes-p1',
    name: 'Nikaum',
    color: SEAT_COLORS[0],
    avatar: 'prism-face',
    skin: 'cartola',
  }, { boardId: params.get('map') === 'fuligem' ? 'fuligem' : 'atlas' })
  const guest = joinRoom(room, {
    uid: 'acoes-p2',
    name: 'Rival',
    color: SEAT_COLORS[1],
    avatar: 'totem-face',
    skin: 'aviador',
  })
  if (!guest.ok) throw new Error(`Cenário de ações inválido: ${guest.reason}`)
  useRoomStore.getState().setRoom({ ...guest.room, status: 'playing' })
  useRoomStore.setState({ myUid: 'acoes-p1' })
}

applyE2EAcoesScenario()
