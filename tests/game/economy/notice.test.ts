import { describe, it, expect } from 'vitest'
import { createSeedState } from '@/game/store'
import { collectCenter } from '@/game/balancing/balancing'
import { acquire } from '@/game/cards/ofensivas'
import { dismissNotice } from '@/game/turn/turnMachine'
import type { GameState } from '@/game/turn/types'

const setup = (): GameState => createSeedState(['p1', 'p2', 'p3'])

describe('notice — Free Parking coletado (030)', () => {
  it('SC-001: collectCenter registra notice (jogador + valor); regra 007 intacta', () => {
    const g = setup()
    const before = g.players.find((p) => p.id === 'p1')!.cash
    g.centerPot = 850
    collectCenter(g, 'p1')
    expect(g.notice).toEqual({ kind: 'free-parking', playerId: 'p1', amount: 850 })
    expect(g.players.find((p) => p.id === 'p1')!.cash).toBe(before + 850) // coleta inalterada
    expect(g.centerPot).not.toBe(850) // pote reabasteceu (semente)
  })
})

describe('notice — Aquisição Hostil sofrida (030)', () => {
  it('SC-002: acquire válido registra notice (vítima/atacante/pos) e transfere o título', () => {
    const g = setup()
    g.titles[7].ownerId = 'p2'
    g.titles[9].ownerId = 'p2' // p2 com 2 não-hipotecadas (gate canAcquire)
    g.players[0].cash = 5000
    const ok = acquire(g, 'p1', 7)
    expect(ok).toBe(true)
    expect(g.titles[7].ownerId).toBe('p1') // regra 016 intacta
    expect(g.notice).toEqual({ kind: 'hostile-takeover', victimId: 'p2', attackerId: 'p1', pos: 7 })
  })

  it('acquire inválido (sem dono) → não seta notice', () => {
    const g = setup()
    g.notice = null
    expect(acquire(g, 'p1', 7)).toBe(false)
    expect(g.notice).toBeNull()
  })
})

describe('dismissNotice (030)', () => {
  it('SC-002: dispensa limpa a notice (puro, não muta o original)', () => {
    const g = setup()
    g.notice = { kind: 'free-parking', playerId: 'p1', amount: 500 }
    const r = dismissNotice(g)
    expect(r.notice).toBeNull()
    expect(g.notice).not.toBeNull() // original preservado (clone)
  })

  it('dismissNotice sem notice → no-op', () => {
    const g = setup()
    expect(dismissNotice(g)).toBe(g)
  })
})
