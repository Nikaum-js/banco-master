// Conservação de dinheiro (036, extensão) — verifica que TODO mecanismo que move caixa entre
// jogadores/banco/pote move exatamente o valor esperado, recalculado de forma independente do
// reducer (mesmo espírito do checkB em invariants.ts, ampliado a todos os mecanismos mapeados:
// aluguel, imposto, Free Parking, GO, TaxMan, juros de empréstimo, as 14 cartas imediatas,
// ofensivas, reação, hipoteca/construção, leilões e falência).
//
// Arquitetura: um "razão" (ledger) de deltas ESPERADOS é acumulado por dispatch — cada
// sub-checker (Grupo A: identificado por `action.kind`; Grupo B: identificado por diff de
// estado, já que GO/TaxMan/cartas podem disparar por várias ações diferentes) contribui ao
// mesmo acumulador. No final, comparamos o acumulado contra o delta REAL de cada jogador e do
// pote — um jogador não mencionado por nenhum sub-checker deveria ter delta ZERO (pega
// movimentação de dinheiro por canal lateral não previsto, sem precisar de um caso "senão").
//
// TaxMan e falência-sem-herdeiro são SINKS legítimos (destroem dinheiro de propósito, não
// creditam ninguém) — verificamos o VALOR exato do sink, não acusamos "dinheiro sumiu".
import { BOARD } from '@/lib/boardData'
import type { GameState } from '@/game/turn/types'
import { activePlayer } from '@/game/turn/turnMachine'
import { rentCity, rentAirport, rentUtility, diceValue } from '@/game/economy/rent'
import { ownerOf, isMortgaged, groupOwnedCount, groupSize, countOwned, groupHasSkyscraper } from '@/game/economy/titles'
import { hasImmunity } from '@/game/economy/imunidade'
import { apagaoActive, greveActive, isBoycotted } from '@/game/economy/tempEffects'
import { mortgageValue, unmortgageCost, transferKeepFee } from '@/game/economy/mortgage'
import { buildCost, cityLevel, HANGAR_COST } from '@/game/economy/construction'
import { netWorth } from '@/game/cards/effects'
import { cardById } from '@/game/cards/catalog'
import { activeLoanFor } from '@/game/emprestimos/emprestimos'
import { isBankrupt } from '@/game/falencia/falencia'
import { validateTrade } from '@/game/economy/trade'
import { reactorFor, findReactionCard } from '@/game/cards/reacao'
import { THEME } from '@/game/theme'
import type { SimAction } from './types'
import type { Violation } from './invariants'

// Catálogo fixo de mecanismos que este arquivo sabe verificar — usado pelo relatório (report.ts)
// para apontar cobertura ZERO num lote (gap real, não suposição), não para validar nada aqui.
const IMMEDIATE_CARD_EFFECTS = [
  'boomEconomico', 'erroBanco', 'aniversario', 'honorarios', 'criseImobiliaria', 'consertoImoveis',
  'voltaGo', 'refinanciamento', 'vaPrisao', 'avance3', 'volte3', 'investidorAnjo', 'passagemOnibus',
  'apagao', 'greveUtilidades',
] as const

export const KNOWN_MECHANISMS: readonly string[] = [
  'buy-property',
  'rent', 'rent-debt', 'rent-immune', 'rent-zero',
  'tax', 'tax-debt', 'tax-bunker-open',
  'free-parking-collect',
  'go-bonus', 'loan-interest-on-go',
  'taxman-sink', 'taxman-sink-utility-unverified', 'taxman-no-charge',
  'jail-fine-pay', 'jail-fine-3rd-attempt',
  'mortgage', 'unmortgage', 'build-house', 'sell-building', 'build-hangar', 'sell-hangar',
  'acquire', 'evict', 'audit',
  'diplomacia-use', 'bunker-use', 'bunker-refuse-pay', 'bunker-refuse-debt',
  'declare-bankruptcy', 'declare-bankruptcy-sink',
  'accept-trade', 'pay-off-loan', 'grant-loan', 'pay-debt',
  'auction-close', 'land-auction-close',
  'card-drawn-hand', 'card:atalho-opened', 'card-effect-no-cash',
  ...IMMEDIATE_CARD_EFFECTS.map((e) => `card:${e}`),
]

function cashOf(state: GameState, id: string): number {
  return state.players.find((p) => p.id === id)?.cash ?? 0
}

// Acumulador de deltas ESPERADOS para este dispatch — cada sub-checker soma ao invés de
// afirmar isoladamente, o que resolve de graça o caso de dois mecanismos tocarem o mesmo
// jogador no mesmo dispatch (ex.: multa de prisão + bônus de GO na mesma tentativa).
interface Ledger {
  cash: Map<string, number>
  pot: number
  mechanisms: string[]
}

