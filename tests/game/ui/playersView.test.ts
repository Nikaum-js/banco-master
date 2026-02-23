import { describe, it, expect } from 'vitest'
import { playersView, PLAYER_COLORS } from '@/game/ui/panels/playersView'
import { createSeedState } from '@/game/setup'
import { createRoom, joinRoom, SEAT_COLORS } from '@/net/room'

describe('playersView — GameState → painel (020)', () => {
  it('SC-001: mapeia caixa/mão/Bus Tickets/pos e cor por assento', () => {
    const g = createSeedState(['p1', 'p2', 'p3'])
    g.players[1].cash = 1234
    g.players[1].pos = 7
    g.players[1].busTickets = 2
    g.players[1].hand = ['boicote-1', 'diplomacia-1']
    const view = playersView(g)
    expect(view).toHaveLength(3)
    expect(view[1].id).toBe('p2') // o id técnico segue no view-model...
    expect(view[1].name).toBe('Jogador 2') // ...mas o nome exibível nunca é ele (038/FR-009)
    expect(view[1].money).toBe(1234)
    expect(view[1].pos).toBe(7)
    expect(view[1].busTickets).toBe(2)
    expect(view[1].cardsInHand).toBe(2) // só o contador
    expect(view[0].color).toBe(PLAYER_COLORS[0])
    expect(view[1].color).toBe(PLAYER_COLORS[1])
  })

  it('SC-001: active segue o jogador da vez; bankrupt reflete eliminated', () => {
    const g = createSeedState(['p1', 'p2'])
    g.activeSeat = 1 // vez do p2
    g.players[0].eliminated = true
    const view = playersView(g)
    expect(view[0].active).toBe(false)
    expect(view[0].bankrupt).toBe(true)
    expect(view[1].active).toBe(true)
  })

  it('SC-001: loanActive e immune derivados do estado', () => {
    const g = createSeedState(['p1', 'p2'])
    g.loans.push({ debtorId: 'p1', creditorId: 'p2', principal: 100, ratePct: 20 })
    g.immunities.push({ beneficiaryId: 'p2', pos: 1, lapsRemaining: 3 })
    const view = playersView(g)
    expect(view[0].loanActive).toBe(true)
    expect(view[1].loanActive).toBe(false)
    expect(view[1].immune).toBe(true)
    expect(view[0].immune).toBe(false)
  })

  // 038: com sala, a identidade vem do lobby — é a única fonte de nome/cor (D-019).
  it('FR-009: nome e cor vêm da sala; `you` marca o assento do uid local', () => {
    const g = createSeedState(['p1', 'p2'])
    let room = createRoom('r1', {
      uid: 'tok-nik',
      name: 'Nik',
      color: SEAT_COLORS[0],
      avatar: 'orbital-eyes',
      skin: 'cavanhaque',
    })
    const r = joinRoom(room, {
      uid: 'tok-ana',
      name: 'Ana',
      color: SEAT_COLORS[1],
      avatar: 'single-line',
      skin: 'astronauta',
    })
    if (!r.ok) throw new Error(r.reason)
    room = r.room

    const view = playersView(g, room, 'tok-ana')
    expect(view.map((p) => p.name)).toEqual(['Nik', 'Ana'])
    expect(view[1].color).toBe(SEAT_COLORS[1])
    expect(view.map((p) => p.avatar)).toEqual(['orbital-eyes', 'single-line'])
    expect(view.map((p) => p.skin)).toEqual(['cavanhaque', 'astronauta'])
    expect(view[0].you).toBe(false)
    expect(view[1].you).toBe(true)
  })
})
