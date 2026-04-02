// Saque e uso de cartas. cardResolve preenche a porta de resolução de acaso/tesouro (002).
import type { ResolveCtx, ResolutionOutcome, TurnPorts } from '../turn/resolution'
import type { GameState } from '../turn/types'
import type { DeckId } from './types'
import { cardById } from './catalog'
import { applyEffect } from './effects'
import { activePlayer, completeResolution, advance, BOARD_SIZE } from '../turn/turnMachine'
import { ownerOf } from '../economy/titles'
import { addTempEffect } from '../economy/tempEffects'
import { reactorFor, findReactionCard, applyOffensive } from './reacao'

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
// `target` (posição) é exigido pelas cartas de mão com alvo: Boicote / Imunidade Temporária (015).
export function playHandCard(
  state: GameState,
  playerId: string,
  cardId: string,
  ports: TurnPorts,
  target?: number,
  targetPlayer?: string,
): GameState {
  const player = state.players.find((p) => p.id === playerId)
  if (!player || !player.hand.includes(cardId)) return state
  const card = cardById(cardId)
  if (card.mode !== 'mao') return state
  const isActive = activePlayer(state).id === playerId
  if (card.timing === 'proprio-turno' && !isActive) return state
  if (card.timing === 'preso' && !player.jail.inJail) return state
  if (card.timing === 'reacao') return state // reação deferida (FR-013)

  // Imunidade Temporária (015, §10.6) — proteção de alvo sobre propriedade PRÓPRIA.
  if (card.effect === 'imunidade') {
    if (target == null || ownerOf(state, target) !== playerId) return state
    const s = structuredClone(state)
    addTempEffect(s, { kind: 'imunidade-temp', ownerId: playerId, pos: target, lapsRemaining: 2 })
    return discardPlayed(s, playerId, cardId, card.deck)
  }
  // Ofensivas com alvo (015 Boicote / 016 Aquisição/Despejo/Auditoria). Se o alvo tem Diplomacia,
  // abre uma reação (017) em vez de aplicar; senão aplica direto. No-op se a jogada for inválida.
  if (card.effect === 'boicote' || card.effect === 'aquisicaoHostil' || card.effect === 'despejo' || card.effect === 'auditoriaFiscal') {
    const reactor = reactorFor(state, card.effect, playerId, target ?? null, targetPlayer ?? null)
    if (!reactor) return state // jogada inválida → no-op
    if (findReactionCard(state, reactor, 'diplomacia')) {
      const s = structuredClone(state)
      const me = s.players.find((p) => p.id === playerId)!
      me.hand = me.hand.filter((h) => h !== cardId) // ofensiva "em voo" (sai da mão do atacante)
      s.resolution = {
        kind: 'reaction-diplomacia',
        reactorId: reactor,
        attackerId: playerId,
        effect: card.effect,
        cardId,
        deck: card.deck,
        targetPos: target ?? null,
        targetPlayer: targetPlayer ?? null,
      }
      return s
    }
    const s = structuredClone(state)
    applyOffensive(s, card.effect, playerId, target ?? null, targetPlayer ?? null, ports)
    return discardPlayed(s, playerId, cardId, card.deck)
  }

  const s = structuredClone(state)
  applyEffect(card.effect, s, playerId, ports)
  return discardPlayed(s, playerId, cardId, card.deck)
}

// Remove a carta jogada da mão e recicla ao fundo do deck.
function discardPlayed(s: GameState, playerId: string, cardId: string, deck: DeckId): GameState {
  const p = s.players.find((x) => x.id === playerId)!
  p.hand = p.hand.filter((h) => h !== cardId)
  s.decks[deck].push(cardId)
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
  if (dir === 'frente') advance(s, player, 3, ports)
  else player.pos = (player.pos - 3 + BOARD_SIZE) % BOARD_SIZE
  s.decks[deckId].push(cardId)
  completeResolution(s)
  return s
}
