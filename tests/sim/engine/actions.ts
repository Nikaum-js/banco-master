// Enumeração de ações válidas por DECISOR (036/D4) — não por "jogador da vez": leilões,
// trocas, empréstimos e reações podem exigir resposta de um jogador que não é o ativo.
import { BOARD } from '@/lib/boardData'
import type { GameState, Player } from '@/game/turn/types'
import { activePlayer } from '@/game/turn/turnMachine'
import { canBuildHouse, canSellBuilding, canBuildHangar, canSellHangar } from '@/game/economy/construction'
import { canMortgage, canUnmortgage } from '@/game/economy/mortgage'
import { ownerOf } from '@/game/economy/titles'
import { tradableProps, validateTrade, type Trade } from '@/game/economy/trade'
import { committedCash } from '@/game/economy/landAuction'
import { activeLoanFor } from '@/game/emprestimos/emprestimos'
import { cardById } from '@/game/cards/catalog'
import { reactorFor } from '@/game/cards/reacao'
import { JAIL_FINE, sideOf } from '@/game/turn/turnMachine'
import type { SimSession } from './driver'
import type { DecisionPoint, SimAction } from './types'

const BOARD_SIZE = BOARD.length

// Destinos válidos para Bus Ticket: mesmo lado, exceto a posição atual (009/034).
function sameSideDestinations(pos: number): number[] {
  const side = sideOf(pos)
  if (side === null) return []
  const out: number[] = []
  for (let p = 0; p < BOARD_SIZE; p++) {
    if (p !== pos && sideOf(p) === side) out.push(p)
  }
  return out
}

function handCardActions(game: GameState, active: Player): SimAction[] {
  const out: SimAction[] = []
  for (const cardId of active.hand) {
    const card = cardById(cardId)
    if (card.mode !== 'mao') continue
    if (card.timing === 'reacao') continue // só via respond-reaction, nunca jogada proativamente
    if (card.timing === 'preso' && !active.jail.inJail) continue
    if (card.effect === 'imunidade') {
      for (const sq of BOARD) {
        if ('price' in sq && ownerOf(game, sq.pos) === active.id) out.push({ kind: 'play-hand-card', cardId, target: sq.pos })
      }
      continue
    }
    if (card.effect === 'boicote' || card.effect === 'aquisicaoHostil' || card.effect === 'despejo') {
      for (const sq of BOARD) {
        if (!('price' in sq)) continue
        if (reactorFor(game, card.effect, active.id, sq.pos, null)) out.push({ kind: 'play-hand-card', cardId, target: sq.pos })
      }
      continue
    }
    if (card.effect === 'auditoriaFiscal') {
      for (const p of game.players) {
        if (p.id === active.id || p.eliminated) continue
        if (reactorFor(game, 'auditoriaFiscal', active.id, null, p.id)) out.push({ kind: 'play-hand-card', cardId, targetPlayer: p.id })
      }
      continue
    }
    out.push({ kind: 'play-hand-card', cardId }) // efeitos sem alvo (ex.: saia-prisao)
  }
  return out
}

// Propostas de troca sempre VÁLIDAS pelos gates (024) — trivial (vazia) e com 1 propriedade
// negociável do proponente. Cobertura básica de US1 cenário de troca sob fuzzing.
function candidateTrades(game: GameState): { fromId: string; trade: Trade }[] {
  const alive = game.players.filter((p) => !p.eliminated)
  const out: { fromId: string; trade: Trade }[] = []
  for (const from of alive) {
    const tradable = tradableProps(game, from.id)
    for (const to of alive) {
      if (from.id === to.id) continue
      const empty: Trade = { fromId: from.id, toId: to.id, fromProps: [], fromCash: 0, toProps: [], toCash: 0 }
      if (validateTrade(game, empty)) out.push({ fromId: from.id, trade: empty })
      if (tradable.length > 0) {
        const withProp: Trade = { ...empty, fromProps: [tradable[0]] }
        if (validateTrade(game, withProp)) out.push({ fromId: from.id, trade: withProp })
      }
    }
  }
  return out
}

