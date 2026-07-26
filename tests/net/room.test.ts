// FR-001..006a — reducers puros da sala: cor única, nome livre, sala cheia, recusa pós-início,
// reattach pelo uid.
import { describe, expect, it } from 'vitest'
import { createRoom, joinRoom, reattach, startGame, SEAT_COLORS, MAX_SEATS, playerIdsInOrder } from '@/net/room'

const host = { uid: 'h', name: 'Nik', color: SEAT_COLORS[0] }

describe('sala e identidade', () => {
  it('host cria a sala e ocupa o 1º assento (FR-001)', () => {
    const room = createRoom('r1', host)
    expect(room.seats).toHaveLength(1)
    expect(room.seats[0]).toMatchObject({ playerId: 'p1', isHost: true, connected: true })
  })

  it('cor é única por sala; duplicata é recusada (§12.5)', () => {
    const room = createRoom('r1', host)
    const dup = joinRoom(room, { uid: 'g', name: 'Amigo', color: SEAT_COLORS[0] })
    expect(dup).toEqual({ ok: false, reason: 'color-taken' })
    const ok = joinRoom(room, { uid: 'g', name: 'Amigo', color: SEAT_COLORS[1] })
    expect(ok.ok).toBe(true)
  })

  it('nome duplicado é permitido (Clarifications)', () => {
    const room = createRoom('r1', host)
    const same = joinRoom(room, { uid: 'g', name: 'Nik', color: SEAT_COLORS[1] })
    expect(same.ok).toBe(true)
  })

  it('sala cheia (8) recusa o 9º (§11.1)', () => {
    let room = createRoom('r1', host)
    for (let i = 1; i < MAX_SEATS; i++) {
      const r = joinRoom(room, { uid: `g${i}`, name: `G${i}`, color: SEAT_COLORS[i] })
      expect(r.ok).toBe(true)
      if (r.ok) room = r.room
    }
    expect(room.seats).toHaveLength(MAX_SEATS)
    const ninth = joinRoom(room, { uid: 'g9', name: 'G9', color: SEAT_COLORS[0] })
    expect(ninth).toEqual({ ok: false, reason: 'room-full' })
  })

  it('após o início, uid DESCONHECIDO é recusado (FR-005, §11.2)', () => {
    let room = createRoom('r1', host)
    const g = joinRoom(room, { uid: 'g', name: 'G', color: SEAT_COLORS[1] })
    if (g.ok) room = g.room
    const started = startGame(room)
    expect(started.ok).toBe(true)
    if (started.ok) room = started.room
    const stranger = joinRoom(room, { uid: 'x', name: 'X', color: SEAT_COLORS[2] })
    expect(stranger).toEqual({ ok: false, reason: 'already-started' })
  })

  it('uid JÁ assentado re-anexa ao mesmo assento, antes e depois do início (FR-004)', () => {
    let room = createRoom('r1', host)
    const g = joinRoom(room, { uid: 'g', name: 'G', color: SEAT_COLORS[1] })
    if (g.ok) room = g.room
    const started = startGame(room)
    if (started.ok) room = started.room
    const back = reattach(room, 'g')
    expect(back.ok).toBe(true)
    if (back.ok) expect(back.seat.playerId).toBe('p2')
    const unknown = reattach(room, 'zzz')
    expect(unknown).toEqual({ ok: false, reason: 'unknown-uid' })
  })

  it('start exige 2+ jogadores; ordem de turno = ordem de entrada (FR-006)', () => {
    const solo = createRoom('r1', host)
    expect(startGame(solo)).toEqual({ ok: false, reason: 'too-few' })
    const g = joinRoom(solo, { uid: 'g', name: 'G', color: SEAT_COLORS[1] })
    const room = g.ok ? g.room : solo
    expect(playerIdsInOrder(room)).toEqual(['p1', 'p2'])
  })
})
