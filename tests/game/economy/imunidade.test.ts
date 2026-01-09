import { describe, it, expect } from 'vitest'
import { executeTrade } from '@/game/economy/trade'
import { hasImmunity, tickImmunities } from '@/game/economy/imunidade'
import { economyResolve } from '@/game/economy/resolveRentable'
import { rollTaxMan } from '@/game/balancing/taxMan'
import { createSeedState } from '@/game/store'
import type { GameState } from '@/game/turn/types'
import { BOARD } from '@/lib/boardData'
import { mockPorts, rngFromDice } from '../turn/_helpers'

// p1 dono de Roma (pos 1).
function withRoma(ids: string[] = ['p1', 'p2']): GameState {
  const g = createSeedState(ids)
  g.titles[1].ownerId = 'p1'
  return g
}

describe('Imunidade — concessão na troca (US1)', () => {
  it('SC-001: concede imunidade dentro de uma troca (beneficiário = outro lado)', () => {
    const g = withRoma()
    const out = executeTrade(g, {
      fromId: 'p1', toId: 'p2', fromProps: [], fromCash: 0, toProps: [], toCash: 200,
      fromImmunities: [{ pos: 1, laps: 3 }],
    })
    expect(out.immunities).toEqual([{ beneficiaryId: 'p2', pos: 1, lapsRemaining: 3, granterId: 'p1' }])
    expect(out.players[0].cash).toBe(2200) // p1 recebe $200
    expect(out.players[1].cash).toBe(1800)
  })

  it('SC-001: rejeita concessão sobre propriedade não-própria / cedida / laps inválido', () => {
    const naoPropria = withRoma()
    expect(executeTrade(naoPropria, { fromId: 'p1', toId: 'p2', fromProps: [], fromCash: 0, toProps: [], toCash: 0, fromImmunities: [{ pos: 3, laps: 3 }] })).toBe(naoPropria) // p1 não tem pos 3
    const cedendo = withRoma()
    expect(executeTrade(cedendo, { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 0, toProps: [], toCash: 0, fromImmunities: [{ pos: 1, laps: 3 }] })).toBe(cedendo) // está cedendo pos 1
    const lapsRuim = withRoma()
    expect(executeTrade(lapsRuim, { fromId: 'p1', toId: 'p2', fromProps: [], fromCash: 0, toProps: [], toCash: 0, fromImmunities: [{ pos: 1, laps: 0 }] })).toBe(lapsRuim)
  })

  it('SC-002: beneficiário não paga; outro jogador paga (pessoal)', () => {
    const g = withRoma(['p1', 'p2', 'p3'])
    g.immunities.push({ beneficiaryId: 'p2', pos: 1, lapsRemaining: 3 })
    const rent = BOARD[1].kind === 'property' ? (BOARD[1] as { rent: number }).rent : 0

    const benef = economyResolve({ playerId: 'p2', square: BOARD[1], roll: null, ports: mockPorts(), state: g })!
    expect(benef.done).toBe(true)
    expect(g.players[1].cash).toBe(2000) // p2 não paga

    const outro = economyResolve({ playerId: 'p3', square: BOARD[1], roll: null, ports: mockPorts(), state: g })!
    expect(outro.done).toBe(true)
    expect(g.players[2].cash).toBe(2000 - rent) // p3 paga normal
    expect(hasImmunity(g, 'p2', 1)).toBe(true) // imunidade não é consumida ao usar
  })
})

describe('Imunidade — expiração por voltas (US2)', () => {
  it('SC-003: decrementa por volta e expira em 0; permanente nunca', () => {
    const g = createSeedState(['p1', 'p2'])
    g.immunities.push({ beneficiaryId: 'p2', pos: 1, lapsRemaining: 2 })
    g.immunities.push({ beneficiaryId: 'p2', pos: 3, lapsRemaining: null }) // permanente

    tickImmunities(g, 'p2')
    expect(g.immunities.find((i) => i.pos === 1)?.lapsRemaining).toBe(1)
    expect(g.immunities.find((i) => i.pos === 3)?.lapsRemaining).toBe(null) // intacta

    tickImmunities(g, 'p2')
    expect(g.immunities.find((i) => i.pos === 1)).toBeUndefined() // expirou
    expect(g.immunities.find((i) => i.pos === 3)).toBeDefined() // permanente fica
  })

  it('SC-003: tick de um beneficiário não afeta imunidade de outro', () => {
    const g = createSeedState(['p1', 'p2', 'p3'])
    g.immunities.push({ beneficiaryId: 'p3', pos: 1, lapsRemaining: 2 })
    tickImmunities(g, 'p2') // p2 não tem imunidade
    expect(g.immunities.find((i) => i.beneficiaryId === 'p3')?.lapsRemaining).toBe(2)
  })
})

describe('Imunidade — não afeta o Tax Man (US2)', () => {
  it('SC-004: o Fiscal cobra o dono mesmo havendo imunidade na propriedade', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[3].ownerId = 'p2' // Veneza de p2
    g.immunities.push({ beneficiaryId: 'p1', pos: 3, lapsRemaining: 3 }) // imunidade de p1 (irrelevante p/ Fiscal)
    g.taxManPos = 0
    rollTaxMan(g, rngFromDice([1, 2])) // move 3 → cai na pos 3
    const rent = (BOARD[3] as { rent: number }).rent // p2 possui 1 brown → base
    expect(g.players[1].cash).toBe(2000 - rent) // dono p2 é cobrado, imunidade não bloqueia
  })
})
