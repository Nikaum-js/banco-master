import { describe, it, expect } from 'vitest'
import { cardRevealResolve, confirmCardReveal } from '@/game/cards/draw'
import { activeModal } from '@/game/ui/modals/activeModal'
import { createSeedState, defaultPorts } from '@/game/store'
import { BOARD } from '@/lib/boardData'
import type { GameState } from '@/game/turn/types'

// pos 8 = Acaso, pos 2 = Tesouro.
function onCard(deckId: 'acaso' | 'tesouro', top: string[], pos: number): GameState {
  const g = createSeedState(['p1', 'p2'])
  g.players[0].pos = pos
  g.decks[deckId] = [...top]
  g.turn.state = 'casa-a-resolver'
  g.turn.pendingResolve = true
  return g
}

const rctx = (g: GameState, pos: number) => ({
  playerId: 'p1',
  square: BOARD[pos],
  roll: null,
  ports: defaultPorts,
  state: g,
})

describe('cardRevealResolve — peek + pausa (US1)', () => {
  it('SC-001: seta card-reveal com o topo, sem mutar deck/mão', () => {
    const g = onCard('acaso', ['atalho-1', 'apagao-1'], 8)
    const out = cardRevealResolve(rctx(g, 8))
    expect(out).toEqual({ done: false, blocksFinalize: true })
    expect(g.resolution).toEqual({ kind: 'card-reveal', deckId: 'acaso', cardId: 'atalho-1' })
    expect(g.decks.acaso).toEqual(['atalho-1', 'apagao-1']) // deck intacto
    expect(g.players[0].hand).toEqual([]) // mão intacta
  })
})

describe('confirmCardReveal — saca e processa (US1)', () => {
  it('SC-002: carta imediata aplica o efeito, saca do deck e finaliza', () => {
    const g = onCard('tesouro', ['erro-banco-1', 'aniversario-1'], 2)
    g.resolution = { kind: 'card-reveal', deckId: 'tesouro', cardId: 'erro-banco-1' }
    const r = confirmCardReveal(g, defaultPorts)
    expect(r.resolution).toBeNull()
    expect(r.decks.tesouro[0]).toBe('aniversario-1') // topo avançou
    expect(r.decks.tesouro).toContain('erro-banco-1') // imediata volta ao fundo
    expect(r.turn.state).toBe('aguardando-finalizacao')
  })

  it('SC-002: carta de mão que cabe entra na mão e finaliza', () => {
    const g = onCard('tesouro', ['saia-prisao-1'], 2)
    g.resolution = { kind: 'card-reveal', deckId: 'tesouro', cardId: 'saia-prisao-1' }
    const r = confirmCardReveal(g, defaultPorts)
    expect(r.players[0].hand).toEqual(['saia-prisao-1'])
    expect(r.resolution).toBeNull()
    expect(r.turn.state).toBe('aguardando-finalizacao')
  })

  it('mão cheia ao confirmar → abre card-discard', () => {
    const g = onCard('tesouro', ['diplomacia-1'], 2)
    g.players[0].hand = ['saia-prisao-1', 'imunidade-1', 'bunker-fiscal-1'] // 3 (de mão)
    g.resolution = { kind: 'card-reveal', deckId: 'tesouro', cardId: 'diplomacia-1' }
    const r = confirmCardReveal(g, defaultPorts)
    expect(r.resolution?.kind).toBe('card-discard')
  })

  it('Atalho ao confirmar → abre card-shortcut', () => {
    const g = onCard('acaso', ['atalho-1'], 8)
    g.resolution = { kind: 'card-reveal', deckId: 'acaso', cardId: 'atalho-1' }
    const r = confirmCardReveal(g, defaultPorts)
    expect(r.resolution?.kind).toBe('card-shortcut')
  })

  it('SC-003: sem revelação pendente → no-op', () => {
    const g = createSeedState(['p1', 'p2'])
    expect(confirmCardReveal(g, defaultPorts)).toBe(g)
  })
})

describe('activeModal — variante card-reveal', () => {
  it('mapeia rarity/effect/mode da carta', () => {
    const g = createSeedState(['p1', 'p2'])
    g.resolution = { kind: 'card-reveal', deckId: 'acaso', cardId: 'atalho-1' }
    expect(activeModal(g)).toEqual({
      kind: 'card-reveal',
      deckId: 'acaso',
      cardId: 'atalho-1',
      rarity: 'comum',
      effect: 'atalho',
      mode: 'imediato',
    })
  })
})
