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

// 043, D-037/T038: `player.hand`/`res.cardId` agora podem carregar slot OCULTO (`null`). Este
// seletor roda para TODO participante (inclusive quem não decide — `ModalLayer` só renderiza
// o conteúdo para quem `mayAct`, os demais veem um `WaitingBar` sem detalhe nenhum), então
// precisa devolver algo sem estourar mesmo quando a carta não é visível aqui. Nenhum `if
// (multiplayer)` novo: o `null` já é tratado pelo tipo, não por um ramo de modo de jogo.

export type ModalView =
  // compra NÃO é mais modal — vira ação inline embaixo dos dados (DiceArena)
  | {
      kind: 'auction'
      pos: number
      square: Square
      currentBid: number
      highBidder: string | null
      deadline: number
      /**
       * Quem ainda pode dar lance (`auction.ts:26` recusa quem não está aqui). Faltava na
       * view, então a UI estruturalmente NÃO conseguia saber se o assento local já havia
       * passado — e renderizava três botões de lance que o motor descartava em silêncio.
       */
      activeBidders: readonly string[]
    }
  | { kind: 'card-discard'; playerId: string; cards: HandCardView[] }
  | { kind: 'card-shortcut' }
  // `cardId`/`rarity`/`effect`/`mode` são `null` juntos quando o slot é oculto nesta
  // perspectiva (bystander) — `ModalLayer` nunca renderiza o conteúdo nesse caso (`mineModal`
  // já filtra por `mayAct`), então isto só precisa não estourar, não ficar bonito.
  | { kind: 'card-reveal'; deckId: DeckId; cardId: string | null; rarity: Rarity | null; effect: string | null; mode: CardMode | null }
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
      return {
        kind: 'auction', pos: a.pos, square: BOARD[a.pos],
        currentBid: a.currentBid, highBidder: a.highBidder, deadline: a.deadline,
        activeBidders: a.activeBidders,
      }
    }
    case 'card-discard': {
      const id = activeId(game)
      const player = game.players.find((p) => p.id === id)!
      // Slots ocultos não entram na lista — o descarte só é MEU modal quando é minha mão
      // (`mayAct`), e nela nunca há oculto; num bystander (que nunca renderiza isto) o filtro
      // só evita o `cardById(null)`.
      const cards: HandCardView[] = player.hand
        .filter((cid) => cid !== null)
        .map((cid) => {
          const c = cardById(cid)
          return { id: cid, rarity: c.rarity, effect: c.effect }
        })
      return { kind: 'card-discard', playerId: id, cards }
    }
    case 'card-shortcut':
      return { kind: 'card-shortcut' }
    case 'card-reveal': {
      if (res.cardId === null) {
        return { kind: 'card-reveal', deckId: res.deckId, cardId: null, rarity: null, effect: null, mode: null }
      }
      const c = cardById(res.cardId)
      return { kind: 'card-reveal', deckId: res.deckId, cardId: res.cardId, rarity: c.rarity, effect: c.effect, mode: c.mode }
    }
    // debt, reaction-diplomacia, reaction-bunker: seguem na barra do HUD (022 fora de escopo)
    default:
      return null
  }
}
