// Fronteira de último recurso (spec 042, D-035, T004). `leaveOnFatalError` é o oposto
// deliberado de `dispose()` (roomSession.ts:246): dispose NÃO derruba a conexão (StrictMode,
// 037); isto DERRUBA de propósito, pra ausência chegar à mesa como desconexão (§11.3), sem
// causa de pausa nova.
import { describe, expect, it } from 'vitest'
import { createRoomSession, type RoomSession, type SessionIdentity } from '@/net/roomSession'
import { LocalHub, localTransport } from '@/net/localTransport'
import { SEAT_COLORS } from '@/net/room'
import { mulberry32 } from '../sim/engine/rng'

const ANA: SessionIdentity = { name: 'Ana', color: SEAT_COLORS[0] }
const BRUNO: SessionIdentity = { name: 'Bruno', color: SEAT_COLORS[1] }

// 043: a identidade não entra mais por parâmetro — quem a informa é o TRANSPORTE, que a
// obtém da sessão atestada. Aqui o hub local faz o papel, com o uid fixo do caso.
function makeSession(hub: LocalHub, uid: string): RoomSession {
  return createRoomSession({
    createTransport: () => localTransport(hub, uid),
    connectStore: () => () => {},
    newRoomId: () => 'sala-fixa',
    hostOptions: { rng: mulberry32(7), now: () => 1_000, openingAuctionMs: 0 },
    revealMs: 0,
  })
}

describe('roomSession.leaveOnFatalError (T004)', () => {
  it('encerra a presença — a mesa pausa por desconexão, nomeando quem caiu', async () => {
    const hub = new LocalHub()
    const anfitriao = makeSession(hub, 'tok-host')
    await anfitriao.create(ANA)
    const convidado = makeSession(hub, 'tok-guest')
    await convidado.enter('sala-fixa')
    convidado.requestSeat(BRUNO)
    await anfitriao.startMatch()

    convidado.leaveOnFatalError()

    const game = anfitriao.getState().room
    expect(game).not.toBeNull()
    // A pausa vive no GameState, não no Room — inspecionamos via host teria mais fricção
    // aqui; o sinal observável pela sessão do anfitrião é o assento marcado desconectado.
    const seat = anfitriao.getState().room?.seats.find((s) => s.uid === 'tok-guest')
    expect(seat?.connected).toBe(false)
  })

  it('é seguro chamar antes de qualquer entrada (boot, sem sessão de verdade)', () => {
    const hub = new LocalHub()
    const session = makeSession(hub, 'tok-solo')
    expect(() => session.leaveOnFatalError()).not.toThrow()
  })

  it('é seguro chamar duas vezes', async () => {
    const hub = new LocalHub()
    const session = makeSession(hub, 'tok-host')
    await session.create(ANA)

    session.leaveOnFatalError()
    expect(() => session.leaveOnFatalError()).not.toThrow()
  })
})
