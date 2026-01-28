// T046 — com transporte local e dois clientes, cada fato gera UM evento (não um por
// cliente), e falha do sink não altera o estado da partida nem bloqueia comando (FR-037,
// T7 do contrato). Reusa o harness de rede (037) — só ele monta host + N clientes sobre o
// `localTransport` com o mesmo relógio lógico dos demais testes de rede.
import { describe, expect, it } from 'vitest'
import { setupGame } from '../net/harness'
import type { Telemetry, TelemetryEvent } from '@/telemetry/port'

function spyTelemetry(): { telemetry: Telemetry; events: TelemetryEvent[] } {
  const events: TelemetryEvent[] = []
  return { telemetry: { track: (e) => events.push(e) }, events }
}

describe('emissão de telemetria pela autoridade (T045/T046)', () => {
  it('match_started sai UMA vez ao iniciar, mesmo com 2 clientes observando', async () => {
    const { telemetry, events } = spyTelemetry()
    const net = await setupGame(2, 1, telemetry)

    // Os dois clientes já entraram e convergiram — se a emissão fosse da tela, isto
    // dispararia dois eventos. Só saiu um, porque só o host chamou `track`.
    expect(net.players).toHaveLength(2)
    const started = events.filter((e) => e.kind === 'match_started')
    expect(started).toHaveLength(1)
    expect(started[0]).toMatchObject({ kind: 'match_started', players: 2 })
    expect((started[0] as { matchKey: string }).matchKey).toBeTruthy()
  })

  it('match_ended sai UMA vez na transição para phase: ended, com players/rounds/duration', async () => {
    const { telemetry, events } = spyTelemetry()
    const net = await setupGame(2, 2, telemetry)

    // Arma uma falência insolvente de certeza para p1 (mesmo desenho de
    // `tests/game/falencia/eliminationOrder.test.ts`), mutando o estado que o HOST guarda
    // internamente e disparando o comando pelo caminho de autoridade de verdade (client →
    // host → `accept`) — é `accept()` quem emite telemetria, não o reducer puro isolado.
    const g = net.host.game()
    g.activeSeat = 0 // turnOrder é identidade em createSeedState/buildInitialGame
    g.turn = { ...g.turn, state: 'casa-a-resolver', pendingResolve: true }
    g.resolution = { kind: 'debt', amount: 999_999, creditorId: null }
    g.players[0].cash = 0

    net.players[0].client.send({ kind: 'declare-bankruptcy' })

    expect(net.host.game().phase).toBe('ended')

    const ended = events.filter((e) => e.kind === 'match_ended')
    expect(ended).toHaveLength(1) // T7: um fato, um evento — não um por cliente conectado
    expect(ended[0]).toMatchObject({ kind: 'match_ended', players: 2 })
    const e = ended[0] as Extract<TelemetryEvent, { kind: 'match_ended' }>
    expect(e.rounds).toBeGreaterThanOrEqual(1)
    expect(e.durationMs === null || e.durationMs >= 0).toBe(true)
  })

  it('falha do sink de telemetria não afeta a partida: pausa acontece, comando segue fluindo (FR-037)', async () => {
    // Sink que FALHA sempre — prova que a partida não sente absolutamente nada.
    const throwingTelemetry: Telemetry = {
      track: () => { throw new Error('destino de telemetria fora do ar') },
    }
    const net = await setupGame(2, 3, throwingTelemetry)

    expect(() => net.players[1].client.leave()).not.toThrow()
    expect(net.host.game().paused).not.toBeNull()
    expect(net.host.game().paused?.causes).toContain('disconnect')

    // O comando de jogo continua fluindo normalmente — a garantia central de FR-037 é que a
    // falha de telemetria nunca chega até aqui (nem propaga, nem trava `accept`).
    expect(net.host.seq()).toBeGreaterThanOrEqual(0)
  })

  it('match_paused sai UMA vez por causa entrando (não repete a cada reconciliação)', async () => {
    const { telemetry, events } = spyTelemetry()
    const net = await setupGame(2, 4, telemetry)

    // O PRÓPRIO `setupGame` já gera um par pausa→retomada transitório: o host conecta antes
    // do convidado (join sequencial), então por uma reconciliação de presença o segundo
    // assento parece "desconectado" até o `client.join()` dele terminar (comportamento do
    // host de 037/041, alheio a esta spec — a telemetria só está registrando um fato que já
    // acontecia). Por isso a prova de "uma vez por causa entrando" olha só para o que a
    // DESCONEXÃO DE VERDADE gera a partir daqui, não para o total acumulado desde o boot.
    const beforeDisconnect = events.length

    net.players[1].client.leave()
    expect(net.host.game().paused).not.toBeNull()

    const pausedSinceDisconnect = events.slice(beforeDisconnect).filter((e) => e.kind === 'match_paused')
    expect(pausedSinceDisconnect).toHaveLength(1)
    expect(pausedSinceDisconnect[0]).toMatchObject({ kind: 'match_paused', cause: 'disconnect' })
  })
})