function newLedger(): Ledger {
  return { cash: new Map(), pot: 0, mechanisms: [] }
}

function addCash(ledger: Ledger, id: string, delta: number): void {
  if (delta === 0) return
  ledger.cash.set(id, (ledger.cash.get(id) ?? 0) + delta)
}

function addPot(ledger: Ledger, delta: number): void {
  ledger.pot += delta
}

function mark(ledger: Ledger, mechanism: string): void {
  ledger.mechanisms.push(mechanism)
}

function finalize(prev: GameState, next: GameState, ledger: Ledger): Violation[] {
  const out: Violation[] = []
  for (const p of prev.players) {
    const expected = ledger.cash.get(p.id) ?? 0
    const actual = cashOf(next, p.id) - p.cash
    if (actual !== expected) {
      out.push({
        code: 'h',
        detail: `Δcash(${p.id}) esperado ${expected}, obtido ${actual} [mecanismos: ${ledger.mechanisms.join(',') || 'nenhum'}]`,
      })
    }
  }
  const actualPot = next.centerPot - prev.centerPot
  if (actualPot !== ledger.pot) {
    out.push({
      code: 'h',
      detail: `Δpote esperado ${ledger.pot}, obtido ${actualPot} [mecanismos: ${ledger.mechanisms.join(',') || 'nenhum'}]`,
    })
  }
  return out
}

// Aluguel devido na casa `pos`, calculado de forma independente sobre `state` (mesmas fórmulas
// puras que o motor usa — rentCity/rentAirport/rentUtility — mas recomputadas aqui, não
// reaproveitando o número já calculado pelo reducer). Retorna null se a casa não é aluguel
// devido (própria/hipotecada/imune/boicotada) — mesmas guardas de resolveRentable.ts/taxMan.ts.
function rentDue(state: GameState, pos: number, ownerIdOverride?: string): { owner: string; amount: number } | null {
  const sq = BOARD[pos]
  if (sq.kind !== 'property' && sq.kind !== 'airport' && sq.kind !== 'utility') return null
  const owner = ownerIdOverride ?? ownerOf(state, pos)
  if (owner === null) return null
  if (isMortgaged(state, pos)) return null
  if (isBoycotted(state, pos)) return null

  let amount = 0
  if (sq.kind === 'airport') {
    const hangarDobra = state.titles[pos].hangar && !apagaoActive(state)
    amount = rentAirport(countOwned(state, 'airport', owner)) * (hangarDobra ? 2 : 1)
  } else if (sq.kind === 'utility') {
    amount = greveActive(state) ? 0 : rentUtility(countOwned(state, 'utility', owner), diceValue(state.turn.lastRoll))
  } else {
    const t = state.titles[pos]
    amount = rentCity(
      sq.group,
      sq.rent,
      groupOwnedCount(state, sq.group, owner),
      groupSize(sq.group),
      { houses: t.houses, hotel: t.hotel, hotel2: t.hotel2, skyscraper: t.skyscraper },
      groupHasSkyscraper(state, sq.group),
    )
  }
  return { owner, amount }
}

// GO bonus + juros de empréstimo (chargeLoanInterest via afterPassGo) — dispara por VÁRIAS
// ações (roll/use-bus-ticket/choose-bus-move/choose-triple-dest/jail-decision(try)/
// choose-card-shortcut), por isso detectado por DIFF (log), não por action.kind. `advance()`
// loga incondicionalmente "passou pelo GO"/"parou no GO" mesmo quando land() sobrescreve a
// posição depois (ex.: caiu em "Vá pra Prisão") — usar o LOG, não a posição final, evita esse
// falso-negativo/positivo.
// Entradas de log realmente NOVAS neste dispatch — cuidado com o bound de 50 (log.ts):
// quando o log já está no teto, push+shift mantém o comprimento igual, então "cresceu" não
// basta. A mensagem de GO (se houver) é sempre a ÚLTIMA entrada empurrada por este dispatch
// (advance() loga depois de rollDice já ter logado o lance), então comparar só a última
// entrada contra a última de `prev` é suficiente para este detector.
// Um único dispatch pode empurrar até 3 entradas ("rolou X+Y" + "passou/parou no GO" + "pagou
// juros") — alinha as duas listas PELO FIM e para na primeira dupla idêntica (o log só cresce
// por push+shift, então uma vez achando uma entrada igual, tudo antes dela também é igual).
function sameEntries(a: GameState['log'], b: GameState['log']): boolean {
  if (a.length !== b.length) return false
  return a.every((e, i) => e.who === b[i].who && e.what === b[i].what)
}

