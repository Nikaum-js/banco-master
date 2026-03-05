// BOOT DA SALA, headless — card 5 do review de arquitetura.
//
// Antes, `OnlineGate.tsx` instanciava `createSupabaseTransport` direto (linha 106), então a
// seam de transporte não alcançava o boot: a máquina de fases, a decisão de autoridade, a
// escada de validade de entrada e a regra "isto é reconexão" só eram exercitáveis por
// Playwright contra infra viva. Com o transporte entrando por parâmetro, tudo isso roda
// sobre o `localTransport` — síncrono e determinístico.
import { describe, expect, it } from 'vitest'
import { createRoomSession, type RoomSession, type SessionIdentity } from '@/net/roomSession'
import { LocalHub, localTransport } from '@/net/localTransport'
import { createRoom, joinRoom, startGame, SEAT_COLORS } from '@/net/room'
import { createHost } from '@/net/host'
import type { Client } from '@/net/client'
import { mulberry32 } from '../sim/engine/rng'

const ANA: SessionIdentity = { name: 'Ana', color: SEAT_COLORS[0] }
const BRUNO: SessionIdentity = { name: 'Bruno', color: SEAT_COLORS[1] }

// Uma sessão ligada ao hub in-memory. `connectStore` é um espião: o boot não deve depender
// do Zustand para funcionar.
function makeSession(
  hub: LocalHub,
  uid: string,
  timing: {
    openingAuctionMs?: number
    openingRollMs?: number
    revealMs?: number
    now?: () => number
  } = {},
): { session: RoomSession; connected: () => number; client: () => Client | null } {
  let connects = 0
  let client: Client | null = null
  const session = createRoomSession({
    createTransport: () => localTransport(hub, uid),
    connectStore: (c) => {
      connects += 1
      client = c
      return () => {}
    },
    newRoomId: () => 'sala-fixa',
    hostOptions: {
      rng: mulberry32(7),
      now: timing.now ?? (() => 1_000),
      openingAuctionMs: timing.openingAuctionMs ?? 0,
      openingRollMs: timing.openingRollMs ?? 0,
    },
    revealMs: timing.revealMs ?? 0,
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
  it('uid sem assento cai na tela de identidade', async () => {
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

  it('041/D-033: uid desconhecido depois do início oferece reentrada por código, não erro', async () => {
    const hub = new LocalHub()
    // Sala já em partida, montada direto pelo host.
    let room = createRoom('sala-fixa', { uid: 'tok-host', ...ANA })
    const j = joinRoom(room, { uid: 'tok-b', ...BRUNO })
    if (!j.ok) throw new Error(j.reason)
    const st = startGame(j.room)
    if (!st.ok) throw new Error(st.reason)
    room = st.room
    const host = createHost(localTransport(hub, 'tok-host'), room, { rng: mulberry32(1), now: () => 1000 })
    await host.start()

    const intruso = makeSession(hub, 'tok-intruso')
    await intruso.session.enter('sala-fixa')

    // Antes disto era beco (`fail('already-started')`) — D-033 troca por um formulário: quem
    // perdeu o aparelho não fica travado, apresenta link + código do próprio assento.
    expect(intruso.session.getState().phase).toBe('reentry')
  })

  it('FR-015: o host reabrindo o link reassume a autoridade', async () => {
    const hub = new LocalHub()
    const anfitriao = makeSession(hub, 'tok-host')
    await anfitriao.session.create(ANA)

    // Nova aba, MESMO uid (F5 do anfitrião).
    const reaberto = makeSession(hub, 'tok-host')
    await reaberto.session.enter('sala-fixa')

    expect(reaberto.session.getState().isHost).toBe(true)
    expect(reaberto.session.getState().phase).toBe('lobby')
  })
})

describe('createRoomSession — início da partida', () => {
  it('com 2 assentos, coleta lances e todos entram sozinhos após a revelação', async () => {
    const hub = new LocalHub()
    const anfitriao = makeSession(hub, 'tok-host', { openingAuctionMs: 15_000, revealMs: 20 })
    await anfitriao.session.create(ANA)
    const convidado = makeSession(hub, 'tok-guest', { revealMs: 20 })
    await convidado.session.enter('sala-fixa')
    convidado.session.requestSeat(BRUNO)

    await anfitriao.session.startMatch()

    expect(anfitriao.session.getState().phase).toBe('auction')
    expect(convidado.session.getState().phase).toBe('auction')
    anfitriao.session.submitOpeningBid(200)
    convidado.session.submitOpeningBid(500)

    for (let i = 0; i < 20 && anfitriao.session.getState().phase !== 'reveal'; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
    expect(anfitriao.session.getState().phase).toBe('reveal')
    expect(convidado.session.getState().phase).toBe('reveal')
    expect(anfitriao.session.getState().room?.seats.map((seat) => [seat.name, seat.openingBid])).toEqual([
      ['Bruno', 500],
      ['Ana', 200],
    ])
    expect(anfitriao.connected()).toBe(1)
    expect(convidado.connected()).toBe(1)

    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    expect(anfitriao.session.getState().phase).toBe('playing')
    expect(convidado.session.getState().phase).toBe('playing')
  })

  it('host seleciona Maior dado no lobby e convidados apenas observam', async () => {
    const hub = new LocalHub()
    const anfitriao = makeSession(hub, 'tok-host', { revealMs: 20 })
    await anfitriao.session.create(ANA)
    const convidado = makeSession(hub, 'tok-guest', { revealMs: 20 })
    await convidado.session.enter('sala-fixa')
    convidado.session.requestSeat(BRUNO)

    anfitriao.session.setOpeningMode('dice-roll')
    expect(anfitriao.session.getState().room?.openingMode).toBe('dice-roll')
    expect(convidado.session.getState().room?.openingMode).toBe('dice-roll')

    convidado.session.setOpeningMode('sealed-bid')
    expect(anfitriao.session.getState().room?.openingMode).toBe('dice-roll')

    await anfitriao.session.startMatch()
    expect(anfitriao.session.getState().phase).toBe('rolling')
    expect(convidado.session.getState().phase).toBe('rolling')
    expect(anfitriao.session.getState().room?.seats.every((seat) => seat.openingRoll === null)).toBe(true)

    convidado.session.submitOpeningRoll()
    expect(anfitriao.session.getState().room?.seats.every((seat) => seat.openingRollResolvesAt == null)).toBe(true)

    anfitriao.session.submitOpeningRoll()
    expect(convidado.session.getState().room?.seats[0].openingRollResolvesAt).toBe(1_000)
    anfitriao.session.tick()
    expect(anfitriao.session.getState().phase).toBe('rolling')
    expect(anfitriao.session.getState().room?.seats[0].openingRoll).not.toBeNull()

    convidado.session.submitOpeningRoll()
    anfitriao.session.tick()
    for (let i = 0; i < 20 && anfitriao.session.getState().phase !== 'reveal'; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
    expect(anfitriao.session.getState().phase).toBe('reveal')
    expect(convidado.session.getState().phase).toBe('reveal')
    expect(anfitriao.session.getState().room?.seats.every((seat) => seat.openingRoll !== null)).toBe(true)
    expect(anfitriao.client()?.game()?.players.map((player) => player.cash)).toEqual([2_000, 2_000])
    expect(anfitriao.client()?.game()?.centerPot).toBe(500)

    await new Promise<void>((resolve) => setTimeout(resolve, 25))
    expect(anfitriao.session.getState().phase).toBe('playing')
    expect(convidado.session.getState().phase).toBe('playing')
  })

  it('comando sistêmico no arranque não faz uma sessão do lobby pular a revelação', async () => {
    const hub = new LocalHub()
    const anfitriao = makeSession(hub, 'tok-host', { revealMs: 20 })
    await anfitriao.session.create(ANA)
    const convidado = makeSession(hub, 'tok-guest', { revealMs: 20 })
    await convidado.session.enter('sala-fixa')
    convidado.session.requestSeat(BRUNO)
    anfitriao.session.setOpeningMode('dice-roll')

    // A ausência no instante do start gera `pause` logo depois do snapshot inicial e pode
    // elevar `seq` acima de zero antes de a sessão consumir o jogo. Isso é arranque, não
    // reconexão: quem já estava no lobby ainda precisa ver o Ritual de Largada.
    await anfitriao.session.startMatch()
    anfitriao.session.submitOpeningRoll()
    anfitriao.session.tick()
    convidado.session.submitOpeningRoll()
    hub.dropChannel('tok-guest')
    anfitriao.session.tick()

    for (let i = 0; i < 20 && (anfitriao.client()?.seq() ?? -1) <= 0; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
    expect(anfitriao.client()?.seq()).toBeGreaterThan(0)
    expect(anfitriao.session.getState().phase).toBe('reveal')
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
    // A ordem de turno vem do leilão; emitir dos dois segue seguro porque o host valida o ator.
    // Emitir dos dois é seguro: o host descarta quem não é o ator (FR-007, no-op).
    anfitriao.client()!.send({ kind: 'roll' })
    convidado.client()!.send({ kind: 'roll' })

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
