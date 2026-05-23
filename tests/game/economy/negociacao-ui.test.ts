import { describe, it, expect } from 'vitest'
import { validateTrade, tradableProps, proposeTrade, acceptTrade, rejectTrade } from '@/game/economy/trade'
import type { Trade } from '@/game/economy/types'
import { createSeedState } from '@/game/store'
import type { GameState } from '@/game/turn/types'

// p1 dono de pos 1 (Roma, brown); p2 dono de pos 7 (Cairo, skyblue) e do aeroporto pos 6.
function setup(): GameState {
  const g = createSeedState(['p1', 'p2', 'p3'])
  g.titles[1].ownerId = 'p1'
  g.titles[7].ownerId = 'p2'
  g.titles[6].ownerId = 'p2' // aeroporto
  return g
}

const baseTrade = (over: Partial<Trade> = {}): Trade => ({
  fromId: 'p1',
  toId: 'p2',
  fromProps: [1],
  fromCash: 0,
  toProps: [7],
  toCash: 0,
  ...over,
})

describe('validateTrade (US1)', () => {
  it('SC-006: troca bem-formada → true', () => {
    expect(validateTrade(setup(), baseTrade())).toBe(true)
  })

  it('SC-002: peço propriedade que o outro não tem → false', () => {
    expect(validateTrade(setup(), baseTrade({ toProps: [9] }))).toBe(false) // pos9 sem dono
  })

  it('SC-002: propriedade com construção → false', () => {
    const g = setup()
    g.titles[1].houses = 1
    expect(validateTrade(g, baseTrade())).toBe(false)
  })

  it('SC-002: caixa insuficiente → false', () => {
    expect(validateTrade(setup(), baseTrade({ fromCash: 999999 }))).toBe(false)
  })

  it('SC-002: taxa de hipoteca deixaria saldo negativo → false', () => {
    const g = setup()
    g.titles[7].mortgaged = true // p1 recebe pos7 hipotecada → paga 10%
    g.players[0].cash = 0 // p1 sem caixa para a taxa
    expect(validateTrade(g, baseTrade({ fromProps: [], fromCash: 0, toProps: [7], toCash: 0 }))).toBe(false)
  })
})

describe('tradableProps', () => {
  it('SC-004: exclui cidade com construção e propriedades de terceiros', () => {
    const g = setup()
    g.titles[5].ownerId = 'p1'
    g.titles[5].houses = 1 // construção → não negociável
    const props = tradableProps(g, 'p1')
    expect(props).toContain(1)
    expect(props).not.toContain(5) // com construção
    expect(props).not.toContain(7) // de p2
  })
})

describe('proposeTrade / acceptTrade / rejectTrade (US1+US2)', () => {
  it('proposeTrade grava a pendente quando válida', () => {
    const r = proposeTrade(setup(), baseTrade())
    expect(r.pendingTrade).toEqual(baseTrade())
  })

  it('proposeTrade é no-op se já há pendente ou se inválida', () => {
    const g = proposeTrade(setup(), baseTrade())
    expect(proposeTrade(g, baseTrade({ toProps: [6] }))).toBe(g) // já há pendente
    const g2 = setup()
    expect(proposeTrade(g2, baseTrade({ toProps: [9] }))).toBe(g2) // inválida
  })

  it('SC-002: acceptTrade aplica a troca (donos/saldos) e limpa a pendente', () => {
    const g = proposeTrade(setup(), baseTrade())
    const r = acceptTrade(g)
    expect(r.titles[1].ownerId).toBe('p2') // pos1 foi de p1 → p2
    expect(r.titles[7].ownerId).toBe('p1') // pos7 foi de p2 → p1
    expect(r.pendingTrade).toBeNull()
  })

  it('SC-003: acceptTrade é no-op se a proposta ficou obsoleta', () => {
    const g = proposeTrade(setup(), baseTrade())
    g.titles[1].ownerId = 'p3' // p1 deixou de ser dono → proposta inválida
    const r = acceptTrade(g)
    expect(r).toBe(g) // no-op
    expect(r.pendingTrade).not.toBeNull() // mantém p/ recusar
  })

  it('SC-003: rejectTrade descarta sem mover nada', () => {
    const g = proposeTrade(setup(), baseTrade())
    const r = rejectTrade(g)
    expect(r.pendingTrade).toBeNull()
    expect(r.titles[1].ownerId).toBe('p1') // nada mudou
    expect(r.titles[7].ownerId).toBe('p2')
  })

  it('acceptTrade/rejectTrade sem pendente → no-op', () => {
    const g = setup()
    expect(acceptTrade(g)).toBe(g)
    expect(rejectTrade(g)).toBe(g)
  })

  // 027 — registro das aceitas (histórico + log)
  it('SC-002: acceptTrade registra no histórico e loga; recusar não', () => {
    const acc = acceptTrade(proposeTrade(setup(), baseTrade()))
    expect(acc.tradeHistory).toHaveLength(1)
    expect(acc.tradeHistory[0]).toMatchObject({ fromId: 'p1', toId: 'p2' })
    expect(acc.log.some((e) => e.what.includes('p1 ↔ p2'))).toBe(true)

    const rej = rejectTrade(proposeTrade(setup(), baseTrade()))
    expect(rej.tradeHistory).toHaveLength(0)
    expect(rej.log.some((e) => e.what.includes('↔'))).toBe(false)
  })

  it('SC-005: histórico é bounded em 12', () => {
    let g = setup()
    g.tradeHistory = Array.from({ length: 12 }, () => ({ fromId: 'p1', toId: 'p2', fromProps: [], fromCash: 0, toProps: [], toCash: 0 }))
    g = acceptTrade(proposeTrade(g, baseTrade()))
    expect(g.tradeHistory).toHaveLength(12) // descartou a mais antiga
  })
})

describe('imunidades na troca (US3)', () => {
  it('SC-006: imunidade sobre propriedade própria mantida → válida e aplicada', () => {
    const g = setup()
    g.titles[5].ownerId = 'p1' // p1 mantém pos5 (não oferece)
    const trade = baseTrade({ fromImmunities: [{ pos: 5, laps: 2 }] })
    expect(validateTrade(g, trade)).toBe(true)
    const r = acceptTrade(proposeTrade(g, trade))
    expect(r.immunities.some((i) => i.beneficiaryId === 'p2' && i.pos === 5 && i.lapsRemaining === 2)).toBe(true)
  })

  it('SC-002: imunidade sobre propriedade cedida ou de terceiro → inválida', () => {
    const g = setup()
    // pos1 está sendo oferecida por p1 → não pode conceder imunidade sobre ela
    expect(validateTrade(g, baseTrade({ fromImmunities: [{ pos: 1, laps: 2 }] }))).toBe(false)
    // pos7 é de p2, não de p1
    expect(validateTrade(g, baseTrade({ fromImmunities: [{ pos: 7, laps: 2 }] }))).toBe(false)
  })
})