// Acha as entradas realmente NOVAS deste dispatch testando hipóteses de k (0..3) empurradas:
// se k entradas novas entraram (com shift quando o log já está no teto de 50 — log.ts), a
// parte "sobrevivente" de `next` (tudo menos as k últimas) tem que bater com a cauda
// correspondente de `prev` deslocada em k. Comparar só por ÍNDICE fixo a partir do fim (como
// numa versão anterior) quebra justamente no caso comum de shift-por-1: a entrada antiga que
// só mudou de posição parece "nova" por engano.
function newLogEntries(prev: GameState, next: GameState): GameState['log'] {
  const grew = Math.max(next.log.length - prev.log.length, 0)
  const MAX_CHECK = 3
  for (let k = grew; k <= MAX_CHECK; k++) {
    const survivedLen = next.log.length - k
    if (survivedLen < 0) continue
    const nextOld = next.log.slice(0, survivedLen)
    const prevOld = prev.log.slice(prev.log.length - survivedLen)
    if (sameEntries(nextOld, prevOld)) return next.log.slice(survivedLen)
  }
  return [] // não deveria acontecer na prática (mais de 3 pushes num dispatch só)
}

function detectGoCrossing(prev: GameState, next: GameState, actorId: string): { landedExactly: boolean } | null {
  for (const entry of newLogEntries(prev, next)) {
    if (entry.who !== actorId) continue
    if (entry.what.startsWith('parou no GO')) return { landedExactly: true }
    if (entry.what.startsWith('passou pelo GO')) return { landedExactly: false }
  }
  return null
}

function applyGoCrossing(prev: GameState, next: GameState, actorId: string, ledger: Ledger): void {
  const crossing = detectGoCrossing(prev, next, actorId)
  if (!crossing) return
  const bonus = THEME.GO_PASS * (crossing.landedExactly ? 2 : 1)
  addCash(ledger, actorId, bonus)
  mark(ledger, 'go-bonus')

  const loan = activeLoanFor(prev, actorId)
  if (!loan) return
  const interest = Math.round((loan.principal * loan.ratePct) / 100)
  const availableAfterBonus = cashOf(prev, actorId) + bonus
  if (availableAfterBonus >= interest) {
    addCash(ledger, actorId, -interest)
    addCash(ledger, loan.creditorId, interest)
  } else {
    addCash(ledger, actorId, -availableAfterBonus) // zera (bonus já contado acima)
    addCash(ledger, loan.creditorId, availableAfterBonus)
  }
  mark(ledger, 'loan-interest-on-go')
}

// TaxMan (012): move 1×/turno via advanceSeat (finalize OU qualquer ação que force fim de
// turno — finishIfEnded). Detectado por diff de posição do Fiscal, não por action.kind.
// `skipAmount`: declare-bankruptcy reatribui propriedades ao herdeiro e SÓ DEPOIS roda o
// TaxMan (via advanceSeat, no mesmo dispatch) — o dono que o TaxMan vê já é o pós-falência,
// não o `prev` (pré-falência) que este checker usa como referência. Recomputar a posse
// intermediária exigiria replicar a lógica inteira de declareBankruptcy; mais simples e
// honesto aceitar o valor observado neste caso raro (mesmo padrão do dado de utilidade).
// `bankruptcyCtx`: declare-bankruptcy reatribui propriedades ao herdeiro e SÓ DEPOIS roda o
// TaxMan (via advanceSeat, no mesmo dispatch — advanceSeat SEMPRE roda o Fiscal). O dono/caixa
// que o TaxMan vê já é o PÓS-falência, não o `prev` (pré-falência) puro. `ownerState=next`
// reflete a posse correta (nada mais muda títulos depois do TaxMan neste dispatch); a base de
// caixa do herdeiro precisa somar a herança ANTES de subtrair a cobrança do Fiscal.
function applyTaxMan(
  prev: GameState,
  next: GameState,
  ledger: Ledger,
  bankruptcyCtx?: { heirId: string | null; debtorCashBefore: number },
): void {
  if (next.taxManPos === prev.taxManPos) return
  const ownerState = bankruptcyCtx ? next : prev
  const cashBaseline = (id: string): number => {
    const base = cashOf(prev, id)
    return bankruptcyCtx && id === bankruptcyCtx.heirId ? base + bankruptcyCtx.debtorCashBefore : base
  }
  const sq = BOARD[next.taxManPos]
  if (sq.kind !== 'property' && sq.kind !== 'airport' && sq.kind !== 'utility') {
    mark(ledger, 'taxman-no-charge')
    return
  }
  const owner = ownerOf(ownerState, next.taxManPos)
  if (owner === null || isMortgaged(ownerState, next.taxManPos) || isBoycotted(ownerState, next.taxManPos)) {
    mark(ledger, 'taxman-no-charge')
    return
  }
  if (sq.kind === 'utility') {
    // taxMan.ts rola SEU PRÓPRIO dado (não o `turn.lastRoll` do jogador ativo) pra achar o
    // multiplicador de utilidade — esse valor não fica em lugar nenhum do GameState, então não
    // dá pra recomputar de forma independente. Greve zera incondicionalmente (verificável);
    // fora isso, aceitamos o delta observado (só confirmamos que foi um sink do dono certo).
    if (greveActive(ownerState)) {
      mark(ledger, 'taxman-sink') // amount=0 esperado
      return
    }
    const actualDelta = cashOf(next, owner) - cashBaseline(owner)
    addCash(ledger, owner, actualDelta)
    mark(ledger, 'taxman-sink-utility-unverified')
    return
  }
  const due = rentDue(ownerState, next.taxManPos, owner)!
  const charged = Math.min(cashBaseline(owner), due.amount)
  addCash(ledger, owner, -charged) // SINK — banco remove, não credita ninguém (taxMan.ts:4)
  mark(ledger, 'taxman-sink')
}

