// Orquestra 1 partida completa: enumerar → escolher → aplicar → sondar (1x/turno) →
// checar invariantes (1x/turno) → checar fim de jogo/teto de rodadas (036).
import { createSimSession, dispatch, closeExhaustedAuctions } from './driver'
import { enumerateActions } from './actions'
import { pickAction } from './agent'
import { pickProbe, applyProbe } from './invalidProbe'
import { checkInvariants } from './invariants'
import type { SimAction, SimFailure, SimResult } from './types'

// 300 (Assumption original do spec.md) mostrou-se insuficiente na prática para a
// política puramente aleatória (Assumption "sem heurística de jogador razoável"): o
// devedor sempre tenta liquidar (mortgage/vender construção) antes de falir, o que é
// correto pela regra (§9.1) mas prolonga a sobrevivência bem mais que um jogador humano
// decidiria. 1500 rodadas cobriu 100/100 seeds em 2/3/6 jogadores no benchmark de
// implementação, dentro do orçamento de SC-002 (sharding por contagem, research.md D8).
const DEFAULT_ROUND_CAP = 1500
const SAFETY_TICK_FACTOR = 60 // salvaguarda contra loop sem progresso de rodada (não é o teto de regra)

function fail(
  reason: SimFailure['reason'],
  seed: number,
  playerCount: number,
  round: number,
  action: SimAction | undefined,
  detail: string,
  rounds: number,
  actionsExecuted: number,
  durationMs: number,
): SimResult {
  return {
    seed,
    playerCount,
    outcome: 'fail',
    rounds,
    actionsExecuted,
    durationMs,
    failure: { reason, seed, playerCount, round, action, detail },
  }
}

export function runGame(seed: number, playerCount: number, roundCap: number = DEFAULT_ROUND_CAP): SimResult {
  const t0 = Date.now()
  const playerIds = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`)
  const session = createSimSession(seed, playerIds)
  let rounds = 0
  let actionsExecuted = 0
  let lastActiveSeat = session.game.activeSeat
  const maxTicks = roundCap * playerCount * SAFETY_TICK_FACTOR
  let ticks = 0

  try {
    while (session.game.phase !== 'ended') {
      ticks++
      if (ticks > maxTicks) {
        return fail('round-cap-exceeded', seed, playerCount, rounds, undefined, `excedeu a salvaguarda de ${maxTicks} ticks sem terminar`, rounds, actionsExecuted, Date.now() - t0)
      }
      closeExhaustedAuctions(session)

      const points = enumerateActions(session)
      const { action } = pickAction(session.ctx.rng, points)
      const before = session.game
      dispatch(session, action)
      actionsExecuted++

      const seatChanged = session.game.activeSeat !== lastActiveSeat
      const ended = session.game.phase === 'ended'
      if (seatChanged || ended) {
        const probe = pickProbe(session.ctx.rng, session.game)
        if (probe) {
          const probeResult = applyProbe(session, probe)
          if (!probeResult.ok) {
            return fail('invalid-action-accepted', seed, playerCount, rounds, action, probeResult.detail, rounds, actionsExecuted, Date.now() - t0)
          }
        }

        const violations = checkInvariants(before, session.game, action)
        if (violations.length > 0) {
          const detail = violations.map((v) => `[${v.code}] ${v.detail}`).join('; ')
          return fail('invariant', seed, playerCount, rounds, action, detail, rounds, actionsExecuted, Date.now() - t0)
        }

        if (seatChanged && session.game.activeSeat <= lastActiveSeat) rounds++
        lastActiveSeat = session.game.activeSeat

        if (!ended && rounds >= roundCap) {
          return fail('round-cap-exceeded', seed, playerCount, rounds, action, `estourou o teto de ${roundCap} rodadas`, rounds, actionsExecuted, Date.now() - t0)
        }
      }
    }
  } catch (e) {
    return fail('exception', seed, playerCount, rounds, undefined, e instanceof Error ? (e.stack ?? e.message) : String(e), rounds, actionsExecuted, Date.now() - t0)
  }

  const winner = session.game.players.find((p) => !p.eliminated)
  const alive = session.game.players.filter((p) => !p.eliminated).length
  if (alive !== 1) {
    return fail('invariant', seed, playerCount, rounds, undefined, `fim de jogo com ${alive} jogadores vivos (esperado 1)`, rounds, actionsExecuted, Date.now() - t0)
  }
  return { seed, playerCount, outcome: 'ok', rounds, actionsExecuted, durationMs: Date.now() - t0, winnerId: winner?.id }
}
