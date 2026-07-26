// `durableWrites` — decorator de transporte (041, data-model §5 / D8 do plan). As seis
// invariantes da fila de gravação, isoladas do host: `sleep` é injetado, o teste não espera
// de verdade (D-034 exige determinismo — nenhuma parte nova consome relógio real).
import { describe, expect, it, vi } from 'vitest'
import { durableWrites, type DurableWriteOptions } from '@/net/durableWrites'
import type { PersistedSnapshot, Transport } from '@/net/transport'
import type { Room } from '@/net/room'

function snap(seq: number): PersistedSnapshot {
  return { seq, game: {} as never, room: {} as never }
}

function stubTransport() {
  const saveSnapshot = vi.fn<(snap: PersistedSnapshot) => Promise<void>>()
  const saveRoom = vi.fn<(room: Room) => Promise<void>>()
  const inner: Transport = {
    token: 't',
    connect: () => Promise.resolve(),
    disconnect: () => {},
    submit: () => {},
    onSubmit: () => () => {},
    broadcast: () => {},
    onBroadcast: () => () => {},
    requestJoin: () => {},
    onJoinRequest: () => () => {},
    rejectJoin: () => {},
    onJoinRejected: () => () => {},
    rejectCommand: () => {},
    onCommandRejected: () => () => {},
    publishRoom: () => {},
    onRoom: () => () => {},
    saveRoom,
    loadRoom: () => Promise.resolve(null),
    onPresence: () => () => {},
    onStatus: () => () => {},
    onPresenceSync: () => () => {},
    saveSnapshot,
    loadSnapshot: () => Promise.resolve(null),
    onWriteExhausted: () => () => {},
    onWriteRecovered: () => () => {},
  }
  return { inner, saveSnapshot, saveRoom }
}

function makeOpts(overrides: Partial<DurableWriteOptions> = {}): DurableWriteOptions {
  return {
    retries: 3,
    sleep: () => Promise.resolve(),
    backoff: () => 0,
    onExhausted: vi.fn(),
    onRecovered: vi.fn(),
    ...overrides,
  }
}

// Deixa a recursão interna da fila (que roda por `.then` de promessas já resolvidas, sem
// timer real) drenar antes de asserir.
async function tick(n = 10): Promise<void> {
  for (let i = 0; i < n; i++) await Promise.resolve()
}