// Efeitos das 14 cartas imediatas (cards/effects.ts) + avance3/volte3 (podem cruzar o GO).
// `deckPeek` é o id no TOPO do baralho ANTES do saque — determinístico (sem RNG neste ponto),
// então dá pra saber qual carta vai sair e recomputar a fórmula esperada sobre `prev`.
function applyImmediateCard(prev: GameState, next: GameState, actorId: string, effect: string, ledger: Ledger): void {
  mark(ledger, `card:${effect}`)
  switch (effect) {
    case 'boomEconomico':
      for (const p of prev.players) if (!p.eliminated) addCash(ledger, p.id, 200)
      return
    case 'erroBanco':
      addCash(ledger, actorId, 200)
      return
    case 'aniversario': {
      let total = 0
      for (const p of prev.players) {
        if (p.id === actorId || p.eliminated) continue
        const paid = Math.min(50, p.cash)
        addCash(ledger, p.id, -paid)
        total += paid
      }
      addCash(ledger, actorId, total)
      return
    }
    case 'honorarios': {
      const paid = Math.min(50, cashOf(prev, actorId))
      addCash(ledger, actorId, -paid)
      addPot(ledger, paid)
      return
    }
    case 'criseImobiliaria': {
      let total = 0
      for (const p of prev.players) {
        if (p.eliminated) continue
        const owed = Math.round(netWorth(prev, p.id) * 0.05)
        const paid = Math.min(owed, p.cash)
        addCash(ledger, p.id, -paid)
        total += paid
      }
      addPot(ledger, total)
      return
    }
    case 'consertoImoveis': {
      let cost = 0
      for (const sq of BOARD) {
        const t = prev.titles[sq.pos]
        if (sq.kind === 'property' && t?.ownerId === actorId) cost += t.hotel ? 100 : t.houses * 25
      }
      if (cost === 0) return
      const paid = Math.min(cost, cashOf(prev, actorId))
      addCash(ledger, actorId, -paid)
      addPot(ledger, paid)
      return
    }
    case 'voltaGo':
      // effects.ts NÃO chama ports.afterPassGo aqui (só advance() chama) — assimetria real do
      // motor: cair no GO por esta carta credita o bônus mas NUNCA cobra juros de empréstimo.
      addCash(ledger, actorId, THEME.GO_PASS * 2) // cai exatamente no GO — sempre dobrado
      return
    case 'avance3': {
      const pos = prev.players.find((p) => p.id === actorId)!.pos
      if (pos + 3 >= BOARD.length) {
        const landedOnGo = (pos + 3) % BOARD.length === 0
        const bonus = THEME.GO_PASS * (landedOnGo ? 2 : 1)
        addCash(ledger, actorId, bonus)
        applyLoanInterestUnconditional(prev, actorId, bonus, ledger)
      }
      return
    }
    case 'refinanciamento': {
      const sq = BOARD.find((b) => 'price' in b && prev.titles[b.pos]?.ownerId === actorId && prev.titles[b.pos]?.mortgaged)
      if (!sq) return // sem hipoteca própria → no-op (mesma guarda de effects.ts)
      const cost = Math.round(Math.round(('price' in sq ? sq.price : 0) / 2) * 1.05) // 5% (não os 10% da deshipoteca normal)
      if (cashOf(prev, actorId) < cost) return
      addCash(ledger, actorId, -cost)
      return
    }
    // Sem movimentação de caixa: vaPrisao, volte3, saiaPrisao, investidorAnjo, passagemOnibus,
    // apagao, greveUtilidades — o ledger fica como está (delta esperado = 0 para todos).
    default:
      return
  }
}

