// Seletor puro da UI de modais centrais (022). Deriva, do estado do jogo, QUAL
// modal central exibir e COM QUAIS dados — sem efeito, sem mutação. Fonte única
// consumida pelo ModalLayer (renderizar) e pelo GameHUD (esconder os ramos cobertos).
import type { GameState } from '@/game/turn/types'
import type { Square } from '@/lib/boardData'
import { BOARD } from '@/lib/boardData'
import type { Rarity, DeckId, CardMode } from '@/game/cards/types'
import { cardById } from '@/game/cards/catalog'

export interface HandCardView {
  id: string // id da carta na mão — alvo do comando discardCard
  rarity: Rarity // laranja/azul/verde (SRS §10.2) — cor no descarte
  effect: string // EffectId — base do rótulo legível (mapa de apresentação no ModalLayer)
}

export type ModalView =
  // compra NÃO é mais modal — vira ação inline embaixo dos dados (DiceArena)
  | { kind: 'auction'; pos: number; square: Square; currentBid: number; highBidder: string | null; deadline: number }
  | { kind: 'card-discard'; playerId: string; cards: HandCardView[] }
  | { kind: 'card-shortcut' }
  | { kind: 'card-reveal'; deckId: DeckId; cardId: string; rarity: Rarity; effect: string; mode: CardMode }
  // Escolhas do Speed Die (turn.awaitingChoice) — também decisões centrais (022.1)
  | { kind: 'bus-move'; pos: number; white: [number, number]; playerId: string }
  | { kind: 'triple-dest'; pos: number; playerId: string }

// Jogador da vez (mesma convenção do resto da UI/motor).
function activeId(game: GameState): string {
  return game.players[game.turnOrder[game.activeSeat]].id
}

function activePos(game: GameState): number {
  return game.players[game.turnOrder[game.activeSeat]].pos
}

// Estado → descritor do modal central ativo (ou null = nenhum). Puro e determinístico.
export function activeModal(game: GameState): ModalView | null {
  const res = game.resolution
  if (!res) {
    // Prisão NÃO é modal — a decisão aparece inline embaixo dos dados (DiceArena).
    // Sem resolução: pode haver escolha de Speed Die pendente (Ônibus/Triple).
    const t = game.turn
    if (t.awaitingChoice === 'onibus' && t.lastRoll) {
      return { kind: 'bus-move', pos: activePos(game), white: t.lastRoll.white, playerId: activeId(game) }
    }
    if (t.awaitingChoice === 'triple') {
      return { kind: 'triple-dest', pos: activePos(game), playerId: activeId(game) }
    }
    return null
  }
  switch (res.kind) {
    // 'purchase': sem modal — a decisão de compra aparece inline na DiceArena.
    case 'auction': {
      const a = res.auction
      return { kind: 'auction', pos: a.pos, square: BOARD[a.pos], currentBid: a.currentBid, highBidder: a.highBidder, deadline: a.deadline }
    }
    case 'card-discard': {
      const id = activeId(game)
      const player = game.players.find((p) => p.id === id)!
      const cards: HandCardView[] = player.hand.map((cid) => {
        const c = cardById(cid)
        return { id: cid, rarity: c.rarity, effect: c.effect }
      })
      return { kind: 'card-discard', playerId: id, cards }
    }
    case 'card-shortcut':
      return { kind: 'card-shortcut' }
    case 'card-reveal': {
      const c = cardById(res.cardId)
      return { kind: 'card-reveal', deckId: res.deckId, cardId: res.cardId, rarity: c.rarity, effect: c.effect, mode: c.mode }
    }
    // debt, reaction-diplomacia, reaction-bunker: seguem na barra do HUD (022 fora de escopo)
    default:
      return null
  }
}