function deferred<T = void>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('durableWrites — invariantes (041, data-model §5)', () => {
  it('1. nunca mais de uma escrita em voo: a 2ª chamada NÃO chama o adapter cru enquanto a 1ª não volta', async () => {
    const { inner, saveSnapshot } = stubTransport()
    const first = deferred<void>()
    saveSnapshot.mockReturnValueOnce(first.promise)
    const t = durableWrites(inner, makeOpts())

    await t.saveSnapshot(snap(1))
    expect(saveSnapshot).toHaveBeenCalledTimes(1) // a 1ª entra em voo na hora

    await t.saveSnapshot(snap(2))
    expect(saveSnapshot).toHaveBeenCalledTimes(1) // NENHUMA chamada nova enquanto em voo

    first.resolve()
    await tick()
    expect(saveSnapshot).toHaveBeenCalledTimes(2) // só depois de voltar
  })

  it('2. coalescing: várias pedidas durante o voo, só a ÚLTIMA sobrevive', async () => {
    const { inner, saveSnapshot } = stubTransport()
    const first = deferred<void>()
    saveSnapshot.mockReturnValueOnce(first.promise)
    const t = durableWrites(inner, makeOpts())

    await t.saveSnapshot(snap(1))
    await t.saveSnapshot(snap(2)) // enfileira
    await t.saveSnapshot(snap(3)) // substitui a 2 — coalescida, nunca chega ao adapter
    expect(saveSnapshot).toHaveBeenCalledTimes(1)

    first.resolve()
    await tick()
    expect(saveSnapshot).toHaveBeenCalledTimes(2)
    expect(saveSnapshot).toHaveBeenLastCalledWith(snap(3))
  })

  it('3. escrita com seq MENOR que o já gravado é descartada SEM tentativa (FR-011)', async () => {
    const { inner, saveSnapshot } = stubTransport()
    saveSnapshot.mockResolvedValue(undefined)
    const t = durableWrites(inner, makeOpts())

    await t.saveSnapshot(snap(5))
    await tick()
    expect(saveSnapshot).toHaveBeenCalledTimes(1)

    await t.saveSnapshot(snap(3)) // regressiva
    await tick()
    expect(saveSnapshot).toHaveBeenCalledTimes(1) // não tentou de novo
  })

  it('4. onExhausted dispara UMA vez por episódio, não por tentativa', async () => {
    const { inner, saveSnapshot } = stubTransport()
    saveSnapshot.mockRejectedValue(new Error('fail'))
    const onExhausted = vi.fn()
    const t = durableWrites(inner, makeOpts({ retries: 2, onExhausted }))

    await t.saveSnapshot(snap(1))
    await tick(20)

    expect(saveSnapshot).toHaveBeenCalledTimes(3) // 1ª tentativa + 2 repetições
    expect(onExhausted).toHaveBeenCalledTimes(1)
  })

  it('5. onRecovered só dispara se onExhausted disparou antes', async () => {
    const { inner, saveSnapshot } = stubTransport()
    saveSnapshot.mockResolvedValue(undefined)
    const onRecovered = vi.fn()
    const t = durableWrites(inner, makeOpts({ onRecovered }))

    await t.saveSnapshot(snap(1)) // sucesso direto — nunca esgotou
    await tick()
    expect(onRecovered).not.toHaveBeenCalled()
  })

  it('5b. onRecovered dispara exatamente uma vez após esgotar e voltar', async () => {
    const { inner, saveSnapshot } = stubTransport()
    saveSnapshot.mockRejectedValue(new Error('fail'))
    const onExhausted = vi.fn()
    const onRecovered = vi.fn()
    const t = durableWrites(inner, makeOpts({ retries: 0, onExhausted, onRecovered }))

    await t.saveSnapshot(snap(1))
    await tick(10)
    expect(onExhausted).toHaveBeenCalledTimes(1)

    saveSnapshot.mockResolvedValue(undefined)
    await t.saveSnapshot(snap(2))
    await tick(10)
    expect(onRecovered).toHaveBeenCalledTimes(1)
  })

  it('6. nenhuma rejeição escapa sem tratamento (FR-015) — a promessa devolvida nunca rejeita', async () => {
    const { inner, saveSnapshot } = stubTransport()
    saveSnapshot.mockRejectedValue(new Error('fail'))
    const t = durableWrites(inner, makeOpts({ retries: 0 }))

    await expect(t.saveSnapshot(snap(1))).resolves.toBeUndefined()
    await tick(10)
  })

  it('onWriteExhausted/onWriteRecovered (pub-sub) — o adapter cru nunca emite, quem emite é o decorator', async () => {
    const { inner, saveSnapshot } = stubTransport()
    saveSnapshot.mockRejectedValue(new Error('fail'))
    const t = durableWrites(inner, makeOpts({ retries: 0 }))

    const exhausted = vi.fn()
    const recovered = vi.fn()
    t.onWriteExhausted(exhausted)
    t.onWriteRecovered(recovered)

    await t.saveSnapshot(snap(1))
    await tick(10)
    expect(exhausted).toHaveBeenCalledTimes(1)

    saveSnapshot.mockResolvedValue(undefined)
    await t.saveSnapshot(snap(2))
    await tick(10)
    expect(recovered).toHaveBeenCalledTimes(1)
  })

  it('saveRoom passa pela MESMA fila (sem guarda de seq — D9)', async () => {
    const { inner, saveRoom } = stubTransport()
    const first = deferred<void>()
    saveRoom.mockReturnValueOnce(first.promise)
    const t = durableWrites(inner, makeOpts())

    const a: Room = { id: 'r', status: 'lobby', seats: [] }
    const b: Room = { id: 'r', status: 'playing', seats: [] }
    await t.saveRoom(a)
    await t.saveRoom(b) // coalesce — a `a` nunca chega ao adapter
    expect(saveRoom).toHaveBeenCalledTimes(1)

    first.resolve()
    await tick()
    expect(saveRoom).toHaveBeenCalledTimes(2)
    expect(saveRoom).toHaveBeenLastCalledWith(b)
  })
})