// GO forçado por carta (voltaGo sempre; avance3 se cruzar) também dispara afterPassGo (juros).
function applyLoanInterestUnconditional(prev: GameState, actorId: string, bonusAlreadyApplied: number, ledger: Ledger): void {
  const loan = activeLoanFor(prev, actorId)
  if (!loan) return
  const interest = Math.round((loan.principal * loan.ratePct) / 100)
  const availableAfterBonus = cashOf(prev, actorId) + bonusAlreadyApplied
  if (availableAfterBonus >= interest) {
    addCash(ledger, actorId, -interest)
    addCash(ledger, loan.creditorId, interest)
  } else {
    addCash(ledger, actorId, -availableAfterBonus)
    addCash(ledger, loan.creditorId, availableAfterBonus)
  }
  mark(ledger, 'loan-interest-on-go')
}

// resolve-pending: aluguel/imposto/Free Parking/saque de carta — todos disparam pela MESMA
// ação genérica; o mecanismo real só se sabe olhando a casa/estado ANTES do dispatch (`prev`).
function checkResolvePending(prev: GameState, next: GameState, ledger: Ledger): void {
  if (prev.turn.state !== 'casa-a-resolver' || prev.turn.awaitingChoice !== null) return
  const actor = activePlayer(prev)
  const sq = BOARD[actor.pos]

  if (sq.kind === 'property' || sq.kind === 'airport' || sq.kind === 'utility') {
    const owner = ownerOf(prev, actor.pos)
    if (owner === null || owner === actor.id) return // compra pendente ou própria — sem aluguel
    if (hasImmunity(prev, actor.id, actor.pos)) {
      mark(ledger, 'rent-immune')
      return
    }
    const due = rentDue(prev, actor.pos, owner)
    if (!due || due.amount === 0) {
      mark(ledger, 'rent-zero')
      return
    }
    if (actor.cash < due.amount) {
      mark(ledger, 'rent-debt') // insolvente → dívida pendente, sem pagamento agora
      return
    }
    addCash(ledger, actor.id, -due.amount)
    addCash(ledger, owner, due.amount)
    mark(ledger, 'rent')
    return
  }

  if (sq.kind === 'tax') {
    // Bunker Fiscal na mão → abre reação em vez de cobrar (taxBunkerResolve tem prioridade).
    const hasBunker = actor.hand.some((id) => cardById(id).effect === 'bunkerFiscal')
    if (hasBunker) {
      mark(ledger, 'tax-bunker-open')
      return
    }
    if (actor.cash < sq.amount) {
      mark(ledger, 'tax-debt')
      return
    }
    addCash(ledger, actor.id, -sq.amount)
    addPot(ledger, sq.amount)
    mark(ledger, 'tax')
    return
  }

  if (sq.kind === 'corner-parking') {
    // collectCenter NÃO zera o pote — RESETA pro seed (balancing.ts:27), então o delta do
    // pote é (seed - potAntes), não -potAntes.
    addCash(ledger, actor.id, prev.centerPot)
    addPot(ledger, THEME.PARKING_SEED - prev.centerPot)
    mark(ledger, 'free-parking-collect')
    return
  }

  if (sq.kind === 'acaso' || sq.kind === 'tesouro') {
    const cardId = prev.decks[sq.kind][0] // topo do baralho — determinístico (sem RNG aqui)
    if (!cardId) return
    const card = cardById(cardId)
    if (card.mode === 'mao') {
      mark(ledger, 'card-drawn-hand')
      return
    }
    if (card.effect === 'atalho') {
      mark(ledger, 'card:atalho-opened') // só abre a escolha; sem dinheiro neste dispatch
      return
    }
    applyImmediateCard(prev, next, actor.id, card.effect, ledger)
    return
  }
  // bus-ticket / corner-go / corner-jail / corner-gotojail: sem dinheiro.
}