// Construção/hipoteca disponíveis para o jogador ativo — reusado tanto no turno livre
// quanto na janela de dívida (§9.1: liquidar via 004/005 antes de pagar/falir).
// Pré-filtra por posse (checagem O(1)) antes de chamar os predicados `canX` — cada um
// deles reescaneia o BOARD internamente (ownedGroupCities/groupHasConstruction); com 6
// jogadores e centenas de milhares de ticks, repetir isso para as ~44 posições que o
// jogador ativo NÃO possui era o maior custo do harness (perf, research.md D8).
function propertyActions(game: GameState): SimAction[] {
  const activeId = activePlayer(game).id
  const out: SimAction[] = []
  for (const sq of BOARD) {
    const title = game.titles[sq.pos]
    if (!title || title.ownerId !== activeId) continue
    if (sq.kind === 'property') {
      if (canBuildHouse(game, sq.pos)) out.push({ kind: 'build-house', pos: sq.pos })
      if (canSellBuilding(game, sq.pos)) out.push({ kind: 'sell-building', pos: sq.pos })
    }
    if (sq.kind === 'airport') {
      if (canBuildHangar(game, sq.pos)) out.push({ kind: 'build-hangar', pos: sq.pos })
      if (canSellHangar(game, sq.pos)) out.push({ kind: 'sell-hangar', pos: sq.pos })
    }
    if (sq.kind === 'property' || sq.kind === 'airport' || sq.kind === 'utility') {
      if (!title.mortgaged && canMortgage(game, sq.pos)) out.push({ kind: 'mortgage', pos: sq.pos })
      if (title.mortgaged && canUnmortgage(game, sq.pos)) out.push({ kind: 'unmortgage', pos: sq.pos })
    }
  }
  return out
}

function turnActionsFor(session: SimSession, active: Player): SimAction[] {
  const game = session.game
  const turn = game.turn
  const out: SimAction[] = []

  if (turn.awaitingChoice === 'onibus') {
    return [{ kind: 'choose-bus-move', opt: 'die0' }, { kind: 'choose-bus-move', opt: 'die1' }, { kind: 'choose-bus-move', opt: 'sum' }]
  }
  if (turn.awaitingChoice === 'triple') {
    const dests = new Set([0, 12, 24, 36, active.pos])
    return [...dests].map((dest) => ({ kind: 'choose-triple-dest' as const, dest }))
  }
  if (turn.state === 'prisao-decisao') {
    out.push({ kind: 'jail-decision', decision: 'try' })
    if (active.cash >= JAIL_FINE) out.push({ kind: 'jail-decision', decision: 'pay' })
    out.push({ kind: 'jail-decision', decision: 'card' }) // no-op seguro se não houver a carta
    out.push(...handCardActions(game, active)) // "Saia da Prisão" (timing='preso')
    return out
  }
  if (turn.state === 'aguardando-rolagem') {
    out.push({ kind: 'roll' })
    if (active.busTickets > 0) for (const dest of sameSideDestinations(active.pos)) out.push({ kind: 'use-bus-ticket', dest })
    return out
  }
  if (turn.state === 'casa-a-resolver' && !turn.awaitingChoice) {
    return [{ kind: 'resolve-pending' }]
  }
  if (turn.state === 'aguardando-finalizacao') {
    out.push({ kind: 'finalize' })
    if (active.busTickets > 0) for (const dest of sameSideDestinations(active.pos)) out.push({ kind: 'use-bus-ticket', dest }) // 034
    out.push(...propertyActions(game))
    out.push(...handCardActions(game, active))
    const loan = activeLoanFor(game, active.id)
    if (loan && active.cash >= loan.principal) out.push({ kind: 'pay-off-loan' })
    return out
  }
  return out // 'encerrado' é transitório (finishIfEnded já resolve antes do agente ver)
}

