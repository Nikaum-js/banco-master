// BOOT DA SALA, headless — card 5 do review de arquitetura.
//
// Antes, `OnlineGate.tsx` instanciava `createSupabaseTransport` direto (linha 106), então a
// seam de transporte não alcançava o boot: a máquina de fases, a decisão de autoridade, a
// escada de validade de entrada e a regra "isto é reconexão" só eram exercitáveis por
// Playwright contra infra viva. Com o transporte entrando por parâmetro, tudo isso roda
// sobre o `localTransport` — síncrono e determinístico.
import { describe, expect, it } from 'vitest'
import { createRoomSession, type RoomSession } from '@/net/roomSession'
import { LocalHub, localTransport } from '@/net/localTransport'
import { createRoom, joinRoom, startGame, SEAT_COLORS } from '@/net/room'
import { createHost } from '@/net/host'
import type { Client } from '@/net/client'
import { mulberry32 } from '../sim/engine/rng'

const ANA = { name: 'Ana', color: SEAT_COLORS[0], piece: 'cartola' }
const BRUNO = { name: 'Bruno', color: SEAT_COLORS[1], piece: 'navio' }

// Uma sessão ligada ao hub in-memory. `connectStore` é um espião: o boot não deve depender
// do Zustand para funcionar.
function makeSession(hub: LocalHub, token: string): { session: RoomSession; connected: () => number; client: () => Client | null } {
  let connects = 0
  let client: Client | null = null
  const session = createRoomSession({
    token,
    createTransport: (_roomId, tok) => localTransport(hub, tok),
    connectStore: (c) => {
      connects += 1
      client = c
      return () => {}
    },
    newRoomId: () => 'sala-fixa',
  })
  return { session, connected: () => connects, client: () => client }
}

describe('createRoomSession — criar sala', () => {
  it('cria, assume a autoridade e para no lobby', async () => {
    const hub = new LocalHub()
    const { session } = makeSession(hub, 'tok-host')

    const id = await session.create(ANA)

    expect(id).toBe('sala-fixa')
    const s = session.getState()
    expect(s.phase).toBe('lobby')
    expect(s.isHost).toBe(true)
    expect(s.busy).toBe(false)
    expect(s.room?.seats).toHaveLength(1)
    expect(s.room?.seats[0].name).toBe('Ana')
  })

  it('falha de infra vira fase de erro, com a mensagem traduzida', async () => {
    const session = createRoomSession({
      token: 'tok-host',
      createTransport: () => { throw new Error('relation "rooms" does not exist') },
      connectStore: () => () => {},
      describeError: (e) => `traduzido: ${(e as Error).message}`,
    })

    expect(await session.create(ANA)).toBeNull()
    expect(session.getState().phase).toBe('error')
    expect(String(session.getState().error)).toContain('traduzido:')
    expect(session.getState().busy).toBe(false) // não trava o botão
  })
})

describe('createRoomSession — entrar por link', () => {
  it('token sem assento cai na tela de identidade', async () => {
    const hub = new LocalHub()
    const anfitriao = makeSession(hub, 'tok-host')
    await anfitriao.session.create(ANA)

    const convidado = makeSession(hub, 'tok-guest')
    await convidado.session.enter('sala-fixa')

    expect(convidado.session.getState().phase).toBe('identity')
    expect(convidado.session.getState().isHost).toBe(false)
  })

  it('pedir assento libera o busy quando a RESPOSTA chega (sem timer)', async () => {
    const hub = new LocalHub()
    const anfitriao = makeSession(hub, 'tok-host')
    await anfitriao.session.create(ANA)

    const convidado = makeSession(hub, 'tok-guest')
    await convidado.session.enter('sala-fixa')
    convidado.session.requestSeat(BRUNO)

    // Entrega síncrona no hub: o assento já voltou. Antes, o `busy` só caía por um
    // `setTimeout(400)` — correlação por relógio, não por resposta.
    expect(convidado.session.getState().busy).toBe(false)
    expect(convidado.session.getState().phase).toBe('lobby')
    expect(convidado.session.getState().room?.seats).toHaveLength(2)
  })

  it('link de sala inexistente vira erro acionável', async () => {
    const hub = new LocalHub()
    const { session } = makeSession(hub, 'tok-guest')
    await session.enter('nao-existe')
    expect(session.getState().phase).toBe('error')
    expect(String(session.getState().error)).toContain('Sala não encontrada')
  })

  it('FR-005: token desconhecido não entra depois do início', async () => {
    const hub = new LocalHub()
    // Sala já em partida, montada direto pelo host.
    let room = createRoom('sala-fixa', { token: 'tok-host', ...ANA })
    const j = joinRoom(room, { token: 'tok-b', ...BRUNO })
    if (!j.ok) throw new Error(j.reason)
    const st = startGame(j.room)
    if (!st.ok) throw new Error(st.reason)
    room = st.room
    const host = createHost(localTransport(hub, 'tok-host'), room, { rng: mulberry32(1), now: () => 1000 })
    await host.start()

    const intruso = makeSession(hub, 'tok-intruso')
    await intruso.session.enter('sala-fixa')

    expect(intruso.session.getState().phase).toBe('error')
    expect(intruso.session.getState().error).toBe('already-started')
  })

  it('FR-015: o host reabrindo o link reassume a autoridade', async () => {
    const hub = new LocalHub()
    const anfitriao = makeSession(hub, 'tok-host')
    await anfitriao.session.create(ANA)

    // Nova aba, MESMO token (F5 do anfitrião).
    const reaberto = makeSession(hub, 'tok-host')
    await reaberto.session.enter('sala-fixa')

    expect(reaberto.session.getState().isHost).toBe(true)
    expect(reaberto.session.getState().phase).toBe('lobby')
  })
})