// Ofensivas com alvo (aquisição hostil/despejo/auditoria) — mesma fórmula esteja a jogada
// vindo direto da mão (play-hand-card) ou de uma recusa de Diplomacia (respond-reaction).
function applyOffensiveMoney(prev: GameState, attackerId: string, effect: string, targetPos: number | null, targetPlayer: string | null, ledger: Ledger): void {
  if (effect === 'aquisicaoHostil' && targetPos != null) {
    const sq = BOARD[targetPos]
    const owner = ownerOf(prev, targetPos)
    if (owner === null) return
    const mult = sq.kind === 'airport' || sq.kind === 'utility' ? 1.5 : 1
    const price = Math.round(('price' in sq ? sq.price : 0) * mult)
    const fee = prev.titles[targetPos]?.mortgaged ? transferKeepFee(sq) : 0
    addCash(ledger, attackerId, -(price + fee))
    addCash(ledger, owner, price) // taxa fica com o banco — não é P2P puro
    mark(ledger, 'acquire')
    return
  }
  if (effect === 'despejo') {
    mark(ledger, 'evict') // demolição — sem dinheiro (dono não recebe nada)
    return
  }
  if (effect === 'auditoriaFiscal' && targetPlayer != null) {
    const owed = Math.round(netWorth(prev, targetPlayer) * 0.1)
    const paid = Math.min(cashOf(prev, targetPlayer), owed)
    addCash(ledger, targetPlayer, -paid)
    addPot(ledger, paid)
    mark(ledger, 'audit')
    return
  }
  mark(ledger, 'card-effect-no-cash') // boicote/imunidade/saiaPrisao/etc.
}

