// Saque e uso de cartas. cardResolve preenche a porta de resolução de acaso/tesouro (002).
import type { ResolveCtx, ResolutionOutcome, TurnPorts } from '../turn/resolution'
import type { GameState } from '../turn/types'
import type { DeckId } from './types'
import { cardById } from './catalog'
import { applyEffect } from './effects'
import { activePlayer, completeResolution, advance, BOARD_SIZE } from '../turn/turnMachine'

// Resolver de carta — composto com o economyResolve no ctx.resolve do store.
export function cardResolve(rctx: ResolveCtx): ResolutionOutcome | null {
  const { square, state, playerId, ports } = rctx
  if (square.kind !== 'acaso' && square.kind !== 'tesouro') return null
  const deckId: DeckId = square.kind
  const id = state.decks[deckId].shift()
  if (!id) return { done: true } // nunca esgota na prática (imediatas reciclam)
  const card = cardById(id)

  if (card.mode === 'mao') {
    const player = state.players.find((p) => p.id === playerId)!
    player.hand.push(id) // sai do deck, entra na mão
    if (player.hand.length > 3) {
      state.resolution = { kind: 'card-discard', deckId, drawnId: id } // 4ª → descarte forçado
      return { done: false, blocksFinalize: true }
    }
    return { done: true }
  }

  // imediato
  if (card.effect === 'atalho') {
    state.resolution = { kind: 'card-shortcut', deckId, cardId: id } // escolha ±3
    return { done: false, blocksFinalize: true }
  }
  applyEffect(card.effect, state, playerId, ports)
  state.decks[deckId].push(id) // volta ao fundo
  return { done: true }
}

// Jogar carta de mão respeitando a janela de timing. Puro; no-op fora da janela.
export function playHandCard(state: GameState, playerId: string, cardId: string, ports: TurnPorts): GameState {
  const player = state.players.find((p) => p.id === playerId)
  if (!player || !player.hand.includes(cardId)) return state
  const card = cardById(cardId)
  if (card.mode !== 'mao') return state
  const isActive = activePlayer(state).id === playerId
  if (card.timing === 'proprio-turno' && !isActive) return state
  if (card.timing === 'preso' && !player.jail.inJail) return state
  if (card.timing === 'reacao') return state // reação deferida (FR-013)
  const s = structuredClone(state)
  applyEffect(card.effect, s, playerId, ports)
  const p = s.players.find((x) => x.id === playerId)!
  p.hand = p.hand.filter((h) => h !== cardId)
  s.decks[card.deck].push(cardId) // volta ao fundo
  return s
}

// Conclui o descarte forçado (mão cheia): a carta escolhida vai ao fundo.
export function resolveCardDiscard(state: GameState, cardId: string): GameState {
  if (state.resolution?.kind !== 'card-discard') return state
  if (!activePlayer(state).hand.includes(cardId)) return state
  const s = structuredClone(state)
  const player = activePlayer(s)
  player.hand = player.hand.filter((h) => h !== cardId)
  s.decks[cardById(cardId).deck].push(cardId)
  completeResolution(s)
  return s
}

// Conclui o Atalho: move ±3 (sem auto-resolver destino — simplificação 006) e recicla a carta.
export function resolveCardShortcut(state: GameState, dir: 'frente' | 'tras', ports: TurnPorts): GameState {
  if (state.resolution?.kind !== 'card-shortcut') return state
  const { deckId, cardId } = state.resolution
  const s = structuredClone(state)
  const player = activePlayer(s)
  if (dir === 'frente') advance(player, 3, ports)
  else player.pos = (player.pos - 3 + BOARD_SIZE) % BOARD_SIZE
  s.decks[deckId].push(cardId)
  completeResolution(s)
  return s
}
