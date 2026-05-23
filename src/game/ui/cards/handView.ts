// Visões puras da mão (029) — para o painel "Minhas Cartas" e o seletor de alvo.
// NÃO muta nem inventa regra: deriva de `player.hand` + metadados de carta e reusa
// os critérios de validade do motor (`reactorFor`/`canAudit`/`ownerOf`). Testável sem UI.
import type { GameState } from '@/game/turn/types'
import type { Timing } from '@/game/cards/types'
import { BOARD } from '@/lib/boardData'
import { cardById } from '@/game/cards/catalog'
import { reactorFor } from '@/game/cards/reacao'
import { canAudit } from '@/game/cards/ofensivas'
import { ownerOf } from '@/game/economy/titles'
import { cardLabel, CARD_DESC, RARITY_COLOR } from './cardMeta'

export interface CardTargets {
  positions?: number[] // propriedades-alvo válidas
  players?: string[] // jogadores-alvo válidos
}

export interface HandCard {
  id: string
  effect: string
  label: string
  desc: string
  rarityColor: string
  timing: Timing | null
  needsTarget: boolean
  playable: boolean
  reason?: string
}

// Posições que são propriedade (cidade/aeroporto/utilidade) — alvos potenciais.
const PROP_POSITIONS = BOARD.filter((sq) => 'price' in sq).map((sq) => sq.pos)

function activeId(game: GameState): string {
  return game.players[game.turnOrder[game.activeSeat]].id
}

// Alvos válidos de uma carta de alvo; `null` se a carta não exige alvo.
// Reusa os mesmos gates que `playHandCard` aceita → zero divergência UI×motor.
export function cardTargets(game: GameState, playerId: string, cardId: string): CardTargets | null {
  const card = cardById(cardId)
  switch (card.effect) {
    case 'aquisicaoHostil':
      return { positions: PROP_POSITIONS.filter((pos) => reactorFor(game, 'aquisicaoHostil', playerId, pos, null) !== null) }
    case 'despejo':
      return { positions: PROP_POSITIONS.filter((pos) => reactorFor(game, 'despejo', playerId, pos, null) !== null) }
    case 'boicote':
      return { positions: PROP_POSITIONS.filter((pos) => reactorFor(game, 'boicote', playerId, pos, null) !== null) }
    case 'auditoriaFiscal':
      return { players: game.players.filter((p) => canAudit(game, playerId, p.id)).map((p) => p.id) }
    case 'imunidade':
      return { positions: PROP_POSITIONS.filter((pos) => ownerOf(game, pos) === playerId) }
    default:
      return null // carta sem alvo
  }
}

function targetsEmpty(t: CardTargets): boolean {
  return (t.positions?.length ?? 0) === 0 && (t.players?.length ?? 0) === 0
}

// A mão do jogador como cartões apresentáveis + se cada um é jogável agora (e por quê não).
export function handCardsView(game: GameState, playerId: string): HandCard[] {
  const player = game.players.find((p) => p.id === playerId)
  if (!player) return []
  const isActive = activeId(game) === playerId
  return player.hand.map((id) => {
    const card = cardById(id)
    const targets = cardTargets(game, playerId, id)
    const needsTarget = targets !== null
    let playable = true
    let reason: string | undefined
    if (card.timing === 'reacao') {
      playable = false
      reason = 'Carta de reação — usada automaticamente quando aplicável'
    } else if (card.timing === 'proprio-turno' && !isActive) {
      playable = false
      reason = 'Só no seu turno'
    } else if (card.timing === 'preso' && !player.jail.inJail) {
      playable = false
      reason = 'Só quando preso'
    } else if (needsTarget && targetsEmpty(targets!)) {
      playable = false
      reason = 'Sem alvo válido'
    }
    return {
      id,
      effect: card.effect,
      label: cardLabel(card.effect),
      desc: CARD_DESC[card.effect] ?? 'Carta sorteada.',
      rarityColor: RARITY_COLOR[card.rarity],
      timing: card.timing,
      needsTarget,
      playable,
      reason,
    }
  })
}
