// Reentrada por código (041, D-033) — parte PURA: `newReentryCode`, preservação por
// `kickSeat`/`shuffleSeatOrder`, e `reattachByCode` como reducer puro de `room.ts`. A parte
// de SESSÃO (fim do arquivo) prova o mesmo pelo caminho de rede — `host.ts` minta o código
// no join e trata `reentryCode` em `handleJoinRequest`.
import { describe, expect, it } from 'vitest'
import {
  createRoom, joinRoom, kickSeat, newReentryCode, reattachByCode, shuffleSeatOrder, SEAT_COLORS,
} from '@/net/room'
import { mulberry32 } from '../sim/engine/rng'
import { createClient } from '@/net/client'
import { createHost } from '@/net/host'
import { LocalHub, localTransport } from '@/net/localTransport'

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

function salaComTres() {
  let room = createRoom('r1', { uid: 'tok-h', name: 'Host', color: SEAT_COLORS[0], reentryCode: 'AAAAAA' })
  const a = joinRoom(room, { uid: 'tok-a', name: 'Ana', color: SEAT_COLORS[1], reentryCode: 'BBBBBB' })
  if (!a.ok) throw new Error(a.reason)
  room = a.room
  const b = joinRoom(room, { uid: 'tok-b', name: 'Bob', color: SEAT_COLORS[2], reentryCode: 'CCCCCC' })
  if (!b.ok) throw new Error(b.reason)
  room = b.room
  return room
}

describe('newReentryCode — gerador (041, D-033)', () => {
  it('gera 6 caracteres do alfabeto sem ambiguidade visual', () => {
    const code = newReentryCode(mulberry32(1))
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/) // sem 0/O, 1/I/L
  })

  it('unicidade na sala: nunca repete um código já tomado', () => {
    const rng = mulberry32(2)
    const taken = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const code = newReentryCode(rng, taken)
      expect(taken.has(code)).toBe(false)
      taken.add(code)
    }
  })
})

describe('preservação do código (041, D-033)', () => {
  it('shuffleSeatOrder preserva o código de cada assento — só playerId muda de posição', () => {
    const room = salaComTres()
    const shuffled = shuffleSeatOrder(room, mulberry32(7))
    const codesBefore = new Set(room.seats.map((s) => s.reentryCode))
    const codesAfter = new Set(shuffled.seats.map((s) => s.reentryCode))
    expect(codesAfter).toEqual(codesBefore)
  })

  it('kickSeat preserva o código dos assentos que FICAM; o do removido some com o assento', () => {
    const room = salaComTres()
    const out = kickSeat(room, 'tok-a')
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.room.seats.map((s) => s.reentryCode).sort()).toEqual(['AAAAAA', 'CCCCCC'].sort())
    expect(out.room.seats.some((s) => s.reentryCode === 'BBBBBB')).toBe(false)
  })
})

describe('reattachByCode — reducer puro (041, D-033)', () => {
  it('troca o uid do assento e mantém tudo o mais; marca conectado', () => {
    const room = salaComTres()
    const out = reattachByCode(room, 'BBBBBB', 'tok-a-NOVO')
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.seat.uid).toBe('tok-a-NOVO')
    expect(out.seat.playerId).toBe('p2')
    expect(out.seat.name).toBe('Ana')
    expect(out.seat.connected).toBe(true)
    expect(out.seat.reentryCode).toBe('BBBBBB') // o código sobrevive à própria reentrada
  })

  it('o uid ANTERIOR deixa de ter assento (FR-027)', () => {
    const room = salaComTres()
    const out = reattachByCode(room, 'BBBBBB', 'tok-a-NOVO')
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.room.seats.some((s) => s.uid === 'tok-a')).toBe(false)
  })

  it('comparação sem caixa e sem espaços — quem digita um código ditado erra o caixa alta', () => {
    const room = salaComTres()
    const out = reattachByCode(room, '  bbb bbb  ', 'tok-novo')
    expect(out.ok).toBe(true)
  })

  it('código inválido recusa com "bad-code"', () => {
    const room = salaComTres()
    const out = reattachByCode(room, 'ZZZZZZ', 'tok-novo')
    expect(out).toEqual({ ok: false, reason: 'bad-code' })
  })
})

// Parte de SESSÃO — prova o mesmo pelo caminho de REDE, mas agora por RPC (043, D4:
// `Transport.reattach`, espelhado em `LocalHub.reattachByCodeRpc`), não mais por
// `JoinRequest.reentryCode` (que saiu do port — T019).
async function setup() {
  const hub = new LocalHub()
  const hostTransport = localTransport(hub, 'tok-host')
  const hostClient = createClient(hostTransport)
  await hostClient.join()
  const host = createHost(hostTransport, createRoom('r1', { uid: 'tok-host', name: 'Host', color: SEAT_COLORS[0], reentryCode: 'HHHHHH' }), {
    rng: mulberry32(9),
    now: () => 1_000,
  })
  await host.open()

  const bob = createClient(localTransport(hub, 'tok-b'))
  await bob.join()
  await bob.requestJoin({ name: 'Bob', color: SEAT_COLORS[1] })
  await flush()

  await host.startMatch()
  await flush()

  return { hub, host, hostClient, bob }
}

