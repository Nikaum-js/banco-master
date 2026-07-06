// FR-004(a-g) — cada código detecta a violação injetada e não acusa falso positivo
// no mesmo estado corrigido (036).
import { describe, expect, it } from 'vitest'
import { createSimSession } from './driver'
import { checkInvariants } from './invariants'
import type { GameState } from '@/game/turn/types'

function baseState(): GameState {
  return createSimSession(1, ['p1', 'p2']).game
}

function codesOf(state: GameState, action?: Parameters<typeof checkInvariants>[2]) {
  return checkInvariants(state, state, action).map((v) => v.code)
}

describe('checkInvariants — FR-004a-g', () => {
  it('(a) cash negativo fora de dívida pendente é violação; dentro de dívida não é', () => {
    const s = baseState()
    s.players[0].cash = -10
    expect(codesOf(s)).toContain('a')
    s.resolution = { kind: 'debt', amount: 10, creditorId: null }
    expect(codesOf(s)).not.toContain('a')
  })

  it('(c) hotel2 sem hotel / skyscraper sem hotel2 é violação estrutural', () => {
    const s = baseState()
    s.titles[1].hotel2 = true // sem hotel=true
    expect(codesOf(s)).toContain('c')
    s.titles[1].hotel2 = false
    expect(codesOf(s)).not.toContain('c')
  })

  it('(d) posição fora de [0,47] é violação', () => {
    const s = baseState()
    s.players[0].pos = 99
    expect(codesOf(s)).toContain('d')
  })

  it('(e) mão com mais de 3 cartas é violação', () => {
    const s = baseState()
    s.players[0].hand = ['a', 'b', 'c', 'd']
    expect(codesOf(s)).toContain('e')
  })

  it('(f) busTickets negativo é violação', () => {
    const s = baseState()
    s.players[0].busTickets = -1
    expect(codesOf(s)).toContain('f')
  })

  it('(g) dono inexistente ou eliminado é violação', () => {
    const s = baseState()
    s.titles[1].ownerId = 'fantasma'
    expect(codesOf(s)).toContain('g')
    s.titles[1].ownerId = 'p1'
    s.players[0].eliminated = true
    expect(codesOf(s)).toContain('g')
  })

  it('(b) pay-off-loan que não conserva o par devedor/credor é violação', () => {
    const prev = baseState()
    prev.loans = [{ debtorId: 'p1', creditorId: 'p2', principal: 100, ratePct: 10 }]
    const next = structuredClone(prev)
    next.players[0].cash -= 100 // devedor pagou...
    // ...mas o credor não recebeu (bug simulado)
    expect(checkInvariants(prev, next, { kind: 'pay-off-loan' }).map((v) => v.code)).toContain('b')
  })

  it('estado válido não acusa nenhuma violação', () => {
    const s = baseState()
    expect(checkInvariants(s, s)).toEqual([])
  })
})
