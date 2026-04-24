// `client.resync` — ressincronização com espera crescente (041, D11 do plan). Isolado do
// host: um transporte de teste com `loadSnapshot` controlável prova o comportamento sem
// precisar de uma queda de rede de verdade.
import { describe, expect, it, vi } from 'vitest'
import { createClient } from '@/net/client'
import type { PersistedSnapshot, Transport } from '@/net/transport'
import type { GameState } from '@/game/turn/types'
import { createSeedState } from '@/game/setup'
import { createRoom, SEAT_COLORS } from '@/net/room'

function stubTransport() {
  const statusCbs: ((s: 'connected' | 'reconnecting') => void)[] = []
  const loadSnapshot = vi.fn<() => Promise<PersistedSnapshot | null>>()
  const room = createRoom('r1', { uid: 't-a', name: 'Ana', color: SEAT_COLORS[0] })
  const inner: Transport = {
    uid: 't-a',
    connect: () => Promise.resolve(),
    disconnect: () => {},
    submit: () => {},
    onSubmit: () => () => {},
    broadcast: () => {},
    onBroadcast: () => () => {},
    broadcastPrivate: () => {},
    watchSeat: () => {},
    unwatchSeat: () => {},
    requestJoin: () => {},
    onJoinRequest: () => () => {},
    rejectJoin: () => {},
    onJoinRejected: () => () => {},
    publishRoom: () => {},
    onRoom: () => () => {},
    saveRoom: () => Promise.resolve(),
    loadRoom: () => Promise.resolve(room),
    onPresence: () => () => {},
    onStatus: (cb) => { statusCbs.push(cb); return () => {} },
    onPresenceSync: () => () => {},
    saveSnapshot: () => Promise.resolve(),
    loadSnapshot,
    onWriteExhausted: () => () => {},
    onWriteRecovered: () => () => {},
  }
  return { inner, loadSnapshot, emitStatus: (s: 'connected' | 'reconnecting') => statusCbs.forEach((cb) => cb(s)) }
}

function snapOf(seq: number): PersistedSnapshot {
  const game: GameState = createSeedState(['p1', 'p2'])
  const room = createRoom('r1', { uid: 't-a', name: 'Ana', color: SEAT_COLORS[0] })
  return { seq, game, room }
}

describe('client.resync — espera crescente, uma em voo, desistência honesta (041)', () => {
  it('SC-001: queda e volta de canal recupera e converge', async () => {
    const { inner, loadSnapshot, emitStatus } = stubTransport()
    loadSnapshot.mockResolvedValueOnce(null) // join(): ainda sem partida
    const client = createClient(inner, { sleep: () => Promise.resolve(), backoff: () => 0 })
    await client.join()

    loadSnapshot.mockResolvedValueOnce(snapOf(3))
    emitStatus('reconnecting')
    expect(client.connection()).toBe('reconnecting')
    emitStatus('connected')
    await vi.waitFor(() => expect(client.connection()).toBe('connected'))
    expect(client.seq()).toBe(3)
  })

  it('leitura falhando repete com espera e NÃO entra em laço infinito', async () => {
    const { inner, loadSnapshot, emitStatus } = stubTransport()
    loadSnapshot.mockResolvedValueOnce(null)
    const client = createClient(inner, { retries: 3, sleep: () => Promise.resolve(), backoff: () => 0 })
    await client.join()

    loadSnapshot
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(snapOf(5)) // recupera na 3ª tentativa

    emitStatus('reconnecting')
    emitStatus('connected')
    await vi.waitFor(() => expect(client.seq()).toBe(5))
    expect(client.connection()).toBe('connected')
    expect(loadSnapshot).toHaveBeenCalledTimes(1 + 3) // 1 (join, null) + 3 tentativas do resync
  })

  it('esgotamento vira "desynced"', async () => {
    const { inner, loadSnapshot, emitStatus } = stubTransport()
    loadSnapshot.mockResolvedValueOnce(null)
    const client = createClient(inner, { retries: 2, sleep: () => Promise.resolve(), backoff: () => 0 })
    await client.join()

    loadSnapshot.mockRejectedValue(new Error('fail'))
    emitStatus('connected')
    await vi.waitFor(() => expect(client.connection()).toBe('desynced'))
  })

  it('difusão chegada DURANTE a ressincronização é aplicada em ordem, não descartada', async () => {
    const { inner, loadSnapshot, emitStatus } = stubTransport()
    let broadcastCb: ((cmd: unknown) => void) | null = null
    inner.onBroadcast = (cb) => { broadcastCb = cb as (cmd: unknown) => void; return () => {} }
    loadSnapshot.mockResolvedValueOnce(null)
    const client = createClient(inner, { sleep: () => Promise.resolve(), backoff: () => 0 })
    await client.join()

    // A leitura do snapshot demora — uma difusão chega ENQUANTO ela está em voo.
    let resolveSnap!: (s: PersistedSnapshot | null) => void
    loadSnapshot.mockReturnValueOnce(new Promise((r) => { resolveSnap = r }))
    emitStatus('connected')

    broadcastCb!({ seq: 4, action: { kind: 'finalize' }, resolved: { rng: [], now: [] } }) // vira seq+1 sobre o snapshot ainda por vir → buffer
    resolveSnap(snapOf(3))

    await vi.waitFor(() => expect(client.seq()).toBe(4)) // a difusão bufferizada foi drenada, não perdida
    expect(client.connection()).toBe('connected')
  })
})
