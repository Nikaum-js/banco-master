// Enumeração por decisor (036/FR-002) — cobre casos em que o decisor NÃO é o jogador
// ativo (leilão, empréstimo, troca, reação).
import { describe, expect, it } from 'vitest'
import { createSimSession } from './driver'
import { enumerateActions } from './actions'
import type { SimSession } from './driver'

function session(playerIds: string[] = ['p1', 'p2', 'p3']): SimSession {
  return createSimSession(1, playerIds)
}

describe('enumerateActions — decisor correto por tipo de bloqueio', () => {
  it('leilão de propriedade: só activeBidders decidem; place-bid exige cash > currentBid', () => {
    const s = session()
    s.game.resolution = {
      kind: 'auction',
      auction: { pos: 1, currentBid: 100, highBidder: 'p1', activeBidders: ['p2', 'p3'], deadline: 0 },
    }
    s.game.players.find((p) => p.id === 'p2')!.cash = 50 // não cobre o lance atual
    const points = enumerateActions(s)
    expect(points.every((p) => p.mandatory)).toBe(true)
    const actorIds = points.map((p) => p.actorId).sort()
    expect(actorIds).toEqual(['p2', 'p3']) // p1 não é bidder ativo
    const p2point = points.find((p) => p.actorId === 'p2')!
    expect(p2point.actions).toEqual([{ kind: 'pass-bid', playerId: 'p2' }]) // sem place-bid: sem caixa
    const p3point = points.find((p) => p.actorId === 'p3')!
    expect(p3point.actions.some((a) => a.kind === 'place-bid')).toBe(true)
  })

  it('empréstimo pendente: só o credor decide (não o devedor/jogador ativo)', () => {
    const s = session(['p1', 'p2'])
    s.game.pendingLoan = { debtorId: 'p1', creditorId: 'p2', principal: 100 }
    const points = enumerateActions(s)
    expect(points).toHaveLength(1)
    expect(points[0].actorId).toBe('p2')
    expect(points[0].mandatory).toBe(true)
  })

  it('troca pendente: só o destinatário (toId) decide aceitar/recusar', () => {
    const s = session(['p1', 'p2', 'p3'])
    s.game.pendingTrade = { fromId: 'p1', toId: 'p3', fromProps: [], fromCash: 0, toProps: [], toCash: 0 }
    const points = enumerateActions(s)
    const tradePoint = points.find((p) => p.actions.some((a) => a.kind === 'accept-trade' || a.kind === 'reject-trade'))!
    expect(tradePoint.actorId).toBe('p3')
    expect(tradePoint.mandatory).toBe(false) // não bloqueia o turno do jogador ativo (p1)
  })

  it('reação pendente (bunker): só o reator decide, mesmo não sendo o jogador ativo', () => {
    const s = session(['p1', 'p2'])
    s.game.resolution = { kind: 'reaction-bunker', reactorId: 'p2', amount: 100 }
    const points = enumerateActions(s)
    expect(points).toHaveLength(1)
    expect(points[0].actorId).toBe('p2')
    expect(points[0].actions).toEqual([{ kind: 'respond-reaction', use: true }, { kind: 'respond-reaction', use: false }])
  })

  it('dívida pendente: devedor pode liquidar (mortgage) além de pagar/falir/pedir empréstimo', () => {
    const s = session(['p1', 'p2'])
    s.game.resolution = { kind: 'debt', amount: 500, creditorId: 'p2' }
    const pos = 1 // Egito (property) — ver boardData
    s.game.titles[pos].ownerId = 'p1'
    const points = enumerateActions(s)
    expect(points).toHaveLength(1)
    const debtor = points[0]
    expect(debtor.actorId).toBe('p1')
    expect(debtor.actions.some((a) => a.kind === 'declare-bankruptcy')).toBe(true)
    expect(debtor.actions.some((a) => a.kind === 'mortgage' && a.pos === pos)).toBe(true)
  })

  it('sem bloqueio: enumera a ação de turno do jogador ativo (roll em aguardando-rolagem)', () => {
    const s = session()
    const points = enumerateActions(s)
    const active = points.find((p) => p.mandatory)!
    expect(active.actions.some((a) => a.kind === 'roll')).toBe(true)
  })
})