// Prioridade (D4): 1) resolução bloqueante → 2) turno livre do jogador ativo + oportunistas
// fora-de-turno. Quando há bloqueio, retorna SÓ os pontos obrigatórios (nada mais pode
// acontecer até serem respondidos).
export function enumerateActions(session: SimSession): DecisionPoint[] {
  const game = session.game
  const res = game.resolution
  const points: DecisionPoint[] = []

  if (res?.kind === 'debt') {
    const debtorId = activePlayer(game).id
    const debtor = game.players.find((p) => p.id === debtorId)!
    const actions: SimAction[] = [{ kind: 'declare-bankruptcy' }, ...propertyActions(game)] // §9.1: liquidar (004/005) antes de pagar/falir
    if (debtor.cash >= res.amount) actions.push({ kind: 'pay-debt' })
    if (!game.pendingLoan) {
      const principal = res.amount - debtor.cash
      for (const creditor of game.players) {
        if (creditor.id === debtorId || creditor.eliminated) continue
        if (principal > 0 && principal <= creditor.cash) actions.push({ kind: 'propose-loan', creditorId: creditor.id })
      }
    }
    points.push({ actorId: debtorId, mandatory: true, actions })
  } else if (game.pendingLoan) {
    const req = game.pendingLoan
    const actions: SimAction[] = [{ kind: 'respond-loan', accept: false, ratePct: 10 }]
    for (const ratePct of [10, 25, 50]) actions.push({ kind: 'respond-loan', accept: true, ratePct })
    points.push({ actorId: req.creditorId, mandatory: true, actions })
  } else if (res?.kind === 'purchase') {
    const actions: SimAction[] = [{ kind: 'decline-property' }]
    actions.push({ kind: 'buy-property' }) // no-op seguro se sem caixa
    points.push({ actorId: activePlayer(game).id, mandatory: true, actions })
  } else if (res?.kind === 'auction') {
    for (const bidderId of res.auction.activeBidders) {
      const cash = game.players.find((p) => p.id === bidderId)?.cash ?? 0
      const actions: SimAction[] = [{ kind: 'pass-bid', playerId: bidderId }]
      if (cash > res.auction.currentBid) actions.push({ kind: 'place-bid', playerId: bidderId, amount: res.auction.currentBid + 1 })
      points.push({ actorId: bidderId, mandatory: true, actions })
    }
  } else if (res?.kind === 'card-discard') {
    const p = activePlayer(game)
    points.push({ actorId: p.id, mandatory: true, actions: p.hand.map((cardId) => ({ kind: 'discard-card' as const, cardId })) })
  } else if (res?.kind === 'card-shortcut') {
    points.push({
      actorId: activePlayer(game).id,
      mandatory: true,
      actions: [{ kind: 'choose-card-shortcut', dir: 'frente' }, { kind: 'choose-card-shortcut', dir: 'tras' }],
    })
  } else if (res?.kind === 'card-reveal') {
    points.push({ actorId: activePlayer(game).id, mandatory: true, actions: [{ kind: 'confirm-card-reveal' }] })
  } else if (res?.kind === 'reaction-diplomacia' || res?.kind === 'reaction-bunker') {
    points.push({ actorId: res.reactorId, mandatory: true, actions: [{ kind: 'respond-reaction', use: true }, { kind: 'respond-reaction', use: false }] })
  }

  if (points.length > 0) return points // bloqueio ativo — nada mais pode acontecer agora

  const active = activePlayer(game)
  const turnActions = turnActionsFor(session, active)
  if (turnActions.length > 0) points.push({ actorId: active.id, mandatory: true, actions: turnActions })

  if (game.pendingTrade) {
    points.push({ actorId: game.pendingTrade.toId, mandatory: false, actions: [{ kind: 'accept-trade' }, { kind: 'reject-trade' }] })
  } else {
    for (const { fromId, trade } of candidateTrades(game)) {
      points.push({ actorId: fromId, mandatory: false, actions: [{ kind: 'propose-trade', trade }] })
    }
  }

  if (game.landAuction) {
    for (const lot of game.landAuction.lots) {
      for (const bidderId of game.landAuction.bidders) {
        const bidder = game.players.find((p) => p.id === bidderId)
        if (!bidder || bidder.eliminated) continue // faliu depois da abertura do lote (evento autônomo)
        const cash = bidder.cash
        const amount = lot.currentBid + 1
        if (committedCash(game, bidderId, lot.pos) + amount <= cash) {
          points.push({ actorId: bidderId, mandatory: false, actions: [{ kind: 'place-land-bid', playerId: bidderId, pos: lot.pos, amount }] })
        }
      }
    }
  }

  return points
}