describe('reentrada por código — sessão (041, D-033 → 043, D4, RPC)', () => {
  it('SC-007: reentrada por OUTRO uid no meio da partida devolve o assento com estado íntegro', async () => {
    const { hub, host, bob } = await setup()
    const bobId = bob.playerId()!
    const code = host.room().seats.find((s) => s.playerId === bobId)!.reentryCode
    expect(code).not.toBe('') // o host mintou de verdade (T036), não o vazio de fallback dos testes

    const before = JSON.stringify(host.game())
    bob.leave() // perde o uid — simula aparelho sem bateria

    const freshTransport = localTransport(hub, 'tok-b-novo')
    const fresh = createClient(freshTransport)
    await fresh.join() // ainda sem assento: só observa o jogo em curso
    const result = await freshTransport.reattach('r1', code)
    await flush()

    expect(result).toEqual({ ok: true })
    expect(fresh.playerId()).toBe(bobId)
    expect(JSON.stringify(host.game())).toBe(before) // saldo/propriedades/cartas intactos
  })

  it('FR-027: o uid ANTERIOR perde o assento na reentrada', async () => {
    const { hub, host, bob } = await setup()
    const bobId = bob.playerId()!
    const code = host.room().seats.find((s) => s.playerId === bobId)!.reentryCode
    bob.leave()

    const freshTransport = localTransport(hub, 'tok-b-novo')
    const fresh = createClient(freshTransport)
    await fresh.join()
    await freshTransport.reattach('r1', code)
    await flush()

    expect(host.room().seats.some((s) => s.uid === 'tok-b')).toBe(false)
  })

  it('a reanexação retoma a partida se era a última ausência', async () => {
    const { hub, host, bob } = await setup()
    const bobId = bob.playerId()!
    const code = host.room().seats.find((s) => s.playerId === bobId)!.reentryCode
    bob.leave()
    expect(host.game().paused).not.toBeNull() // desconexão pausou (US3)

    const freshTransport = localTransport(hub, 'tok-b-novo')
    const fresh = createClient(freshTransport)
    await fresh.join()
    await freshTransport.reattach('r1', code)
    await flush()

    expect(host.game().paused).toBeNull() // retomou sozinho, sem ação manual
  })

  it('D-029: eliminado que reentra não destrava nem trava nada', async () => {
    const { hub, host, bob } = await setup()
    const bobId = bob.playerId()!
    const code = host.room().seats.find((s) => s.playerId === bobId)!.reentryCode
    host.game().players.find((p) => p.id === bobId)!.eliminated = true

    bob.leave()
    expect(host.game().paused).toBeNull() // eliminado que cai não pausa (D-029)

    const freshTransport = localTransport(hub, 'tok-b-novo')
    const fresh = createClient(freshTransport)
    await fresh.join()
    await freshTransport.reattach('r1', code)
    await flush()

    expect(fresh.playerId()).toBe(bobId) // reentrou normalmente
    expect(host.game().paused).toBeNull() // e não destravou nada que já estava livre
  })

  it('código inválido no caminho de rede recusa com "bad-code", sem tocar assento nenhum', async () => {
    const { hub, host } = await setup()
    const strangerTransport = localTransport(hub, 'tok-estranho')
    const stranger = createClient(strangerTransport)
    await stranger.join()
    const result = await strangerTransport.reattach('r1', 'ZZZZZZ')
    await flush()

    expect(result).toEqual({ ok: false, reason: 'bad-code' })
    expect(stranger.playerId()).toBeNull()
    expect(host.room().seats.some((s) => s.uid === 'tok-estranho')).toBe(false)
  })

  it('reanexar o assento do ANFITRIÃO devolve a autoridade a ele — funciona com a autoridade OFFLINE', async () => {
    const { hub, host } = await setup()
    const hostSeat = host.room().seats.find((s) => s.isHost)!
    expect(hostSeat.reentryCode).not.toBe('')

    // A autoridade "cai": nada no hub processa comandos, mas a linha persistida continua lá —
    // é exatamente o caso que justifica a RPC não depender de host algum (D4/plan). O
    // `playerId` do anfitrião não é necessariamente 'p1': `startMatch` sorteia a ORDEM DE
    // TURNO (FR-030) por cima da ordem de entrada — isHost e "joga primeiro" são coisas
    // diferentes desde a 038.
    const revivedTransport = localTransport(hub, 'tok-host-novo')
    const revived = createClient(revivedTransport)
    await revived.join()
    const result = await revivedTransport.reattach('r1', hostSeat.reentryCode)
    await flush()

    expect(result).toEqual({ ok: true })
    expect(revived.playerId()).toBe(hostSeat.playerId)
  })
})
