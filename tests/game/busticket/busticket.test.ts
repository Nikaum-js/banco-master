import { describe, it, expect } from 'vitest'
import { createSeedState } from '@/game/store'
import { useBusTicket, sideOf, resolvePending, finalizeTurn, chooseBusRide } from '@/game/turn/turnMachine'
import { economyResolve } from '@/game/economy/resolveRentable'
import { BOARD } from '@/lib/boardData'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'
import { ctxWith, mockPorts } from '../turn/_helpers'

// Primeira propriedade livre do lado 0 (1..11) — destino "comprável" determinístico.
const PROP_SIDE0 = BOARD.find((sq) => sq.kind === 'property' && sideOf(sq.pos) === 0)!.pos

// ctx que resolve economia (compra/aluguel), como o store real.
function ctxEcon(): TurnCtx {
  const ctx = ctxWith([3, 2])
  return { ...ctx, resolve: (r) => economyResolve(r) }
}

function withTicketAt(pos: number, tickets = 1): GameState {
  const g = createSeedState(['p1', 'p2'])
  g.players[0].pos = pos
  g.players[0].busTickets = tickets
  return g
}

describe('Bus Ticket — sideOf (009)', () => {
  it('mapeia cada lado e retorna null para cantos', () => {
    expect([1, 6, 11].map(sideOf)).toEqual([0, 0, 0])
    expect([13, 23].map(sideOf)).toEqual([1, 1])
    expect([25, 35].map(sideOf)).toEqual([2, 2])
    expect([37, 47].map(sideOf)).toEqual([3, 3])
    expect([0, 12, 24, 36].map(sideOf)).toEqual([null, null, null, null])
  })
})

describe('Bus Ticket — uso (US1)', () => {
  it('SC-001: move para casa do mesmo lado, gasta 1 ticket e abre resolução', () => {
    const g = withTicketAt(5, 2)
    const out = useBusTicket(g, 9, ctxWith([3, 2]))
    expect(out.players[0].pos).toBe(9)
    expect(out.players[0].busTickets).toBe(1)
    expect(out.turn.state).toBe('casa-a-resolver')
    expect(out.turn.pendingResolve).toBe(true)
    expect(out.turn.mayRollAgain).toBe(false) // sem rolagem → sem dupla
  })

  it('SC-002: rejeições deixam o estado inalterado (no-op)', () => {
    const ctx = ctxWith([3, 2])
    // sem ticket
    const semTicket = withTicketAt(5, 0)
    expect(useBusTicket(semTicket, 9, ctx)).toBe(semTicket)
    // sobre canto (pos 0)
    const noCanto = withTicketAt(0, 1)
    expect(useBusTicket(noCanto, 9, ctx)).toBe(noCanto)
    // destino em outro lado
    const g = withTicketAt(5, 1)
    expect(useBusTicket(g, 20, ctx)).toBe(g)
    // destino = posição atual
    expect(useBusTicket(g, 5, ctx)).toBe(g)
    // fora do estado aguardando-rolagem
    const movido = useBusTicket(g, 9, ctx) // agora casa-a-resolver
    expect(useBusTicket(movido, 7, ctx)).toBe(movido)
    // pausado
    const pausado = { ...withTicketAt(5, 1), paused: true }
    expect(useBusTicket(pausado, 9, ctx)).toBe(pausado)
  })

  it('SC-005: após resolver o destino, finaliza sem nova rolagem', () => {
    const ctx = ctxWith([3, 2]) // sem resolve → property resolve como done:true (stub)
    let g = withTicketAt(5, 1)
    g = useBusTicket(g, 9, ctx)
    g = resolvePending(g, ctx)
    expect(g.turn.state).toBe('aguardando-finalizacao')
    expect(g.activeSeat).toBe(0)
    g = finalizeTurn(g, ctx)
    expect(g.activeSeat).toBe(1) // passou a vez, sem re-rolagem
    expect(g.turn.state).toBe('aguardando-rolagem')
  })

  it('SC-003: destino propriedade livre abre compra (reuso 003)', () => {
    let g = withTicketAt(PROP_SIDE0 === 1 ? 2 : 1, 1) // garante origem ≠ destino, mesmo lado
    g = useBusTicket(g, PROP_SIDE0, ctxEcon())
    g = resolvePending(g, ctxEcon())
    expect(g.resolution?.kind).toBe('purchase')
    if (g.resolution?.kind === 'purchase') expect(g.resolution.pos).toBe(PROP_SIDE0)
  })

  it('pulo direto NÃO cruza o GO, mesmo indo "pra trás" no lado (sem bônus)', () => {
    const ports = mockPorts()
    const g = withTicketAt(45, 1)
    const out = useBusTicket(g, 38, { rng: () => 0, ports })
    expect(out.players[0].pos).toBe(38) // vai direto, sem dar a volta
    expect(ports.onPassGo).not.toHaveBeenCalled() // não percorre o tabuleiro → não cruza o GO
  })

  it('movimento dentro do lado nunca credita o GO', () => {
    const ports = mockPorts()
    const g = withTicketAt(38, 1)
    useBusTicket(g, 45, { rng: () => 0, ports })
    expect(ports.onPassGo).not.toHaveBeenCalled()
  })
})

describe('Bus Ticket — espaço (US2, §2.7 revisto por D-021)', () => {
  const BT = BOARD.find((sq) => sq.kind === 'bus-ticket')!.pos
  function atBusSpace(): GameState {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].pos = BT
    g.turn.state = 'casa-a-resolver'
    g.turn.pendingResolve = true
    return g
  }

  it('parar no espaço abre o seletor (bus-ride) e NÃO banca ticket', () => {
    const ctx = ctxWith([3, 2])
    let g = atBusSpace()
    const antes = g.players[0].busTickets
    g = resolvePending(g, ctx)
    expect(g.turn.awaitingChoice).toBe('bus-ride')
    expect(g.players[0].busTickets).toBe(antes) // não banca mais (D-021)
    expect(g.resolution).toBeNull()
  })

  it('chooseBusRide move para casa do mesmo lado e resolve o destino (sem gastar ticket)', () => {
    const ctx = ctxWith([3, 2])
    const dest = BOARD.find((sq) => sideOf(sq.pos) === sideOf(BT) && sq.pos !== BT)!.pos
    let g = resolvePending(atBusSpace(), ctx) // abre bus-ride
    const ticketsAntes = g.players[0].busTickets
    g = chooseBusRide(g, dest, ctx)
    expect(g.players[0].pos).toBe(dest)
    expect(g.players[0].busTickets).toBe(ticketsAntes) // espaço é a corrida; não consome
    expect(g.turn.awaitingChoice).toBeNull()
    expect(g.turn.state).toBe('casa-a-resolver') // destino é resolvido normalmente
  })

  it('chooseBusRide rejeita destino de outro lado / igual à origem (no-op)', () => {
    const ctx = ctxWith([3, 2])
    const g = resolvePending(atBusSpace(), ctx)
    const outroLado = BOARD.find((sq) => sideOf(sq.pos) !== null && sideOf(sq.pos) !== sideOf(BT))!.pos
    expect(chooseBusRide(g, outroLado, ctx)).toBe(g) // outro lado
    expect(chooseBusRide(g, BT, ctx)).toBe(g) // mesma casa
  })
})
