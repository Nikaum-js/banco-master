import { describe, it, expect } from 'vitest'
import { createSeedState } from '@/game/store'
import { useBusTicket, sideOf, resolvePending, finalizeTurn } from '@/game/turn/turnMachine'
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

  it('034: usável também no FIM do turno (aguardando-finalizacao), não só antes de rolar', () => {
    const g = withTicketAt(5, 1)
    g.turn.state = 'aguardando-finalizacao' // já rolou/resolveu — pode usar o ticket agora
    const out = useBusTicket(g, 9, ctxWith([3, 2]))
    expect(out).not.toBe(g) // NÃO é no-op
    expect(out.players[0].pos).toBe(9)
    expect(out.players[0].busTickets).toBe(0) // gastou o ticket
    expect(out.turn.state).toBe('casa-a-resolver') // destino entra pra resolução (compra etc.)
  })
})

describe('Bus Ticket — espaço (SRS §2.7 — guarda, não força)', () => {
  const BT = BOARD.find((sq) => sq.kind === 'bus-ticket')!.pos
  function atBusSpace(): GameState {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].pos = BT
    g.turn.state = 'casa-a-resolver'
    g.turn.pendingResolve = true
    return g
  }

  it('parar no espaço GANHA 1 Bus Ticket guardado, sem forçar viagem', () => {
    const ctx = ctxWith([3, 2])
    const antes = atBusSpace().players[0].busTickets
    const g = resolvePending(atBusSpace(), ctx)
    expect(g.players[0].busTickets).toBe(antes + 1) // guardado p/ uso facultativo (§10.7)
    expect(g.turn.awaitingChoice).toBeNull() // não força bus-ride
    expect(g.resolution).toBeNull()
    expect(g.turn.state).toBe('aguardando-finalizacao') // resolvido; turno segue
  })

  it('acumula: parar com 1 ticket guardado fica com 2 (sem limite, §10.7)', () => {
    const ctx = ctxWith([3, 2])
    const g0 = atBusSpace()
    g0.players[0].busTickets = 1
    const g = resolvePending(g0, ctx)
    expect(g.players[0].busTickets).toBe(2)
  })
})
