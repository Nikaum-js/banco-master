// Recusa por falha no caminho de autoridade (spec 042, T030, D5 do plan, FR-020/021/022,
// SC-008). `applyCommand` é mockado pra lançar num `kind` real — é a única forma de exercitar
// o `catch` de `host.accept()` sem esperar uma exceção de verdade nascer no motor (nenhuma
// existe hoje; a fronteira existe pra próxima que ninguém previu).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/game/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/game/commands')>()
  return { ...actual, applyCommand: vi.fn(actual.applyCommand) }
})

import { applyCommand } from '@/game/commands'
import { createHost } from '@/net/host'
import { createClient } from '@/net/client'
import { LocalHub, localTransport } from '@/net/localTransport'
import { createRoom, joinRoom, SEAT_COLORS } from '@/net/room'
import { mulberry32 } from '../sim/engine/rng'

const mockedApplyCommand = vi.mocked(applyCommand)
// Capturada UMA vez, no escopo do módulo — antes de qualquer teste trocar a implementação.
// `vi.restoreAllMocks()`/`mockRestore()` num `vi.fn()` que não veio de `vi.spyOn()` não
// devolve a implementação original (vira um stub vazio) — por isso a referência é NOSSA,
// não pedida de volta ao mock depois.
const realApplyCommand = mockedApplyCommand.getMockImplementation()!

let consoleErrorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
  mockedApplyCommand.mockReset()
  mockedApplyCommand.mockImplementation(realApplyCommand)
})

async function openTwoPlayerMatch() {
  const hub = new LocalHub()
  let room = createRoom('r1', { token: 'tok-host', name: 'Ana', color: SEAT_COLORS[0] })
  const j = joinRoom(room, { token: 'tok-b', name: 'Bruno', color: SEAT_COLORS[1] })
  if (!j.ok) throw new Error(j.reason)
  room = j.room

  const host = createHost(localTransport(hub, 'tok-host'), room, { rng: mulberry32(7), now: () => 1_000 })
  await host.start()

  const hostClient = createClient(localTransport(hub, 'tok-host'))
  await hostClient.join()
  const guestClient = createClient(localTransport(hub, 'tok-b'))
  await guestClient.join()

  const g = host.game()
  const activeId = g.players[g.turnOrder[g.activeSeat]].id
  const actorClient = [hostClient, guestClient].find((c) => c.playerId() === activeId)!
  return { hub, host, hostClient, guestClient, actorClient }
}

describe('host.accept() — recusa por falha (T030)', () => {
  it('applyCommand lançando: game/seq inalterados, sem broadcast, remetente recebe rejectCommand com occurrenceId', async () => {
    const { host, actorClient } = await openTwoPlayerMatch()
    const gameBefore = JSON.stringify(host.game())
    const seqBefore = host.seq()

    mockedApplyCommand.mockImplementationOnce(() => { throw new Error('reducer explodiu') })

    expect(actorClient.lastCommandFailure()).toBeNull()
    actorClient.send({ kind: 'roll' })

    expect(JSON.stringify(host.game())).toBe(gameBefore) // FR-021: nada avançou pela metade
    expect(host.seq()).toBe(seqBefore) // seq não incrementou
    const failure = actorClient.lastCommandFailure()
    expect(failure).not.toBeNull()
    expect(typeof failure!.occurrenceId).toBe('string')
    expect(failure!.occurrenceId.length).toBeGreaterThan(0)
  })

  it('a MESMA falha em nova tentativa continua visível, com identificador (FR-020: nunca silencioso)', async () => {
    const { host, actorClient } = await openTwoPlayerMatch()
    const seqBefore = host.seq() // presença/pausa durante o join já consomem sequência própria

    mockedApplyCommand.mockImplementation(() => { throw new Error('reducer sempre explode') })
    actorClient.send({ kind: 'roll' })
    const first = actorClient.lastCommandFailure()
    expect(first).not.toBeNull()

    actorClient.send({ kind: 'roll' }) // send() limpa antes de reenviar — nova recusa chega de novo
    const second = actorClient.lastCommandFailure()
    expect(second).not.toBeNull()
    expect(host.seq()).toBe(seqBefore)
  })

  it('quem NÃO enviou o comando não recebe a recusa por falha alheia', async () => {
    const { host, actorClient, hostClient, guestClient } = await openTwoPlayerMatch()
    const bystander = [hostClient, guestClient].find((c) => c !== actorClient)!
    const seqBefore = host.seq()

    mockedApplyCommand.mockImplementationOnce(() => { throw new Error('reducer explodiu') })
    actorClient.send({ kind: 'roll' })

    expect(bystander.lastCommandFailure()).toBeNull()
    expect(host.seq()).toBe(seqBefore)
  })

  it('comando de SISTEMA que falha não lança pra fora do chamador — a mesa continua respondendo', async () => {
    // `syncPause` (host.ts) chama `accept({kind:'pause', cause:'disconnect', ...})` — um
    // comando de SISTEMA, sem `fromToken` — quando a presença de um assento cai. Mockamos
    // `applyCommand` pra lançar exatamente nesse `kind`, sem precisar montar um leilão de
    // verdade só para exercitar o mesmo `try/catch` que já protege o caminho de jogador.
    const { host, actorClient, hostClient, guestClient } = await openTwoPlayerMatch()
    const bystander = [hostClient, guestClient].find((c) => c !== actorClient)!
    const seqBefore = host.seq()

    mockedApplyCommand.mockImplementation((game, action, ctx) => {
      if (action.kind === 'pause') throw new Error('pausa explodiu')
      return realApplyCommand(game, action, ctx)
    })

    expect(() => bystander.leave()).not.toThrow() // dispara a presença→pausa que agora falha
    expect(host.seq()).toBe(seqBefore) // a pausa falhou ao aplicar — não avançou

    mockedApplyCommand.mockImplementation(realApplyCommand)
    actorClient.send({ kind: 'roll' })
    expect(host.seq()).toBe(seqBefore + 1) // a mesa segue respondendo a comandos normais depois
  })
})
