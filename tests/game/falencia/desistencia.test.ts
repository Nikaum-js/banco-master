// Desistência — §9.6 / D-057. A saída voluntária, que NÃO é a falência do §9.1: não exige
// insolvência, e sem empréstimo ativo devolve tudo livre ao banco em vez de abrir pregão.
import { describe, it, expect } from 'vitest'
import { concede } from '@/game/falencia/falencia'
import { createSeedState, defaultPorts } from '@/game/setup'
import { BOARD } from '@/lib/boardData'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'

const ctx: TurnCtx = { rng: () => 0, ports: defaultPorts }

// p1 (ativo) com patrimônio: Roma (pos 1) com 2 casas e hipoteca em Kyoto (pos 3).
function withEstate(ids = ['p1', 'p2', 'p3']): GameState {
  const g = createSeedState(ids)
  g.titles[1].ownerId = 'p1'
  g.titles[1].houses = 2
  g.titles[3].ownerId = 'p1'
  g.titles[3].mortgaged = true
  return g
}

describe('Desistência (§9.6 / D-057)', () => {
  it('não exige insolvência: jogador cheio de caixa sai na mesma', () => {
    const g = createSeedState(['p1', 'p2', 'p3'])
    g.players[0].cash = 5000

    const after = concede(g, ctx)

    expect(after).not.toBe(g)
    expect(after.players[0].eliminated).toBe(true)
    expect(after.players[0].cash).toBe(0) // sem herdeiro, o caixa é destruído
    expect(after.eliminationOrder.map((e) => e.playerId)).toEqual(['p1'])
    expect(after.log.some((e) => e.kind === 'concede' && e.who === 'p1')).toBe(true)
    expect(after.log.some((e) => e.kind === 'bankruptcy')).toBe(false) // fato distinto
  })

  it('sem empréstimo: propriedades voltam LIVRES ao banco — sem construção, sem hipoteca e sem pregão', () => {
    const after = concede(withEstate(), ctx)

    expect(after.titles[1].ownerId).toBeNull()
    expect(after.titles[1].houses).toBe(0)
    expect(after.titles[3].ownerId).toBeNull()
    expect(after.titles[3].mortgaged).toBe(false) // livre de verdade, ao contrário do espólio
    expect(after.landAuction).toBeNull() // D-057: desistir não abre pregão
  })

  it('Hangar de aeroporto também é desfeito na devolução ao banco', () => {
    const g = createSeedState(['p1', 'p2', 'p3'])
    const airport = BOARD.findIndex((sq) => sq.kind === 'airport')
    g.titles[airport].ownerId = 'p1'
    g.titles[airport].hangar = true

    const after = concede(g, ctx)

    expect(after.titles[airport].ownerId).toBeNull()
    expect(after.titles[airport].hangar).toBe(false)
  })

  it('com empréstimo ativo, o credor herda tudo — igual ao §9.3', () => {
    const g = withEstate()
    g.loans.push({ debtorId: 'p1', creditorId: 'p2', principal: 300, ratePct: 10, lapsElapsed: 0 })
    const heirCash = g.players[1].cash
    const leaverCash = g.players[0].cash

    const after = concede(g, ctx)

    expect(after.titles[1].ownerId).toBe('p2')
    expect(after.titles[3].ownerId).toBe('p2')
    expect(after.titles[3].mortgaged).toBe(true) // passivo segue junto (§9.3)
    expect(after.titles[1].houses).toBe(0) // construções desfeitas na herança
    expect(after.players[1].cash).toBe(heirCash + leaverCash)
    expect(after.loans).toHaveLength(0)
  })

  it('mesa de 3: quem fica segue jogando e a vez passa para o próximo', () => {
    const after = concede(createSeedState(['p1', 'p2', 'p3']), ctx)

    expect(after.phase).toBe('playing')
    expect(after.players.filter((p) => !p.eliminated)).toHaveLength(2)
    expect(after.players[after.turnOrder[after.activeSeat]].id).toBe('p2')
  })

  it('mesa de 2: sobrar um encerra a partida (§9.5), sem passar a vez', () => {
    const after = concede(createSeedState(['p1', 'p2']), ctx)

    expect(after.phase).toBe('ended')
    expect(after.players[1].eliminated).toBe(false)
  })

  it('limpa vínculos do eliminado: imunidades, efeitos e propostas (§9.4)', () => {
    const g = createSeedState(['p1', 'p2', 'p3'])
    g.immunities = [{ granterId: 'p1', beneficiaryId: 'p2', pos: 1, lapsRemaining: 2 }]
    g.tempEffects = [{ ownerId: 'p1', kind: 'boicote', pos: 1, lapsRemaining: 2 }]
    g.tradeProposals = [
      { id: 1, trade: { fromId: 'p1', toId: 'p2', fromProps: [], fromCash: 0, toProps: [], toCash: 0 } },
    ]

    const after = concede(g, ctx)

    expect(after.immunities).toHaveLength(0)
    expect(after.tempEffects).toHaveLength(0)
    expect(after.tradeProposals).toHaveLength(0)
  })

  it('no-op enquanto há decisão de OUTRO em voo — leilão, reação e proposta de empréstimo', () => {
    const auction = createSeedState(['p1', 'p2', 'p3'])
    auction.resolution = {
      kind: 'auction',
      auction: { pos: 1, currentBid: 0, highBidder: null, activeBidders: ['p2', 'p3'], deadline: 0 },
    }
    expect(concede(auction, ctx)).toBe(auction)

    const reaction = createSeedState(['p1', 'p2', 'p3'])
    reaction.resolution = { kind: 'reaction-bunker', reactorId: 'p2', amount: 100 }
    expect(concede(reaction, ctx)).toBe(reaction)

    const loan = createSeedState(['p1', 'p2', 'p3'])
    loan.pendingLoan = { debtorId: 'p1', creditorId: 'p2', principal: 100 }
    expect(concede(loan, ctx)).toBe(loan)
  })

  it('dívida pendente NÃO bloqueia: desistir é exatamente a saída dali', () => {
    const g = createSeedState(['p1', 'p2', 'p3'])
    g.turn.state = 'casa-a-resolver'
    g.turn.pendingResolve = true
    g.resolution = { kind: 'debt', amount: 400, creditorId: 'p2' }

    const after = concede(g, ctx)

    expect(after.players[0].eliminated).toBe(true)
    expect(after.resolution).toBeNull()
    expect(after.turn.pendingResolve).toBe(false)
  })

  it('no-op fora da partida em andamento e para quem já saiu', () => {
    const ended = createSeedState(['p1', 'p2', 'p3'])
    ended.phase = 'ended'
    expect(concede(ended, ctx)).toBe(ended)

    const gone = createSeedState(['p1', 'p2', 'p3'])
    gone.players[0].eliminated = true
    expect(concede(gone, ctx)).toBe(gone)
  })
})
