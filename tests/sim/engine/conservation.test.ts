// Conservação de dinheiro (036, extensão) — para cada mecanismo, um caso CORRETO (gerado pelo
// próprio reducer de produção, sem violação) e um caso ADULTERADO (mesmo estado, valor corrompido
// manualmente, violação código 'h' detectada). Mesmo padrão de invariants.test.ts.
import { describe, expect, it } from 'vitest'
import { createSimSession } from './driver'
import { checkConservation, checkAuctionClose } from './conservation'
import type { GameState } from '@/game/turn/types'
import { BOARD } from '@/lib/boardData'
import { economyResolve } from '@/game/economy/resolveRentable'
import { resolveSquare, type TurnPorts } from '@/game/turn/resolution'
import { mortgageProperty, unmortgageProperty } from '@/game/economy/mortgage'
import { buildHouse, sellBuilding, buildHangar, sellHangar } from '@/game/economy/construction'
import { buyProperty } from '@/game/economy/purchase'
import { closeAuction } from '@/game/economy/auction'
import { acquire, evict, audit } from '@/game/cards/ofensivas'
import { applyEffect } from '@/game/cards/effects'
import { payOffLoan, respondLoan } from '@/game/emprestimos/emprestimos'
import { declareBankruptcy } from '@/game/falencia/falencia'
import { executeTrade, type Trade } from '@/game/economy/trade'
import { jailDecision, advance, type TurnCtx } from '@/game/turn/turnMachine'
import { chargeLoanInterest } from '@/game/emprestimos/emprestimos'
import { mulberry32 } from './rng'

function baseState(n = 2): GameState {
  return createSimSession(1, Array.from({ length: n }, (_, i) => `p${i + 1}`)).game
}

function ports(): TurnPorts {
  return {
    onPassGo: () => 200,
    onPayToCenter: (s: GameState, amount: number) => {
      s.centerPot += amount
    },
    onCollectCenter: (s: GameState, id: string) => {
      const p = s.players.find((x) => x.id === id)!
      p.cash += s.centerPot
      s.centerPot = 500
    },
    isEliminated: () => false,
  }
}

function fakeCtx(): TurnCtx {
  return { rng: mulberry32(1), ports: ports() }
}

function codesOf(prev: GameState, next: GameState, action: Parameters<typeof checkConservation>[2]) {
  return checkConservation(prev, next, action).violations.map((v) => v.code)
}

