// Reconciliação de presença ao REASSUMIR autoridade (041, FR-021/022 — data-model, D7 do
// plan). O host que reabre a sala pelo snapshot não pode confiar no `connected` persistido —
// é um retrato de ANTES da queda. `open()` reconcilia contra a presença REAL observada e só
// então decide pausa: nunca `pause` seguido de `resume` na mesma reassunção.
import { describe, expect, it } from 'vitest'
import { createClient, type Client } from '@/net/client'
import { createHost, type Host } from '@/net/host'
import { LocalHub, localTransport } from '@/net/localTransport'
import { createRoom, SEAT_COLORS, type Room } from '@/net/room'
import type { AcceptedCommand } from '@/net/transport'
import { mulberry32 } from '../sim/engine/rng'

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

interface Setup {
  hub: LocalHub
  host: Host
  hostClient: Client
  ana: Client
  bob: Client
  room: Room
}

// Sala com host + 2 convidados, partida iniciada — snapshot persistido para o "reload" ler.
async function setup(): Promise<Setup> {
  const hub = new LocalHub()
  const hostTransport = localTransport(hub, 'tok-host')
  const hostClient = createClient(hostTransport)
  await hostClient.join()
  const host = createHost(hostTransport, createRoom('r1', { token: 'tok-host', name: 'Host', color: SEAT_COLORS[0] }), {
    rng: mulberry32(9),
    now: () => 1_000,
  })
  await host.open()

  const ana = createClient(localTransport(hub, 'tok-a'))
  await ana.join()
  ana.requestJoin({ name: 'Ana', color: SEAT_COLORS[1] })
  await flush()

  const bob = createClient(localTransport(hub, 'tok-b'))
  await bob.join()
  bob.requestJoin({ name: 'Bob', color: SEAT_COLORS[2] })
  await flush()

  await host.startMatch()
  await flush()

  return { hub, host, hostClient, ana, bob, room: host.room() }
}

// Simula o host "indo embora": para os laços do host atual E derruba a conexão do host no
// hub (senão a conexão antiga continuaria "presente" para sempre, mascarando o cenário).
function hostGoesAway(s: Setup): void {
  s.host.stop()
  s.hostClient.leave()
}

// Reassume com um transporte NOVO (mesmo token) — o que uma aba recarregada faz de verdade.
// Conecta o CLIENT do próprio host primeiro (mesma ordem de `roomSession.ts`: o `join()`
// sempre roda antes do `host.open()`) — senão o próprio host apareceria "ausente" na
// reconciliação de presença.
async function reassume(s: Setup): Promise<{ host: Host; broadcasts: string[] }> {
  const spy = localTransport(s.hub, 'tok-spy')
  await spy.connect()
  const broadcasts: string[] = []
  spy.onBroadcast((cmd: AcceptedCommand) => broadcasts.push(cmd.action.kind))

  const revivedTransport = localTransport(s.hub, 'tok-host')
  await createClient(revivedTransport).join()

  const revived = createHost(revivedTransport, { id: 'r1', status: 'lobby', seats: [] }, {
    rng: mulberry32(9),
    now: () => 5_000,
  })
  await revived.open()
  return { host: revived, broadcasts }
}

describe('reconciliação de presença ao reassumir (041, FR-021/022)', () => {
  it('ninguém mudou: reassumir não pausa nem emite comando de sistema', async () => {
    const s = await setup()
    hostGoesAway(s)
    // Ana e Bob seguem conectados o tempo todo.

    const { host, broadcasts } = await reassume(s)
    expect(host.game().paused).toBeNull()
    expect(broadcasts).toEqual([])
  })

  it('alguém saiu durante a ausência: reassumir pausa NOMEANDO essa pessoa', async () => {
    const s = await setup()
    hostGoesAway(s)
    s.bob.leave() // cai enquanto o host está fora

    const { host, broadcasts } = await reassume(s)
    expect(host.game().paused?.causes).toEqual(['disconnect'])
    const bobSeat = host.room().seats.find((seat) => seat.playerId === s.bob.playerId())!
    expect(bobSeat.connected).toBe(false)
    expect(broadcasts).toEqual(['pause']) // só pause — nunca pause seguido de resume (FR-022)
  })

  it('alguém voltou durante a ausência: reassumir NÃO fica pausada', async () => {
    const s = await setup()
    s.bob.leave() // cai ANTES do host ir embora — snapshot persiste com bob desconectado
    await flush()
    expect(s.host.game().paused).not.toBeNull() // pausou normalmente, com o host presente

    hostGoesAway(s)
    const backAgain = createClient(localTransport(s.hub, 'tok-b')) // bob reconecta durante a ausência
    await backAgain.join()

    const { host, broadcasts } = await reassume(s)
    expect(host.game().paused).toBeNull()
    expect(broadcasts).toEqual(['resume']) // só resume — nunca pause seguido de resume
  })

  it('ambos: quem saiu deixa a mesa pausada nomeando-o, mesmo com outra volta no meio', async () => {
    const s = await setup()
    s.bob.leave()
    await flush()
    expect(s.host.game().paused?.causes).toEqual(['disconnect'])

    hostGoesAway(s)
    const bobVolta = createClient(localTransport(s.hub, 'tok-b'))
    await bobVolta.join() // bob volta...
    s.ana.leave() // ...mas ana cai, também durante a ausência do host

    const { host, broadcasts } = await reassume(s)
    const anaSeat = host.room().seats.find((seat) => seat.playerId === s.ana.playerId())!
    expect(anaSeat.connected).toBe(false)
    expect(host.game().paused?.causes).toEqual(['disconnect']) // segue pausada — agora por causa da ana
    // O saldo líquido é "seguir pausado" (bob resolvido, ana nova causa) — uma única decisão,
    // nunca uma sequência pause→resume→pause na mesma reassunção.
    expect(broadcasts).toEqual([])
  })
})
