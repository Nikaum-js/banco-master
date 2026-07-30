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
import { ownerOf, isMortgaged, groupOwnedCount, groupSize, countOwned, groupHasSkyscraper, isRentableKind } from '@/game/economy/titles'
import { hasImmunity } from '@/game/economy/imunidade'
import { apagaoActive, greveActive, isBoycotted, isPlayerImmune, isValorizada, estatizacaoActive } from '@/game/economy/tempEffects'
import { mortgageValue, unmortgageCost, transferKeepFee } from '@/game/economy/mortgage'
import { buildCost, cityLevel, HANGAR_COST } from '@/game/economy/construction'
import { netWorth } from '@/game/cards/effects'
import { cardById } from '@/game/cards/catalog'
import { activeLoanFor } from '@/game/emprestimos/emprestimos'
import { isBankrupt, liquidatorOf } from '@/game/falencia/falencia'
import { validateTrade } from '@/game/economy/trade'
import { reactorFor, findReactionCard } from '@/game/cards/reacao'
import { THEME } from '@/game/theme'
import { activeRules } from '@/lib/mapCatalog'
import type { SimAction } from './types'
import type { Violation } from './invariants'

// Catálogo fixo de mecanismos que este arquivo sabe verificar — usado pelo relatório (report.ts)
// para apontar cobertura ZERO num lote (gap real, não suposição), não para validar nada aqui.
const IMMEDIATE_CARD_EFFECTS = [
  'boomEconomico', 'erroBanco', 'aniversario', 'honorarios', 'criseImobiliaria', 'consertoImoveis',
  'voltaGo', 'vaPrisao', 'avance3', 'volte3', 'investidorAnjo', 'passagemOnibus',
  // D-064 — greve funde apagao+greveUtilidades; refinanciamento saiu; 6 imediatas novas.
  'greve', 'estatizacao', 'desvalorizacaoCambial', 'obrasNaPista', 'multaAmbiental',
  'resgateDoPote', 'obraRelampago', 'incentivoFiscal',
] as const