// Grupo A — ação identificável diretamente por `action.kind`.
function checkDirectAction(prev: GameState, next: GameState, action: SimAction, ledger: Ledger): void {
  switch (action.kind) {
    case 'mortgage': {
      const sq = BOARD[action.pos]
      if (!('price' in sq) || prev.titles[action.pos]?.ownerId !== activePlayer(prev).id || prev.titles[action.pos]?.mortgaged) return
      addCash(ledger, activePlayer(prev).id, mortgageValue(sq))
      mark(ledger, 'mortgage')
      return
    }
    case 'unmortgage': {
      const sq = BOARD[action.pos]
      if (!('price' in sq) || !prev.titles[action.pos]?.mortgaged || prev.titles[action.pos]?.ownerId !== activePlayer(prev).id) return
      const cost = unmortgageCost(sq)
      if (cashOf(prev, activePlayer(prev).id) < cost) return
      addCash(ledger, activePlayer(prev).id, -cost)
      mark(ledger, 'unmortgage')
      return
    }
    case 'build-house': {
      const sq = BOARD[action.pos]
      if (sq.kind !== 'property' || prev.titles[action.pos]?.ownerId !== activePlayer(prev).id) return
      addCash(ledger, activePlayer(prev).id, -buildCost(sq))
      mark(ledger, 'build-house')
      return
    }
    case 'sell-building': {
      const sq = BOARD[action.pos]
      if (sq.kind !== 'property' || prev.titles[action.pos]?.ownerId !== activePlayer(prev).id) return
      if (cityLevel(prev.titles[action.pos]) === 0) return
      addCash(ledger, activePlayer(prev).id, Math.round(buildCost(sq) / 2))
      mark(ledger, 'sell-building')
      return
    }
    case 'build-hangar': {
      if (BOARD[action.pos].kind !== 'airport' || prev.titles[action.pos]?.ownerId !== activePlayer(prev).id) return
      addCash(ledger, activePlayer(prev).id, -HANGAR_COST)
      mark(ledger, 'build-hangar')
      return
    }
    case 'sell-hangar': {
      if (BOARD[action.pos].kind !== 'airport' || !prev.titles[action.pos]?.hangar) return
      addCash(ledger, activePlayer(prev).id, Math.round(HANGAR_COST / 2))
      mark(ledger, 'sell-hangar')
      return
    }
    case 'jail-decision': {
      const player = activePlayer(prev)
      if (action.decision === 'pay') {
        addCash(ledger, player.id, -THEME.JAIL_FINE)
        addPot(ledger, THEME.JAIL_FINE)
        mark(ledger, 'jail-fine-pay')
      } else if (action.decision === 'try') {
        // 3ª tentativa: só cobra multa obrigatória se REALMENTE falhar (sem dupla) — sucesso
        // escapa de graça. `next.turn.lastRoll` ainda é este mesmo lance (land() não zera o
        // turno neste caminho, só startTurn() zeraria, e isso só roda se turn.state='encerrado',
        // o que não é o caso aqui — advance+land deixam 'casa-a-resolver').
        const failed = next.turn.lastRoll?.isDouble === false
        if (player.jail.attempts === 2 && failed) {
          const paid = Math.min(THEME.JAIL_FINE, player.cash)
          addCash(ledger, player.id, -paid)
          addPot(ledger, paid)
          mark(ledger, 'jail-fine-3rd-attempt')
        }
      }
      applyGoCrossing(prev, next, player.id, ledger)
      return
    }
    case 'play-hand-card': {
      const player = activePlayer(prev)
      const card = cardById(action.cardId)
      if (card.mode !== 'mao' || !player.hand.includes(action.cardId)) return
      if (card.effect === 'imunidade' || card.effect === 'saiaPrisao') {
        mark(ledger, 'card-effect-no-cash')
        return
      }
      if (card.effect === 'boicote' || card.effect === 'aquisicaoHostil' || card.effect === 'despejo' || card.effect === 'auditoriaFiscal') {
        const target = action.target ?? null
        const targetPlayer = action.targetPlayer ?? null
        const reactor = reactorFor(prev, card.effect, player.id, target, targetPlayer)
        if (!reactor) return // jogada inválida — no-op
        if (findReactionCard(prev, reactor, 'diplomacia')) {
          mark(ledger, 'card-effect-no-cash') // abre reaction-diplomacia — ofensiva "em voo", sem dinheiro ainda
          return
        }
        applyOffensiveMoney(prev, player.id, card.effect, target, targetPlayer, ledger)
        return
      }
      return
    }
    case 'respond-reaction': {
      const res = prev.resolution
      if (res?.kind === 'reaction-diplomacia') {
        if (action.use) mark(ledger, 'diplomacia-use') // cancela — sem dinheiro
        else applyOffensiveMoney(prev, res.attackerId, res.effect, res.targetPos, res.targetPlayer, ledger)
        return
      }
      if (res?.kind === 'reaction-bunker') {
        if (action.use) {
          mark(ledger, 'bunker-use') // cancela o imposto — sem dinheiro
        } else {
          const reactor = cashOf(prev, res.reactorId)
          if (reactor >= res.amount) {
            addCash(ledger, res.reactorId, -res.amount)
            addPot(ledger, res.amount)
            mark(ledger, 'bunker-refuse-pay')
          } else {
            mark(ledger, 'bunker-refuse-debt') // sem caixa → abre dívida, sem pagamento agora
          }
        }
        return
      }
      return
    }
    case 'declare-bankruptcy': {
      if (prev.resolution?.kind !== 'debt') return
      const debtor = activePlayer(prev)
      if (!isBankrupt(prev, debtor.id, prev.resolution.amount)) return // solvente via liquidação → no-op
      const loan = activeLoanFor(prev, debtor.id)
      const heirId = loan ? loan.creditorId : prev.resolution.creditorId
      if (heirId) {
        addCash(ledger, heirId, debtor.cash)
        addCash(ledger, debtor.id, -debtor.cash)
        mark(ledger, 'declare-bankruptcy')
      } else {
        addCash(ledger, debtor.id, -debtor.cash) // SINK — sem herdeiro (dívida de imposto/TaxMan sem credor)
        mark(ledger, 'declare-bankruptcy-sink')
      }
      return
    }
    case 'accept-trade': {
      const trade = prev.pendingTrade
      if (!trade || !validateTrade(prev, trade)) return // pode ter ficado obsoleta desde o propose (024)
      const feeOn = (props: number[]) => props.reduce((sum, p) => sum + (prev.titles[p]?.mortgaged ? transferKeepFee(BOARD[p]) : 0), 0)
      const feesFrom = feeOn(trade.toProps) // `from` recebe `toProps`
      const feesTo = feeOn(trade.fromProps) // `to` recebe `fromProps`
      addCash(ledger, trade.fromId, trade.toCash - trade.fromCash - feesFrom)
      addCash(ledger, trade.toId, trade.fromCash - trade.toCash - feesTo)
      mark(ledger, 'accept-trade')
      return
    }
    case 'pay-off-loan': {
      const player = activePlayer(prev)
      const loan = activeLoanFor(prev, player.id)
      if (!loan || player.cash < loan.principal) return
      addCash(ledger, player.id, -loan.principal)
      addCash(ledger, loan.creditorId, loan.principal)
      mark(ledger, 'pay-off-loan')
      return
    }
    case 'respond-loan': {
      if (!action.accept || !prev.pendingLoan) return
      const { debtorId, creditorId, principal } = prev.pendingLoan
      if (!Number.isInteger(action.ratePct) || action.ratePct < 10 || action.ratePct > 50) return
      // Réplica de TODAS as guardas de grantLoan (emprestimos.ts) — entre propose-loan e
      // respond-loan o devedor pode ter liquidado (hipoteca/venda), mudando o déficit real.
      if (prev.resolution?.kind !== 'debt') return
      if (debtorId !== activePlayer(prev).id) return
      if (activeLoanFor(prev, debtorId)) return
      if (creditorId === debtorId) return
      const creditor = prev.players.find((p) => p.id === creditorId)
      if (!creditor || creditor.eliminated) return
      const shortfall = prev.resolution.amount - cashOf(prev, debtorId)
      if (principal <= 0 || principal < shortfall || principal > creditor.cash) return
      addCash(ledger, creditorId, -principal)
      addCash(ledger, debtorId, principal)
      mark(ledger, 'grant-loan')
      return
    }
    case 'buy-property': {
      if (prev.resolution?.kind !== 'purchase') return
      const player = activePlayer(prev)
      const sq = BOARD[prev.resolution.pos]
      const discount = player.nextPurchaseDiscount ?? 0
      const price = Math.round(('price' in sq ? sq.price : 0) * (1 - discount))
      if (player.cash < price) return
      addCash(ledger, player.id, -price)
      mark(ledger, 'buy-property')
      return
    }
    case 'pay-debt': {
      if (prev.resolution?.kind !== 'debt') return
      const { amount, creditorId } = prev.resolution
      if (activePlayer(prev).cash < amount) return
      addCash(ledger, activePlayer(prev).id, -amount)
      if (creditorId) addCash(ledger, creditorId, amount)
      else addPot(ledger, amount) // dívida ao banco (imposto) → pote (falencia.ts:55)
      mark(ledger, 'pay-debt')
      return
    }
    case 'roll':
    case 'use-bus-ticket':
    case 'choose-bus-move':
    case 'choose-triple-dest':
    case 'choose-card-shortcut':
      applyGoCrossing(prev, next, activePlayer(prev).id, ledger)
      return
    default:
      return
  }
}

