import { describe, it, expect } from 'vitest'
import { activeModal } from '@/game/ui/modals/activeModal'
import { createSeedState } from '@/game/store'
import { BOARD } from '@/lib/boardData'
import type { GameState } from '@/game/turn/types'

// Estado base: p1 é o jogador da vez (activeSeat 0).
function base(): GameState {
  return createSeedState(['p1', 'p2'])
}

describe('activeModal — compra e caso "nenhum" (US1)', () => {
  it('SC-001: purchase → descritor com pos/square/price/playerId', () => {
    const g = base()
    g.resolution = { kind: 'purchase', pos: 1 } // Roma, preço 60
    expect(activeModal(g)).toEqual({
      kind: 'purchase',
      pos: 1,
      square: BOARD[1],
      price: 60,
      playerId: 'p1',
    })
  })

  it('SC-004: sem resolução coberta → null', () => {
    const g = base()
    expect(activeModal(g)).toBeNull() // resolution null no seed
    g.resolution = { kind: 'debt', amount: 100, creditorId: 'p2' }
    expect(activeModal(g)).toBeNull()
    g.resolution = { kind: 'reaction-bunker', reactorId: 'p1', amount: 50 }
    expect(activeModal(g)).toBeNull()
  })
})

describe('activeModal — leilão (US2)', () => {
  it('SC-001: auction → item/lance/licitante/prazo', () => {
    const g = base()
    g.resolution = {
      kind: 'auction',
      auction: { pos: 3, currentBid: 150, highBidder: 'p2', activeBidders: ['p1', 'p2'], deadline: 9999 },
    }
    expect(activeModal(g)).toEqual({
      kind: 'auction',
      pos: 3,
      square: BOARD[3],
      currentBid: 150,
      highBidder: 'p2',
      deadline: 9999,
    })
  })

  it('SC-001: house-auction → housesAvailable, sem propriedade', () => {
    const g = base()
    g.resolution = {
      kind: 'house-auction',
      auction: { housesAvailable: 2, currentBid: 0, highBidder: null, activeBidders: ['p1', 'p2'], deadline: 8888 },
    }
    expect(activeModal(g)).toEqual({
      kind: 'house-auction',
      housesAvailable: 2,
      currentBid: 0,
      highBidder: null,
      deadline: 8888,
    })
  })
})

describe('activeModal — decisões de carta (US3)', () => {
  it('SC-003: card-discard → mão do jogador DA VEZ (ids/rarity/effect), nunca a do adversário', () => {
    const g = base()
    g.players[0].hand = ['boicote-1', 'atalho-1', 'aquisicao-hostil-1', 'imunidade-1'] // p1 (da vez)
    g.players[1].hand = ['despejo-1'] // p2 — não pode aparecer
    g.resolution = { kind: 'card-discard', deckId: 'acaso', drawnId: 'imunidade-1' }
    const view = activeModal(g)
    expect(view).toEqual({
      kind: 'card-discard',
      playerId: 'p1',
      cards: [
        { id: 'boicote-1', rarity: 'rara', effect: 'boicote' },
        { id: 'atalho-1', rarity: 'comum', effect: 'atalho' },
        { id: 'aquisicao-hostil-1', rarity: 'lendaria', effect: 'aquisicaoHostil' },
        { id: 'imunidade-1', rarity: 'lendaria', effect: 'imunidade' },
      ],
    })
    // privacidade: nenhuma carta de p2 vaza
    expect(view?.kind === 'card-discard' && view.cards.some((c) => c.id === 'despejo-1')).toBe(false)
  })

  it('card-shortcut → { kind: card-shortcut }', () => {
    const g = base()
    g.resolution = { kind: 'card-shortcut', deckId: 'acaso', cardId: 'atalho-1' }
    expect(activeModal(g)).toEqual({ kind: 'card-shortcut' })
  })
})

describe('activeModal — escolhas do Speed Die (022.1)', () => {
  it('Ônibus pendente → bus-move com white e pos do jogador da vez', () => {
    const g = base()
    g.players[0].pos = 5
    g.turn.awaitingChoice = 'onibus'
    g.turn.lastRoll = { white: [3, 5], speed: 'onibus', isDouble: false, move: 8, special: 'onibus' }
    expect(activeModal(g)).toEqual({ kind: 'bus-move', pos: 5, white: [3, 5], playerId: 'p1' })
  })

  it('Triple pendente → triple-dest com pos do jogador da vez', () => {
    const g = base()
    g.players[0].pos = 10
    g.turn.awaitingChoice = 'triple'
    g.turn.lastRoll = { white: [3, 3], speed: 3, isDouble: true, move: 9, special: 'triple' }
    expect(activeModal(g)).toEqual({ kind: 'triple-dest', pos: 10, playerId: 'p1' })
  })

  it('awaitingChoice null e sem resolução → null', () => {
    const g = base()
    g.turn.awaitingChoice = null
    expect(activeModal(g)).toBeNull()
  })
})
