import { describe, expect, it } from 'vitest'
import { createHost } from '@/net/host'
import { LocalHub, localTransport } from '@/net/localTransport'
import { createRoom, joinRoom, selectOpeningMode, SEAT_COLORS, type PublicRoom } from '@/net/room'

function table() {
  const base = createRoom('mesa-leilao', {
    uid: 'u-host',
    name: 'Ana',
    color: SEAT_COLORS[0],
  })
  const joined = joinRoom(base, {
    uid: 'u-guest',
    name: 'Bruno',
    color: SEAT_COLORS[1],
  })
  if (!joined.ok) throw new Error(joined.reason)
  return joined.room
}

async function settleHost(host: ReturnType<typeof createHost>): Promise<void> {
  for (let i = 0; i < 20 && host.seq() < 0; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
}

describe('Leilão da Largada — autoridade', () => {
  it('Maior dado cria a partida imediatamente sem cobrar caixa nem abastecer a Loteria', async () => {
    const hub = new LocalHub()
    const hostTransport = localTransport(hub, 'u-host')
    const guestTransport = localTransport(hub, 'u-guest')
    await hostTransport.connect()
    await guestTransport.connect()
    const selected = selectOpeningMode(table(), 'dice-roll')
    if (!selected.ok) throw new Error(selected.reason)
    const values = [0, 0, 0.99, 0.99]
    const host = createHost(hostTransport, selected.room, {
      rng: () => values.shift() ?? 0,
      now: () => 1_000,
    })

    await host.open()
    expect(await host.startMatch()).toEqual({ ok: true })

    expect(host.room().status).toBe('playing')
    expect(host.room().openingMode).toBe('dice-roll')
    expect(host.room().seats.map((seat) => [seat.name, seat.openingRoll])).toEqual([
      ['Bruno', [6, 6]],
      ['Ana', [1, 1]],
    ])
    expect(host.game().players.map((player) => player.cash)).toEqual([2_000, 2_000])
    expect(host.game().centerPot).toBe(500)
    expect(host.seq()).toBe(0)
  })

  it('coleta em sigilo, fecha cedo e inicia com ordem/saldos/pote liquidados', async () => {
    const hub = new LocalHub()
    const hostTransport = localTransport(hub, 'u-host')
    const guestTransport = localTransport(hub, 'u-guest')
    await hostTransport.connect()
    await guestTransport.connect()

    const host = createHost(hostTransport, table(), { rng: () => 0, now: () => 1_000 })
    const published: PublicRoom[] = []
    guestTransport.onRoom((room) => published.push(room))
    await host.open()
    await host.startMatch()

    hostTransport.submitOpeningBid(200)
    expect(host.room().status).toBe('bidding')
    expect(host.room().seats[0]).toMatchObject({ openingBid: 200, bidLocked: true })
    expect(published.at(-1)?.seats[0]).toMatchObject({ openingBid: null, bidLocked: true })
    expect(JSON.stringify(published.at(-1))).not.toContain('200')

    guestTransport.submitOpeningBid(500)
    await settleHost(host)

    expect(host.room().status).toBe('playing')
    expect(host.room().seats.map((seat) => [seat.name, seat.openingBid, seat.playerId])).toEqual([
      ['Bruno', 500, 'p1'],
      ['Ana', 200, 'p2'],
    ])
    expect(host.game().players.map((player) => player.cash)).toEqual([1_500, 1_800])
    expect(host.game().centerPot).toBe(1_200)
  })

  it('no prazo, converte quem não enviou em $0 e inicia sem ação do convidado', async () => {
    const hub = new LocalHub()
    const hostTransport = localTransport(hub, 'u-host')
    const guestTransport = localTransport(hub, 'u-guest')
    await hostTransport.connect()
    await guestTransport.connect()
    let now = 5_000
    const host = createHost(hostTransport, table(), { rng: () => 0, now: () => now })
    await host.open()
    await host.startMatch()
    hostTransport.submitOpeningBid(300)

    now += 15_000
    host.tick()
    await settleHost(host)

    expect(host.room().status).toBe('playing')
    expect(host.room().seats.map((seat) => [seat.name, seat.openingBid])).toEqual([
      ['Ana', 300],
      ['Bruno', 0],
    ])
    expect(host.game().players.map((player) => player.cash)).toEqual([1_700, 2_000])
    expect(host.game().centerPot).toBe(800)
  })

  it('reanexa a autoridade no meio da coleta sem revelar nem perder lances', async () => {
    const hub = new LocalHub()
    const firstHostTransport = localTransport(hub, 'u-host')
    const guestTransport = localTransport(hub, 'u-guest')
    await firstHostTransport.connect()
    await guestTransport.connect()
    const firstHost = createHost(firstHostTransport, table(), { rng: () => 0, now: () => 1_000 })
    await firstHost.open()
    await firstHost.startMatch()
    firstHostTransport.submitOpeningBid(250)
    firstHost.stop()

    const revivedTransport = localTransport(hub, 'u-host')
    await revivedTransport.connect()
    const revived = createHost(revivedTransport, {
      id: 'mesa-leilao',
      status: 'lobby',
      seats: [],
    }, { rng: () => 0, now: () => 2_000 })
    await revived.open()

    expect(revived.room().status).toBe('bidding')
    expect(revived.room().seats.find((seat) => seat.uid === 'u-host')).toMatchObject({
      openingBid: 250,
      bidLocked: true,
    })

    guestTransport.submitOpeningBid(400)
    await settleHost(revived)
    expect(revived.game().players.map((player) => player.cash)).toEqual([1_600, 1_750])
    expect(revived.game().centerPot).toBe(1_150)
  })
})
