import { describe, expect, it } from 'vitest'
import {
  OPENING_AUCTION_MS,
  allOpeningBidsLocked,
  createRoom,
  finalizeOpeningAuction,
  joinRoom,
  lockOpeningBid,
  normalizeRoom,
  openOpeningAuction,
  rollOpeningOrder,
  selectOpeningMode,
  SEAT_COLORS,
  toPublicRoom,
} from '@/net/room'

function roomWith(names: string[]) {
  let room = createRoom('r1', { uid: 'u1', name: names[0], color: SEAT_COLORS[0] })
  for (let i = 1; i < names.length; i++) {
    const joined = joinRoom(room, { uid: `u${i + 1}`, name: names[i], color: SEAT_COLORS[i] })
    if (!joined.ok) throw new Error(joined.reason)
    room = joined.room
  }
  return room
}

describe('Leilão da Largada — reducers da sala', () => {
  it('normaliza sala persistida antes da 045 sem inventar cobrança', () => {
    const legacy = {
      id: 'legada',
      status: 'lobby' as const,
      seats: [{
        playerId: 'p1',
        uid: 'u1',
        name: 'Ana',
        color: SEAT_COLORS[0],
        isHost: true,
        connected: true,
        reentryCode: '',
      }],
    }
    expect(normalizeRoom(legacy)).toMatchObject({
      openingMode: 'sealed-bid',
      openingAuction: null,
      seats: [{ openingBid: null, bidLocked: false, openingRoll: null }],
    })
  })

  it('host escolhe o modo somente no lobby e a seleção é pública', () => {
    const selected = selectOpeningMode(roomWith(['Ana', 'Bruno']), 'dice-roll')
    expect(selected.ok).toBe(true)
    if (!selected.ok) return
    expect(selected.room.openingMode).toBe('dice-roll')
    expect(toPublicRoom(selected.room).openingMode).toBe('dice-roll')

    const started = rollOpeningOrder(selected.room, () => 0)
    if (!started.ok) throw new Error(started.reason)
    expect(selectOpeningMode(started.room, 'sealed-bid')).toEqual({
      ok: false,
      reason: 'not-in-lobby',
    })
  })

  it('Maior dado rola dois d6 por assento e ordena pela soma', () => {
    const selected = selectOpeningMode(roomWith(['Ana', 'Bruno', 'Caio']), 'dice-roll')
    if (!selected.ok) throw new Error(selected.reason)
    const values = [0, 0, 0.99, 0.5, 0.5, 0.5]
    const done = rollOpeningOrder(selected.room, () => values.shift() ?? 0)
    if (!done.ok) throw new Error(done.reason)

    expect(done.room.status).toBe('playing')
    expect(done.room.seats.map((seat) => [seat.name, seat.openingRoll, seat.playerId])).toEqual([
      ['Bruno', [6, 4], 'p1'],
      ['Caio', [4, 4], 'p2'],
      ['Ana', [1, 1], 'p3'],
    ])
    expect(done.room.seats.every((seat) => seat.openingBid === null && !seat.bidLocked)).toBe(true)
  })

  it('Maior dado desempata apenas o grupo com a mesma soma pelo RNG da autoridade', () => {
    const selected = selectOpeningMode(roomWith(['Ana', 'Bruno', 'Caio']), 'dice-roll')
    if (!selected.ok) throw new Error(selected.reason)
    const values = [0.4, 0.4, 0.4, 0.4, 0, 0, 0]
    const done = rollOpeningOrder(selected.room, () => values.shift() ?? 0)
    if (!done.ok) throw new Error(done.reason)

    expect(done.room.seats.map((seat) => seat.name)).toEqual(['Bruno', 'Ana', 'Caio'])
    expect(done.room.seats.map((seat) => seat.openingRoll)).toEqual([[3, 3], [3, 3], [1, 1]])
  })

  it('Maior dado exige o modo correto e ao menos dois assentos', () => {
    expect(rollOpeningOrder(roomWith(['Ana', 'Bruno']), () => 0)).toEqual({
      ok: false,
      reason: 'wrong-mode',
    })
    const selected = selectOpeningMode(roomWith(['Ana']), 'dice-roll')
    if (!selected.ok) throw new Error(selected.reason)
    expect(rollOpeningOrder(selected.room, () => 0)).toEqual({ ok: false, reason: 'too-few' })
  })

  it.each([2, 3, 4, 5, 6, 7, 8])('Maior dado produz uma ordem total para %i jogadores', (count) => {
    const names = Array.from({ length: count }, (_, index) => `Jogador ${index + 1}`)
    const selected = selectOpeningMode(roomWith(names), 'dice-roll')
    if (!selected.ok) throw new Error(selected.reason)
    let draw = 0
    const done = rollOpeningOrder(selected.room, () => ((draw++ * 0.17) % 1))
    if (!done.ok) throw new Error(done.reason)

    const sums = done.room.seats.map((seat) => (seat.openingRoll?.[0] ?? 0) + (seat.openingRoll?.[1] ?? 0))
    expect(done.room.seats).toHaveLength(count)
    expect(new Set(done.room.seats.map((seat) => seat.playerId)).size).toBe(count)
    expect(sums).toEqual([...sums].sort((a, b) => b - a))
  })

  it('abre com prazo absoluto, limpa resíduos e fecha o lobby para novas entradas', () => {
    const room = roomWith(['Ana', 'Bruno'])
    const opened = openOpeningAuction(room, 10_000)
    expect(opened).toEqual({
      ok: true,
      room: expect.objectContaining({
        status: 'bidding',
        openingAuction: { closesAt: 10_000 },
      }),
    })
    if (!opened.ok) return
    expect(opened.room.seats.every((s) => s.openingBid === null && !s.bidLocked)).toBe(true)
    expect(joinRoom(opened.room, { uid: 'u3', name: 'Caio', color: SEAT_COLORS[2] })).toEqual({
      ok: false,
      reason: 'already-started',
    })
    expect(OPENING_AUCTION_MS).toBe(15_000)
  })

  it('exige ao menos dois assentos', () => {
    expect(openOpeningAuction(roomWith(['Ana']), 1)).toEqual({ ok: false, reason: 'too-few' })
  })

  it.each([-50, 25, 550, Number.NaN])('rejeita valor inválido %s', (amount) => {
    const opened = openOpeningAuction(roomWith(['Ana', 'Bruno']), 1)
    if (!opened.ok) throw new Error(opened.reason)
    expect(lockOpeningBid(opened.room, 'u1', amount)).toEqual({ ok: false, reason: 'invalid-bid' })
  })

  it('lacra uma vez por identidade real do assento', () => {
    const opened = openOpeningAuction(roomWith(['Ana', 'Bruno']), 1)
    if (!opened.ok) throw new Error(opened.reason)
    const locked = lockOpeningBid(opened.room, 'u2', 350)
    expect(locked.ok).toBe(true)
    if (!locked.ok) return
    expect(locked.room.seats[1]).toMatchObject({ openingBid: 350, bidLocked: true })
    expect(lockOpeningBid(locked.room, 'u2', 500)).toEqual({ ok: false, reason: 'already-locked' })
    expect(lockOpeningBid(locked.room, 'intruso', 500)).toEqual({ ok: false, reason: 'unknown-uid' })
  })

  it('não publica valores enquanto coleta, apenas quem já lacrou', () => {
    const opened = openOpeningAuction(roomWith(['Ana', 'Bruno']), 1)
    if (!opened.ok) throw new Error(opened.reason)
    const locked = lockOpeningBid(opened.room, 'u2', 350)
    if (!locked.ok) throw new Error(locked.reason)
    const publicRoom = toPublicRoom(locked.room)
    expect(publicRoom.seats[1]).toMatchObject({ openingBid: null, bidLocked: true })
    expect(JSON.stringify(publicRoom)).not.toContain('350')
  })

  it('fecha cedo só quando todos lacraram', () => {
    const opened = openOpeningAuction(roomWith(['Ana', 'Bruno']), 1)
    if (!opened.ok) throw new Error(opened.reason)
    const one = lockOpeningBid(opened.room, 'u1', 100)
    if (!one.ok) throw new Error(one.reason)
    expect(allOpeningBidsLocked(one.room)).toBe(false)
    const two = lockOpeningBid(one.room, 'u2', 0)
    if (!two.ok) throw new Error(two.reason)
    expect(allOpeningBidsLocked(two.room)).toBe(true)
  })

  it('ordena por lance, completa ausência com $0 e publica o resultado', () => {
    const opened = openOpeningAuction(roomWith(['Ana', 'Bruno', 'Caio']), 1)
    if (!opened.ok) throw new Error(opened.reason)
    const a = lockOpeningBid(opened.room, 'u1', 100)
    if (!a.ok) throw new Error(a.reason)
    const b = lockOpeningBid(a.room, 'u2', 500)
    if (!b.ok) throw new Error(b.reason)
    const done = finalizeOpeningAuction(b.room, () => 0)
    expect(done.ok).toBe(true)
    if (!done.ok) return
    expect(done.room.status).toBe('playing')
    expect(done.room.openingAuction).toBeNull()
    expect(done.room.seats.map((s) => [s.name, s.openingBid, s.playerId])).toEqual([
      ['Bruno', 500, 'p1'],
      ['Ana', 100, 'p2'],
      ['Caio', 0, 'p3'],
    ])
    expect(toPublicRoom(done.room).seats.map((s) => s.openingBid)).toEqual([500, 100, 0])
  })

  it('desempata somente dentro do mesmo valor com RNG injetado', () => {
    const opened = openOpeningAuction(roomWith(['Ana', 'Bruno', 'Caio']), 1)
    if (!opened.ok) throw new Error(opened.reason)
    let room = opened.room
    for (const uid of ['u1', 'u2', 'u3']) {
      const next = lockOpeningBid(room, uid, 200)
      if (!next.ok) throw new Error(next.reason)
      room = next.room
    }
    const done = finalizeOpeningAuction(room, () => 0)
    if (!done.ok) throw new Error(done.reason)
    expect(done.room.seats.map((s) => s.name)).toEqual(['Bruno', 'Caio', 'Ana'])
  })

  it.each([2, 3, 4, 5, 6, 7, 8])('Leilão secreto produz uma ordem total para %i jogadores', (count) => {
    const names = Array.from({ length: count }, (_, index) => `Jogador ${index + 1}`)
    const opened = openOpeningAuction(roomWith(names), 1)
    if (!opened.ok) throw new Error(opened.reason)
    let room = opened.room
    for (let index = 0; index < count; index++) {
      const locked = lockOpeningBid(room, `u${index + 1}`, (index % 6) * 50)
      if (!locked.ok) throw new Error(locked.reason)
      room = locked.room
    }
    const done = finalizeOpeningAuction(room, () => 0)
    if (!done.ok) throw new Error(done.reason)

    const bids = done.room.seats.map((seat) => seat.openingBid ?? 0)
    expect(done.room.seats).toHaveLength(count)
    expect(new Set(done.room.seats.map((seat) => seat.playerId)).size).toBe(count)
    expect(bids).toEqual([...bids].sort((a, b) => b - a))
  })
})