describe('createRoomSession — início da partida', () => {
  it('com 2 assentos, inicia e mostra a ordem sorteada uma vez (FR-030)', async () => {
    const hub = new LocalHub()
    const anfitriao = makeSession(hub, 'tok-host')
    await anfitriao.session.create(ANA)
    const convidado = makeSession(hub, 'tok-guest')
    await convidado.session.enter('sala-fixa')
    convidado.session.requestSeat(BRUNO)

    await anfitriao.session.startMatch()

    // Quem estava presente no início vê o ritual; o store é ligado nos dois.
    expect(anfitriao.session.getState().phase).toBe('order')
    expect(convidado.session.getState().phase).toBe('order')
    expect(anfitriao.connected()).toBe(1)
    expect(convidado.connected()).toBe(1)

    anfitriao.session.orderSeen()
    expect(anfitriao.session.getState().phase).toBe('playing')
  })

  it('com 1 assento, recusa com mensagem e sem travar o botão', async () => {
    const hub = new LocalHub()
    const { session } = makeSession(hub, 'tok-host')
    await session.create(ANA)

    await session.startMatch()

    expect(session.getState().phase).toBe('lobby')
    expect(String(session.getState().error)).toContain('ao menos 2')
    expect(session.getState().busy).toBe(false)
  })

  it('quem RECONECTA no meio da partida volta direto ao tabuleiro, sem o ritual', async () => {
    const hub = new LocalHub()
    const anfitriao = makeSession(hub, 'tok-host')
    await anfitriao.session.create(ANA)
    const convidado = makeSession(hub, 'tok-guest')
    await convidado.session.enter('sala-fixa')
    convidado.session.requestSeat(BRUNO)
    await anfitriao.session.startMatch()

    // Um comando aceito avança o `seq` acima de 0 — a marca de "partida em andamento".
    // No snapshot inicial (seq 0) ninguém jogou ainda, e aí o ritual É devido.
    anfitriao.session.orderSeen()
    anfitriao.client()!.send({ kind: 'roll' })

    const reconectado = makeSession(hub, 'tok-guest')
    await reconectado.session.enter('sala-fixa')

    expect(reconectado.session.getState().phase).toBe('playing')
  })
})

describe('createRoomSession — remoção no lobby (FR-024)', () => {
  it('o host remove um convidado', async () => {
    const hub = new LocalHub()
    const anfitriao = makeSession(hub, 'tok-host')
    await anfitriao.session.create(ANA)
    const convidado = makeSession(hub, 'tok-guest')
    await convidado.session.enter('sala-fixa')
    convidado.session.requestSeat(BRUNO)
    expect(anfitriao.session.getState().room?.seats).toHaveLength(2)

    anfitriao.session.kick('tok-guest')

    expect(anfitriao.session.getState().room?.seats).toHaveLength(1)
  })

  it('o anfitrião não pode remover a si mesmo', async () => {
    const hub = new LocalHub()
    const { session } = makeSession(hub, 'tok-host')
    await session.create(ANA)

    session.kick('tok-host')

    expect(String(session.getState().error)).toContain('não pode se remover')
    expect(session.getState().room?.seats).toHaveLength(1)
  })
})
