import { describe, it, expect } from 'vitest'
import { tradesView } from '@/game/ui/trade/tradesView'
import { createSeedState } from '@/game/store'
import type { Trade } from '@/game/economy/types'

const t = (fromId: string, toId: string): Trade => ({ fromId, toId, fromProps: [], fromCash: 0, toProps: [], toCash: 0 })

describe('tradesView (US1)', () => {
  it('SC-001: vazio → pending null, history vazio', () => {
    expect(tradesView(createSeedState(['p1', 'p2']))).toEqual({ pending: null, history: [] })
  })

  it('SC-001: pending reflete game.pendingTrade', () => {
    const g = createSeedState(['p1', 'p2'])
    g.pendingTrade = t('p1', 'p2')
    expect(tradesView(g).pending).toEqual(t('p1', 'p2'))
  })

  it('SC-001: history em ordem reversa (mais recente primeiro)', () => {
    const g = createSeedState(['p1', 'p2'])
    g.tradeHistory = [t('p1', 'p2'), t('p2', 'p1')] // antiga → recente
    expect(tradesView(g).history).toEqual([t('p2', 'p1'), t('p1', 'p2')]) // recente primeiro
  })
})
