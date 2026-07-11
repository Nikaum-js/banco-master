import { describe, expect, it } from 'vitest'
import { THEME } from '@/game/theme'
import { createHost } from '@/net/host'
import { LocalHub, localTransport } from '@/net/localTransport'
import { createRoom, joinRoom, selectOpeningMode, SEAT_COLORS, type PublicRoom } from '@/net/room'

// O caixa inicial é knob de balanceamento (D-076): estes testes são sobre a LIQUIDAÇÃO do
// leilão — cada um paga o próprio lance —, não sobre o valor de partida.
const C0 = THEME.INITIAL_CASH

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
  it('Maior dado aceita um dono por vez e só cria a partida depois do último resultado', async () => {
    const hub = new LocalHub()
    const hostTransport = localTransport(hub, 'u-host')
    const guestTransport = localTransport(hub, 'u-guest')
    await hostTransport.connect()
    await guestTransport.connect()
    const selected = selectOpeningMode(table(), 'dice-roll')
    if (!selected.ok) throw new Error(selected.reason)
    const values = [0, 0, 0.99, 0.99]
    let now = 1_000
    const host = createHost(hostTransport, selected.room, {
      rng: () => values.shift() ?? 0,
      now: () => now,
      openingRollMs: 1_400,
    })

    await host.open()
    expect(await host.startMatch()).toEqual({ ok: true })
    expect(host.room().status).toBe('rolling')
    expect(host.seq()).toBe(-1)

    guestTransport.submitOpeningRoll()
    expect(host.room().seats.every((seat) => seat.openingRollResolvesAt == null)).toBe(true)

    hostTransport.submitOpeningRoll()
    expect(host.room().seats[0]).toMatchObject({
      name: 'Ana',
      openingRoll: null,
      openingRollResolvesAt: 2_400,
    })
    now = 2_400
    host.tick()
    expect(host.room().status).toBe('rolling')
    expect(host.room().seats[0]).toMatchObject({ name: 'Ana', openingRoll: [1, 1] })
    expect(host.room().seats[1]).toMatchObject({ name: 'Bruno', openingRoll: null })

    guestTransport.submitOpeningRoll()
    now = 3_800
    host.tick()

    // O último resultado sai num snapshot ainda 'rolling' — a mesa vê o dado decisivo cair
    // antes de embarcar; o embarque só acontece quando a janela de revelação vence.
    expect(host.room().status).toBe('rolling')
    expect(host.room().seats[1]).toMatchObject({
      name: 'Bruno',
      openingRoll: [6, 6],
      openingRollResolvesAt: 6_400,
    })

    now = 6_400
    host.tick()
    await settleHost(host)

    expect(host.room().status).toBe('playing')
    expect(host.room().openingMode).toBe('dice-roll')
    expect(host.room().seats.map((seat) => [seat.name, seat.openingRoll])).toEqual([
      ['Bruno', [6, 6]],
      ['Ana', [1, 1]],
    ])
    expect(host.game().players.map((player) => player.cash)).toEqual([C0, C0])
    expect(host.game().centerPot).toBe(THEME.PARKING_SEED)
    expect(host.seq()).toBe(0)
  })

  it('reanexa a autoridade durante um arremesso e resolve a janela persistida uma vez', async () => {
    const hub = new LocalHub()
    const firstTransport = localTransport(hub, 'u-host')
    const guestTransport = localTransport(hub, 'u-guest')
    await firstTransport.connect()
    await guestTransport.connect()
    const selected = selectOpeningMode(table(), 'dice-roll')
    if (!selected.ok) throw new Error(selected.reason)
    let now = 1_000
    const first = createHost(firstTransport, selected.room, {
      rng: () => 0,
      now: () => now,
      openingRollMs: 1_400,
    })
    await first.open()
    await first.startMatch()
    firstTransport.submitOpeningRoll()
    first.stop()

    const revivedTransport = localTransport(hub, 'u-host')
    await revivedTransport.connect()
    const revived = createHost(revivedTransport, {
      id: 'mesa-leilao',
      status: 'lobby',
      seats: [],
    }, {
      rng: () => 0,
      now: () => now,
      openingRollMs: 1_400,
    })
    await revived.open()
    expect(revived.room().status).toBe('rolling')
    expect(revived.room().seats[0].openingRollResolvesAt).toBe(2_400)

    now = 2_400
    revived.tick()
    expect(revived.room().seats[0].openingRoll).toEqual([1, 1])
    expect(revived.room().seats[1].openingRoll).toBeNull()
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
    expect(host.game().players.map((player) => player.cash)).toEqual([C0 - 500, C0 - 200])
    expect(host.game().centerPot).toBe(THEME.PARKING_SEED + 700)
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
    expect(host.game().players.map((player) => player.cash)).toEqual([C0 - 300, C0])
    expect(host.game().centerPot).toBe(THEME.PARKING_SEED + 300)
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
    expect(revived.game().players.map((player) => player.cash)).toEqual([C0 - 400, C0 - 250])
    expect(revived.game().centerPot).toBe(THEME.PARKING_SEED + 650)
  })
})