// closeExhaustedAuctions (driver.ts) fecha leilão de propriedade e/ou lotes de terreno fora
// do `dispatch` normal — checagem própria, chamada pelo runGame no mesmo ponto.
export function checkAuctionClose(prev: GameState, next: GameState): { violations: Violation[]; mechanisms: string[] } {
  const ledger = newLedger()
  if (prev.resolution?.kind === 'auction' && next.resolution?.kind !== 'auction') {
    const a = prev.resolution.auction
    if (a.highBidder) {
      const winner = a.highBidder
      addCash(ledger, winner, -Math.min(a.currentBid, cashOf(prev, winner)))
      mark(ledger, 'auction-close')
    }
  }
  if (prev.landAuction) {
    // settleLot roda em SEQUÊNCIA sobre o MESMO clone (landAuction.ts:124): se o mesmo
    // vencedor fecha 2+ lotes nesta leva, o 2º lote paga com o caixa JÁ DESCONTADO pelo 1º —
    // por isso mantemos um saldo corrente por jogador em vez de comparar cada lote contra
    // `prev` isoladamente (senão dá falso positivo quando o caixa não cobre todos os lotes
    // ao preço cheio).
    const nextLots = new Set((next.landAuction?.lots ?? []).map((l) => l.pos))
    const running = new Map<string, number>()
    for (const lot of prev.landAuction.lots) {
      if (nextLots.has(lot.pos)) continue // ainda em aberto
      if (!lot.highBidder) continue // sem lance — permanece livre, sem dinheiro
      const winnerAlive = next.players.find((p) => p.id === lot.highBidder && !p.eliminated)
      if (!winnerAlive) continue // faliu entre o lance e o fecho — lote fica livre, sem dinheiro
      const available = running.get(lot.highBidder) ?? cashOf(prev, lot.highBidder)
      const charged = Math.min(lot.currentBid, available)
      running.set(lot.highBidder, available - charged)
      addCash(ledger, lot.highBidder, -charged)
      mark(ledger, 'land-auction-close')
    }
  }
  return { violations: finalize(prev, next, ledger), mechanisms: ledger.mechanisms }
}

// Mesma condição de disparo de `declareBankruptcy` (falencia.ts) — recomputada aqui só para
// saber se ESTE dispatch reatribui propriedades antes do TaxMan rodar (ver applyTaxMan).
function bankruptcyContext(prev: GameState, action: SimAction): { heirId: string | null; debtorCashBefore: number } | undefined {
  if (action.kind !== 'declare-bankruptcy' || prev.resolution?.kind !== 'debt') return undefined
  const debtor = activePlayer(prev)
  if (!isBankrupt(prev, debtor.id, prev.resolution.amount)) return undefined
  const loan = activeLoanFor(prev, debtor.id)
  const heirId = loan ? loan.creditorId : prev.resolution.creditorId
  return { heirId, debtorCashBefore: debtor.cash }
}

export function checkConservation(prev: GameState, next: GameState, action: SimAction): { violations: Violation[]; mechanisms: string[] } {
  const ledger = newLedger()
  checkDirectAction(prev, next, action, ledger)
  if (action.kind === 'resolve-pending') checkResolvePending(prev, next, ledger)
  applyTaxMan(prev, next, ledger, bankruptcyContext(prev, action))
  return { violations: finalize(prev, next, ledger), mechanisms: ledger.mechanisms }
}