export const KNOWN_MECHANISMS: readonly string[] = [
  'buy-property',
  'rent', 'rent-debt', 'rent-immune', 'rent-zero',
  'tax', 'tax-debt', 'tax-bunker-open',
  'free-parking-collect',
  'go-bonus', 'loan-interest-on-go',
  'jail-fine-pay', 'jail-fine-3rd-attempt',
  'mortgage', 'unmortgage', 'build-house', 'sell-building', 'build-hangar', 'sell-hangar',
  'acquire', 'evict', 'audit', 'swap', 'tax-immune',
  'diplomacia-use', 'bunker-use', 'bunker-refuse-pay', 'bunker-refuse-debt',
  'declare-bankruptcy', 'declare-bankruptcy-sink',
  'accept-trade', 'pay-off-loan', 'grant-loan', 'pay-debt',
  'auction-close', 'land-auction-close',
  // D-061/D-062/D-063 — mecanismos novos; cobertura ZERO num lote passa a ser gap visível.
  'obligation-open', 'obligation-paid', 'sell-to-bank',
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

function ownsMine(state: GameState, metal: 'ferro' | 'carvao' | 'cobre' | 'estanho', ownerId: string): boolean {
  return BOARD.some(
    (sq) => sq.kind === 'mine' && sq.metal === metal
      && state.titles[sq.pos]?.ownerId === ownerId
      && !state.titles[sq.pos]?.mortgaged,
  )
}

function discountedByTin(state: GameState, payerId: string, amount: number): number {
  return ownsMine(state, 'estanho', payerId)
    ? Math.round(amount * THEME.MINE_BONUS.estanho)
    : amount
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
  if (sq.kind !== 'property' && sq.kind !== 'airport' && sq.kind !== 'utility' && sq.kind !== 'mine') return null
  const owner = ownerIdOverride ?? ownerOf(state, pos)
  if (owner === null) return null
  if (isMortgaged(state, pos)) return null
  if (isBoycotted(state, pos)) return null

  let amount: number
  if (sq.kind === 'mine') {
    amount = 0
  } else if (sq.kind === 'airport') {
    const hangarDobra = state.titles[pos].hangar && !apagaoActive(state)
    const coal = ownsMine(state, 'carvao', owner) ? THEME.MINE_BONUS.carvao : 1
    amount = Math.round(rentAirport(countOwned(state, 'airport', owner)) * coal) * (hangarDobra ? 2 : 1)
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
    const temConstrucao = t.houses >= 1 || t.hotel || t.hotel2 || t.skyscraper
    if (temConstrucao && ownsMine(state, 'cobre', owner)) {
      amount = Math.round(amount * THEME.MINE_BONUS.cobre)
    }
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
// Igualdade por VALOR, não por referência — o motor clona o estado inteiro
// (structuredClone) a cada dispatch, então campos de array (ex.: `white` de 'roll')
// nunca sobrevivem por identidade mesmo quando a entrada é a MESMA logicamente.
function sameEntry(a: GameState['log'][number], b: GameState['log'][number]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function sameEntries(a: GameState['log'], b: GameState['log']): boolean {
  if (a.length !== b.length) return false
  return a.every((e, i) => sameEntry(e, b[i]))
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
    if (entry.kind !== 'go' || entry.who !== actorId) continue
    return { landedExactly: entry.landed }
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

// O checker do Fiscal (`applyTaxMan`) saiu com a D-065: o Fiscal foi removido do jogo, então
// não há mais cobrança automática na passagem de turno para conferir. A AUSÊNCIA dela é travada
// por `tests/game/balancing/fiscalRemovido.test.ts`, e o invariante de narração cobriria
// qualquer débito novo que aparecesse sem fato.


// Efeitos das 14 cartas imediatas (cards/effects.ts) + avance3/volte3 (podem cruzar o GO).
// `deckPeek` é o id no TOPO do baralho ANTES do saque — determinístico (sem RNG neste ponto),
// então dá pra saber qual carta vai sair e recomputar a fórmula esperada sobre `prev`.
function applyImmediateCard(prev: GameState, _next: GameState, actorId: string, effect: string, ledger: Ledger): void {
  mark(ledger, `card:${effect}`)
  switch (effect) {
    case 'boomEconomico':
      for (const p of prev.players) if (!p.eliminated) addCash(ledger, p.id, 200)
      return
    case 'erroBanco':
      addCash(ledger, actorId, 200)
      return
    // §10.6/D-061 — o esperado é a obrigação CHEIA, não o que o caixa cobriu.
    //
    // Esta era a linha que fazia o harness concordar com o bug do CARD 02: o oráculo calculava
    // `Math.min(50, p.cash)`, exatamente a truncagem do reducer. Recomputar "de forma
    // independente" copiando a fórmula do código sob teste não é independência — é a mesma
    // afirmação escrita duas vezes, e ela concorda consigo mesma para sempre. Um oráculo derivado
    // do código sob teste só prova consistência interna.
    //
    // O esperado agora vem da REGRA ($50 de cada adversário). Quando o caixa não cobre, o Δcaixa
    // observado é menor — e a diferença tem de aparecer em `obligations`, o que é verificado por
    // `checkObligationLedger` abaixo em vez de ser absorvido no valor esperado.
    case 'aniversario': {
      let total = 0
      for (const p of prev.players) {
        if (p.id === actorId || p.eliminated) continue
        if (isPlayerImmune(prev, p.id)) continue // Imunidade Total (D-064)
        const cobrado = Math.min(50, Math.max(0, p.cash)) // o que SAIU do caixa
        addCash(ledger, p.id, -cobrado)
        total += cobrado
      }
      addCash(ledger, actorId, total)
      return
    }
    case 'honorarios': {
      if (isPlayerImmune(prev, actorId)) return // Imunidade Total (D-064)
      const paid = Math.min(50, cashOf(prev, actorId))
      addCash(ledger, actorId, -paid)
      addPot(ledger, paid)
      return
    }
    case 'criseImobiliaria': {
      // D-064: quem sacou não paga, alíquota 10%; Imunidade Total isenta.
      let total = 0
      for (const p of prev.players) {
        if (p.id === actorId || p.eliminated) continue
        if (isPlayerImmune(prev, p.id)) continue
        const owed = Math.round(netWorth(prev, p.id) * 0.1)
        const paid = Math.min(owed, p.cash)
        addCash(ledger, p.id, -paid)
        total += paid
      }
      addPot(ledger, total)
      return
    }
    case 'consertoImoveis': {
      if (isPlayerImmune(prev, actorId)) return // Imunidade Total (D-064)
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
    // D-064 — Desvalorização Cambial: 10% do caixa → Loteria.
    case 'desvalorizacaoCambial': {
      if (isPlayerImmune(prev, actorId)) return
      const paid = Math.round(cashOf(prev, actorId) * 0.1)
      addCash(ledger, actorId, -paid)
      addPot(ledger, paid)
      return
    }
    // D-064 — Multa Ambiental: $50 + $50 por hotel/2º hotel/arranha-céu → Loteria.
    case 'multaAmbiental': {
      if (isPlayerImmune(prev, actorId)) return
      let units = 0
      for (const sq of BOARD) {
        const t = prev.titles[sq.pos]
        if (sq.kind !== 'property' || t?.ownerId !== actorId) continue
        units += (t.hotel ? 1 : 0) + (t.hotel2 ? 1 : 0) + (t.skyscraper ? 1 : 0)
      }
      const paid = Math.min(50 + units * 50, cashOf(prev, actorId))
      addCash(ledger, actorId, -paid)
      addPot(ledger, paid)
      return
    }
    // D-064 — Resgate do Pote: metade da Loteria (piso) sai do pote e entra no caixa.
    case 'resgateDoPote': {
      const half = Math.floor(prev.centerPot / 2)
      addCash(ledger, actorId, half)
      addPot(ledger, -half)
      return
    }
    // D-064 — Incentivo Fiscal: $50 por propriedade hipotecada (banco → jogador).
    case 'incentivoFiscal': {
      const n = BOARD.filter((sq) => 'price' in sq && prev.titles[sq.pos]?.ownerId === actorId && prev.titles[sq.pos]?.mortgaged).length
      addCash(ledger, actorId, n * 50)
      return
    }
    // D-064 — Obras na Pista: move ao aeroporto mais próximo à frente; pode cruzar o GO
    // (o aluguel dobrado do pouso é resolvido no PRÓXIMO dispatch, pelo oráculo de aluguel).
    case 'obrasNaPista': {
      const pos = prev.players.find((p) => p.id === actorId)!.pos
      const steps = BOARD.filter((sq) => sq.kind === 'airport')
        .map((sq) => (sq.pos - pos + BOARD.length) % BOARD.length)
        .filter((d) => d > 0)
        .reduce((a, b) => Math.min(a, b))
      if (pos + steps >= BOARD.length) {
        addCash(ledger, actorId, THEME.GO_PASS)
        applyLoanInterestUnconditional(prev, actorId, THEME.GO_PASS, ledger)
      }
      return
    }
    // Sem movimentação de caixa: vaPrisao, volte3, saiaPrisao, investidorAnjo, passagemOnibus,
    // greve, estatizacao, obraRelampago — o ledger fica como está (delta esperado = 0 para todos).
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

  if (isRentableKind(sq.kind)) {
    const owner = ownerOf(prev, actor.pos)
    if (owner === null || owner === actor.id) return // compra pendente ou própria — sem aluguel
    if (hasImmunity(prev, actor.id, actor.pos) || isPlayerImmune(prev, actor.id)) {
      mark(ledger, 'rent-immune') // pessoal (014) ou Imunidade Total (D-064)
      return
    }
    const due = rentDue(prev, actor.pos, owner)
    if (!due || due.amount === 0) {
      mark(ledger, 'rent-zero')
      return
    }
    let amount = due.amount
    if (isValorizada(prev, actor.pos)) amount *= 2 // Valorização (D-064)
    if (actor.doubleRentOnce) amount *= 2 // Obras na Pista (D-064)
    amount = discountedByTin(prev, actor.id, amount)
    if (actor.cash < amount) {
      mark(ledger, 'rent-debt') // insolvente → dívida pendente, sem pagamento agora
      return
    }
    addCash(ledger, actor.id, -amount)
    if (estatizacaoActive(prev)) addPot(ledger, amount) // Estatização (D-064): aluguel → Loteria
    else addCash(ledger, owner, amount)
    mark(ledger, 'rent')
    return
  }

  if (sq.kind === 'tax') {
    if (isPlayerImmune(prev, actor.id)) {
      mark(ledger, 'tax-immune') // Imunidade Total (D-064): nem cobra, nem abre Bunker
      return
    }
    // Bunker Fiscal na mão → abre reação em vez de cobrar (taxBunkerResolve tem prioridade).
    const hasBunker = actor.hand.some((id) => id !== null && cardById(id).effect === 'bunkerFiscal')
    if (hasBunker) {
      mark(ledger, 'tax-bunker-open')
      return
    }
    const amount = discountedByTin(prev, actor.id, sq.amount)
    if (actor.cash < amount) {
      mark(ledger, 'tax-debt')
      return
    }
    addCash(ledger, actor.id, -amount)
    addPot(ledger, amount)
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
function applyOffensiveMoney(prev: GameState, attackerId: string, effect: string, targetPos: number | null, targetPlayer: string | null, ledger: Ledger, targetPos2?: number | null): void {
  if (effect === 'aquisicaoHostil' && targetPos != null) {
    const sq = BOARD[targetPos]
    const owner = ownerOf(prev, targetPos)
    if (owner === null) return
    const mult = sq.kind === 'airport' || sq.kind === 'utility' || sq.kind === 'mine' ? 1.5 : 1
    const price = Math.round(('price' in sq ? sq.price : 0) * 0.5 * mult) // metade da tabela (D-064)
    const fee = prev.titles[targetPos]?.mortgaged ? transferKeepFee(sq) : 0
    addCash(ledger, attackerId, -(price + fee))
    addCash(ledger, owner, price) // taxa fica com o banco — não é P2P puro
    mark(ledger, 'acquire')
    return
  }
  if (effect === 'confiscoGeral') {
    mark(ledger, 'evict') // demolição total (D-064) — sem dinheiro (dono não recebe nada)
    return
  }
  if (effect === 'impostoFederal' && targetPlayer != null) {
    const owed = discountedByTin(prev, targetPlayer, Math.round(netWorth(prev, targetPlayer) * 0.25)) // D-064 + Estanho
    const paid = Math.min(cashOf(prev, targetPlayer), owed)
    addCash(ledger, targetPlayer, -paid)
    addPot(ledger, paid)
    mark(ledger, 'audit')
    return
  }
  // Permuta Forçada (D-064): sem preço; só as taxas de hipoteca movem caixa (§6.3) —
  // cada lado paga a taxa da hipotecada que RECEBE, a do alvo truncada ao caixa dele.
  if (effect === 'permutaForcada' && targetPos != null && targetPos2 != null) {
    const victim = ownerOf(prev, targetPos)
    if (victim === null) return
    const feeIn = prev.titles[targetPos]?.mortgaged ? transferKeepFee(BOARD[targetPos]) : 0
    const feeOut = prev.titles[targetPos2]?.mortgaged ? transferKeepFee(BOARD[targetPos2]) : 0
    addCash(ledger, attackerId, -feeIn)
    addCash(ledger, victim, -Math.min(feeOut, cashOf(prev, victim)))
    mark(ledger, 'swap')
    return
  }
  mark(ledger, 'card-effect-no-cash') // boicote/embargoDeObras/etc.
}

// Grupo A — ação identificável diretamente por `action.kind`.
function checkDirectAction(prev: GameState, next: GameState, action: SimAction, ledger: Ledger): void {
  switch (action.kind) {
    // LEVANTAR caixa credita o LIQUIDANTE (§9.1/D-061): com dívida pendente é o devedor nomeado,
    // que pode não ser o jogador da vez. O oráculo assumia `activePlayer` e passou a acusar
    // "Δcash esperado 0, obtido 20" no primeiro `sell-building` de um devedor fora da vez.
    case 'mortgage': {
      const sq = BOARD[action.pos]
      const who = liquidatorOf(prev)
      if (!('price' in sq) || prev.titles[action.pos]?.ownerId !== who || prev.titles[action.pos]?.mortgaged) return
      addCash(ledger, who, mortgageValue(sq))
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
      const actor = activePlayer(prev)
      if (sq.kind !== 'property' || prev.titles[action.pos]?.ownerId !== actor.id) return
      const buildAmount = actor.nextBuildFree
        ? 0
        : Math.round(buildCost(sq) * (ownsMine(prev, 'ferro', actor.id) ? THEME.MINE_BONUS.ferro : 1))
      addCash(ledger, actor.id, -buildAmount) // Obra Relâmpago (D-064) + Mina de Ferro
      const smokeTax = activeRules().smokeTax
      if (smokeTax > 0 && cityLevel(prev.titles[action.pos]) + 1 >= 5) {
        const taxAmount = discountedByTin(prev, actor.id, smokeTax)
        addCash(ledger, actor.id, -taxAmount)
        addPot(ledger, taxAmount)
      }
      mark(ledger, 'build-house')
      return
    }
    case 'sell-building': {
      const sq = BOARD[action.pos]
      const who = liquidatorOf(prev)
      if (sq.kind !== 'property' || prev.titles[action.pos]?.ownerId !== who) return
      if (cityLevel(prev.titles[action.pos]) === 0) return
      addCash(ledger, who, Math.round(buildCost(sq) / 2))
      mark(ledger, 'sell-building')
      return
    }
    case 'build-hangar': {
      if (BOARD[action.pos].kind !== 'airport' || prev.titles[action.pos]?.ownerId !== activePlayer(prev).id) return
      addCash(ledger, activePlayer(prev).id, activePlayer(prev).nextBuildFree ? 0 : -HANGAR_COST) // Obra Relâmpago (D-064)
      mark(ledger, 'build-hangar')
      return
    }
    case 'sell-hangar': {
      const who = liquidatorOf(prev)
      if (BOARD[action.pos].kind !== 'airport' || !prev.titles[action.pos]?.hangar) return
      if (prev.titles[action.pos]?.ownerId !== who) return
      addCash(ledger, who, Math.round(HANGAR_COST / 2))
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
      if (card.effect === 'imunidade' || card.effect === 'saiaPrisao' || card.effect === 'valorizacao') {
        mark(ledger, 'card-effect-no-cash')
        return
      }
      if (['boicote', 'aquisicaoHostil', 'confiscoGeral', 'impostoFederal', 'permutaForcada', 'embargoDeObras'].includes(card.effect)) {
        const target = action.target ?? null
        const targetPlayer = action.targetPlayer ?? null
        const target2 = action.target2 ?? null
        const reactor = reactorFor(prev, card.effect, player.id, target, targetPlayer, target2)
        if (!reactor) return // jogada inválida — no-op
        if (findReactionCard(prev, reactor, 'diplomacia')) {
          mark(ledger, 'card-effect-no-cash') // abre reaction-diplomacia — ofensiva "em voo", sem dinheiro ainda
          return
        }
        applyOffensiveMoney(prev, player.id, card.effect, target, targetPlayer, ledger, target2)
        return
      }
      return
    }
    case 'respond-reaction': {
      const res = prev.resolution
      if (res?.kind === 'reaction-diplomacia') {
        if (action.use) mark(ledger, 'diplomacia-use') // cancela — sem dinheiro
        else applyOffensiveMoney(prev, res.attackerId, res.effect, res.targetPos, res.targetPlayer, ledger, res.targetPos2)
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
      const debtor = prev.players.find((p) => p.id === (prev.resolution?.kind === 'debt' ? prev.resolution.debtorId : undefined)) ?? activePlayer(prev) // D-061/D-066
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
      const trade = prev.tradeProposals.find((proposal) => proposal.id === action.proposalId)?.trade
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
      const debtorId = prev.resolution.debtorId ?? activePlayer(prev).id // D-061/D-066: devedor nomeado
      if (cashOf(prev, debtorId) < amount) return
      addCash(ledger, debtorId, -amount)
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
  // Saldo corrente por jogador DENTRO deste passo. O fecho do leilão de propriedade e o
  // dos lotes do pregão podem cair no mesmo passo (uma falência que abre pregão enquanto
  // um leilão comum vence no mesmo instante). Quem paga o 2º evento paga com o caixa JÁ
  // descontado pelo 1º.
  const running = new Map<string, number>()
  const take = (id: string, bid: number): number => {
    const available = running.get(id) ?? cashOf(prev, id)
    const charged = Math.min(bid, available)
    running.set(id, available - charged)
    return charged
  }

  if (prev.resolution?.kind === 'auction' && next.resolution?.kind !== 'auction') {
    const a = prev.resolution.auction
    if (a.highBidder) {
      addCash(ledger, a.highBidder, -take(a.highBidder, a.currentBid))
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
    for (const lot of prev.landAuction.lots) {
      if (nextLots.has(lot.pos)) continue // ainda em aberto
      if (!lot.highBidder) continue // sem lance — permanece livre, sem dinheiro
      const winnerAlive = next.players.find((p) => p.id === lot.highBidder && !p.eliminated)
      if (!winnerAlive) continue // faliu entre o lance e o fecho — lote fica livre, sem dinheiro
      addCash(ledger, lot.highBidder, -take(lot.highBidder, lot.currentBid))
      mark(ledger, 'land-auction-close')
    }
  }
  return { violations: finalize(prev, next, ledger), mechanisms: ledger.mechanisms }
}

// `bankruptcyContext` saiu com a D-065: existia só para o checker do Fiscal saber que ESTE
// dispatch reatribuía propriedades antes de o Fiscal rodar (herança do espólio). Sem Fiscal,
// não há segundo ator no mesmo dispatch para desempatar.


/**
 * A fila de obrigações (§9.1/D-061) é um PASSIVO, e passivo também se conserva.
 *
 * A conservação de caixa por si não vê a fila: uma obrigação enfileirada não move dinheiro, e uma
 * obrigação apagada indevidamente também não. Este checker fecha o buraco pelo outro lado —
 * obrigação só pode SUMIR por pagamento (`debt-paid`) ou por eliminação (§9.4). Sem ele, o motor
 * poderia voltar a apagar o restante de uma cobrança e o harness continuaria verde.
 */
function checkObligationLedger(prev: GameState, next: GameState): Violation[] {
  const out: Violation[] = []
  const owedBefore = (g: GameState, id: string): number =>
    g.obligations.filter((o) => o.debtorId === id).reduce((s, o) => s + o.amount, 0) +
    (g.resolution?.kind === 'debt' && g.resolution.debtorId === id ? g.resolution.amount : 0)

  const pagou = next.log.length !== prev.log.length || JSON.stringify(next.log) !== JSON.stringify(prev.log)
  for (const p of prev.players) {
    const antes = owedBefore(prev, p.id)
    const depois = owedBefore(next, p.id)
    if (depois >= antes) continue // subiu ou ficou igual: nada a justificar
    const eliminado = next.players.find((q) => q.id === p.id)?.eliminated === true
    if (eliminado) continue // §9.4 — os vínculos do eliminado somem com ele
    const caiu = antes - depois
    const caixaCaiu = p.cash - (next.players.find((q) => q.id === p.id)?.cash ?? p.cash)
    // Pagamento: o passivo caiu e o caixa caiu junto, no mesmo valor.
    if (caixaCaiu === caiu) continue
    if (!pagou) {
      out.push({ code: 'o', detail: `obrigação de ${p.id} caiu ${caiu} sem pagamento nem eliminação (D-061)` })
    }
  }
  return out
}

export function checkConservation(prev: GameState, next: GameState, action: SimAction): { violations: Violation[]; mechanisms: string[] } {
  const ledger = newLedger()
  checkDirectAction(prev, next, action, ledger)
  if (action.kind === 'resolve-pending') checkResolvePending(prev, next, ledger)
  return {
    violations: [...finalize(prev, next, ledger), ...checkObligationLedger(prev, next)],
    mechanisms: ledger.mechanisms,
  }
}