describe('checkConservation — mecanismos de dinheiro (036 extensão)', () => {
  it('aluguel: paga o dono corretamente; corrompido é detectado', () => {
    const prev = baseState()
    prev.titles[1].ownerId = 'p1' // Roma (brown, price 60, rent 2)
    prev.players[1].pos = 1
    prev.activeSeat = 1
    prev.turn.state = 'casa-a-resolver'
    prev.turn.pendingResolve = true

    const next = structuredClone(prev)
    economyResolve({ playerId: 'p2', square: BOARD[1], roll: null, ports: ports(), state: next })
    expect(codesOf(prev, next, { kind: 'resolve-pending' })).toEqual([])

    const bad = structuredClone(next)
    bad.players[1].cash += 1 // aluguel a menos do que deveria
    expect(codesOf(prev, bad, { kind: 'resolve-pending' })).toContain('h')
  })

  it('imposto: debita do jogador e credita o pote; corrompido é detectado', () => {
    const prev = baseState()
    prev.players[0].pos = 4 // Imposto de Renda, $200
    prev.turn.state = 'casa-a-resolver'
    prev.turn.pendingResolve = true

    const next = structuredClone(prev)
    resolveSquare({ playerId: 'p1', square: BOARD[4], roll: null, ports: ports(), state: next })
    expect(codesOf(prev, next, { kind: 'resolve-pending' })).toEqual([])

    const bad = structuredClone(next)
    bad.centerPot -= 50 // pote recebeu mais do que o imposto pago
    expect(codesOf(prev, bad, { kind: 'resolve-pending' })).toContain('h')
  })

  it('Free Parking: coleta o pote e reseta pro seed; corrompido é detectado', () => {
    const prev = baseState()
    prev.centerPot = 550
    prev.players[0].pos = 24 // Férias/Loteria
    prev.turn.state = 'casa-a-resolver'
    prev.turn.pendingResolve = true

    const next = structuredClone(prev)
    resolveSquare({ playerId: 'p1', square: BOARD[24], roll: null, ports: ports(), state: next })
    expect(codesOf(prev, next, { kind: 'resolve-pending' })).toEqual([])

    const bad = structuredClone(next)
    bad.players[0].cash -= 1
    expect(codesOf(prev, bad, { kind: 'resolve-pending' })).toContain('h')
  })

  it('hipoteca: credita metade do preço; corrompido é detectado', () => {
    const prev = baseState()
    prev.titles[1].ownerId = 'p1' // Roma, price 60 → hipoteca $30
    const next = mortgageProperty(prev, 1)
    expect(codesOf(prev, next, { kind: 'mortgage', pos: 1 })).toEqual([])

    const bad = structuredClone(next)
    bad.players[0].cash += 100
    expect(codesOf(prev, bad, { kind: 'mortgage', pos: 1 })).toContain('h')
  })

  it('deshipoteca: cobra metade + 10%; corrompido é detectado', () => {
    const prev = baseState()
    prev.titles[1].ownerId = 'p1'
    prev.titles[1].mortgaged = true
    const next = unmortgageProperty(prev, 1) // custo = round(30*1.1) = 33
    expect(codesOf(prev, next, { kind: 'unmortgage', pos: 1 })).toEqual([])

    const bad = structuredClone(next)
    bad.players[0].cash -= 1000
    expect(codesOf(prev, bad, { kind: 'unmortgage', pos: 1 })).toContain('h')
  })

  it('construir casa: cobra o tier do grupo; corrompido é detectado', () => {
    const prev = baseState()
    prev.titles[1].ownerId = 'p1' // Roma — só cidade do grupo brown que o jogador possui
    const next = buildHouse(prev, 1)
    expect(next.titles[1].houses).toBe(1) // confirma que a construção realmente aconteceu
    expect(codesOf(prev, next, { kind: 'build-house', pos: 1 })).toEqual([])

    const bad = structuredClone(next)
    bad.players[0].cash += 1000
    expect(codesOf(prev, bad, { kind: 'build-house', pos: 1 })).toContain('h')
  })

  it('vender construção: devolve metade do custo; corrompido é detectado', () => {
    const prev = baseState()
    prev.titles[1].ownerId = 'p1'
    prev.titles[1].houses = 1
    const next = sellBuilding(prev, 1)
    expect(codesOf(prev, next, { kind: 'sell-building', pos: 1 })).toEqual([])

    const bad = structuredClone(next)
    bad.players[0].cash += 1000
    expect(codesOf(prev, bad, { kind: 'sell-building', pos: 1 })).toContain('h')
  })

  it('Hangar: construir cobra, vender devolve metade; corrompido é detectado', () => {
    const prev = baseState()
    prev.titles[6].ownerId = 'p1' // JFK
    const next = buildHangar(prev, 6)
    expect(codesOf(prev, next, { kind: 'build-hangar', pos: 6 })).toEqual([])

    const prev2 = next
    const next2 = sellHangar(prev2, 6)
    expect(codesOf(prev2, next2, { kind: 'sell-hangar', pos: 6 })).toEqual([])

    const bad = structuredClone(next2)
    bad.players[0].cash += 1000
    expect(codesOf(prev2, bad, { kind: 'sell-hangar', pos: 6 })).toContain('h')
  })

  it('comprar propriedade livre: debita o preço de tabela; corrompido é detectado', () => {
    const prev = baseState()
    prev.resolution = { kind: 'purchase', pos: 1 } // Roma, $60
    const next = buyProperty(prev)
    expect(codesOf(prev, next, { kind: 'buy-property' })).toEqual([])

    const bad = structuredClone(next)
    bad.players[0].cash += 1000
    expect(codesOf(prev, bad, { kind: 'buy-property' })).toContain('h')
  })

  it('leilão de propriedade: vencedor paga o banco (fechamento não é um SimAction)', () => {
    const prev = baseState()
    prev.resolution = {
      kind: 'auction',
      auction: { pos: 1, currentBid: 40, highBidder: 'p2', activeBidders: ['p2'], deadline: 0 },
    }
    const next = closeAuction(prev)
    const result = checkAuctionClose(prev, next)
    expect(result.violations).toEqual([])

    const bad = structuredClone(next)
    bad.players[1].cash += 1000
    expect(checkAuctionClose(prev, bad).violations.map((v) => v.code)).toContain('h')
  })

  it('Aquisição Hostil: atacante paga o dono (taxa fica com o banco); corrompido é detectado', () => {
    const prev = baseState()
    prev.titles[1].ownerId = 'p2' // Roma, $60, sem construção
    prev.titles[3].ownerId = 'p2' // Veneza — 2ª propriedade não-hipotecada (gate §574)
    prev.players[0].hand = ['aquisicao-hostil-1']
    const next = structuredClone(prev)
    expect(acquire(next, 'p1', 1)).toBe(true)
    expect(codesOf(prev, next, { kind: 'play-hand-card', cardId: 'aquisicao-hostil-1', target: 1 })).toEqual([])

    const bad = structuredClone(next)
    bad.players[1].cash += 1000
    expect(codesOf(prev, bad, { kind: 'play-hand-card', cardId: 'aquisicao-hostil-1', target: 1 })).toContain('h')
  })

  it('Despejo: demole 1 casa sem mover dinheiro; corrompido é detectado', () => {
    const prev = baseState()
    prev.titles[1].ownerId = 'p2'
    prev.titles[1].houses = 1
    prev.players[0].hand = ['despejo-1']
    const next = structuredClone(prev)
    expect(evict(next, 'p1', 1)).toBe(true)
    expect(codesOf(prev, next, { kind: 'play-hand-card', cardId: 'despejo-1', target: 1 })).toEqual([])

    const bad = structuredClone(next)
    bad.players[1].cash += 10
    expect(codesOf(prev, bad, { kind: 'play-hand-card', cardId: 'despejo-1', target: 1 })).toContain('h')
  })

  it('Auditoria Fiscal: alvo paga 10% do patrimônio ao pote; corrompido é detectado', () => {
    const prev = baseState()
    prev.players[0].hand = ['auditoria-fiscal-1']
    const next = structuredClone(prev)
    expect(audit(next, 'p1', 'p2', ports())).toBe(true)
    expect(codesOf(prev, next, { kind: 'play-hand-card', cardId: 'auditoria-fiscal-1', targetPlayer: 'p2' })).toEqual([])

    const bad = structuredClone(next)
    bad.centerPot += 1000
    expect(codesOf(prev, bad, { kind: 'play-hand-card', cardId: 'auditoria-fiscal-1', targetPlayer: 'p2' })).toContain('h')
  })

  it('Troca com propriedade hipotecada: taxa de 10% vai pro banco (não é P2P puro)', () => {
    const prev = baseState()
    prev.titles[1].ownerId = 'p1'
    prev.titles[1].mortgaged = true // hipotecada — 013/014 permitem trocar hipotecada
    const trade: Trade = { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 0, toProps: [], toCash: 0 }
    prev.pendingTrade = trade
    const next = executeTrade(prev, trade)
    next.pendingTrade = null
    expect(codesOf(prev, next, { kind: 'accept-trade' })).toEqual([])

    const bad = structuredClone(next)
    bad.players[1].cash += 1000
    expect(codesOf(prev, bad, { kind: 'accept-trade' })).toContain('h')
  })

  it('quitar empréstimo: paga só o principal ao credor; corrompido é detectado', () => {
    const prev = baseState()
    prev.loans = [{ debtorId: 'p1', creditorId: 'p2', principal: 100, ratePct: 10 }]
    const next = payOffLoan(prev, 'p1')
    expect(codesOf(prev, next, { kind: 'pay-off-loan' })).toEqual([])

    const bad = structuredClone(next)
    bad.players[1].cash += 1000
    expect(codesOf(prev, bad, { kind: 'pay-off-loan' })).toContain('h')
  })

  it('conceder empréstimo: credor transfere o principal ao devedor; corrompido é detectado', () => {
    const prev = baseState()
    prev.resolution = { kind: 'debt', amount: 300, creditorId: null }
    prev.pendingLoan = { debtorId: 'p1', creditorId: 'p2', principal: 300 }
    const next = respondLoan(prev, true, 10)
    expect(codesOf(prev, next, { kind: 'respond-loan', accept: true, ratePct: 10 })).toEqual([])

    const bad = structuredClone(next)
    bad.players[0].cash += 1000
    expect(codesOf(prev, bad, { kind: 'respond-loan', accept: true, ratePct: 10 })).toContain('h')
  })

  it('multa de prisão (pagar): debita o jogador e credita o pote; corrompido é detectado', () => {
    const prev = baseState()
    prev.turn.state = 'prisao-decisao'
    prev.players[0].jail = { inJail: true, attempts: 0 }
    const next = jailDecision(prev, 'pay', fakeCtx())
    expect(codesOf(prev, next, { kind: 'jail-decision', decision: 'pay' })).toEqual([])

    const bad = structuredClone(next)
    bad.centerPot -= 1000
    expect(codesOf(prev, bad, { kind: 'jail-decision', decision: 'pay' })).toContain('h')
  })

  it('falência com herdeiro: herdeiro recebe todo o caixa restante; corrompido é detectado', () => {
    const prev = baseState()
    prev.resolution = { kind: 'debt', amount: 10_000, creditorId: 'p2' } // dívida impagável de propósito
    prev.players[0].cash = 50
    const next = declareBankruptcy(prev, fakeCtx())
    expect(next.players[0].eliminated).toBe(true) // confirma que a falência realmente ocorreu
    expect(codesOf(prev, next, { kind: 'declare-bankruptcy' })).toEqual([])

    const bad = structuredClone(next)
    bad.players[1].cash += 1000
    expect(codesOf(prev, bad, { kind: 'declare-bankruptcy' })).toContain('h')
  })

  it('carta Boom Econômico: todos os jogadores vivos recebem $200; corrompido é detectado', () => {
    const prev = baseState(3)
    prev.players[0].pos = 8 // casa Acaso
    prev.decks.acaso = ['boom-economico-1', ...prev.decks.acaso.filter((c) => c !== 'boom-economico-1')]
    prev.turn.state = 'casa-a-resolver'
    prev.turn.pendingResolve = true
    const next = structuredClone(prev)
    applyEffect('boomEconomico', next, 'p1', ports())
    next.decks.acaso.push(next.decks.acaso.shift()!) // reflete o "volta ao fundo" real de cardResolve
    expect(codesOf(prev, next, { kind: 'resolve-pending' })).toEqual([])

    const bad = structuredClone(next)
    bad.players[2].cash += 1000
    expect(codesOf(prev, bad, { kind: 'resolve-pending' })).toContain('h')
  })

  it('carta Honorários: paga $50 ao pote (capado pelo caixa); corrompido é detectado', () => {
    const prev = baseState()
    prev.players[0].pos = 39 // casa Tesouro
    prev.decks.tesouro = ['honorarios-1', ...prev.decks.tesouro.filter((c) => c !== 'honorarios-1')]
    prev.turn.state = 'casa-a-resolver'
    prev.turn.pendingResolve = true
    const next = structuredClone(prev)
    applyEffect('honorarios', next, 'p1', ports())
    next.decks.tesouro.push(next.decks.tesouro.shift()!)
    expect(codesOf(prev, next, { kind: 'resolve-pending' })).toEqual([])

    const bad = structuredClone(next)
    bad.centerPot += 1000
    expect(codesOf(prev, bad, { kind: 'resolve-pending' })).toContain('h')
  })

  it('imunidade de aluguel: isenta o pagamento; corrompido é detectado', () => {
    const prev = baseState()
    prev.titles[1].ownerId = 'p1'
    prev.immunities = [{ beneficiaryId: 'p2', pos: 1, lapsRemaining: null }]
    prev.players[1].pos = 1
    prev.activeSeat = 1
    prev.turn.state = 'casa-a-resolver'
    prev.turn.pendingResolve = true

    const next = structuredClone(prev)
    economyResolve({ playerId: 'p2', square: BOARD[1], roll: null, ports: ports(), state: next })
    expect(codesOf(prev, next, { kind: 'resolve-pending' })).toEqual([])

    const bad = structuredClone(next)
    bad.players[1].cash -= 10 // isento pagou mesmo assim — bug
    expect(codesOf(prev, bad, { kind: 'resolve-pending' })).toContain('h')
  })

  it('juros de empréstimo ao cruzar o GO: cobra junto do bônus; corrompido é detectado', () => {
    const prev = baseState()
    prev.loans = [{ debtorId: 'p1', creditorId: 'p2', principal: 100, ratePct: 10 }] // juros = $10
    prev.players[0].pos = 46 // 46+3=49 ≥ 48 → cruza o GO

    const next = structuredClone(prev)
    const portsWithLoan: TurnPorts = { ...ports(), afterPassGo: (s, id) => chargeLoanInterest(s, id) }
    advance(next, next.players[0], 3, portsWithLoan)
    expect(codesOf(prev, next, { kind: 'roll' })).toEqual([])

    const bad = structuredClone(next)
    bad.players[1].cash += 1000 // credor recebeu juros a mais
    expect(codesOf(prev, bad, { kind: 'roll' })).toContain('h')
  })

  it('estado válido não acusa nenhuma violação de conservação', () => {
    const s = baseState()
    expect(checkConservation(s, s, { kind: 'roll' }).violations).toEqual([])
  })
})
