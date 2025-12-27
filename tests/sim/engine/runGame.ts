// Orquestra 1 partida completa: enumerar → escolher → aplicar → checar conservação de
// dinheiro (todo dispatch) → sondar/invariantes estruturais (1x/turno) → checar fim de
// jogo/teto de rodadas (036 + extensão de conservação/cobertura).
import { createSimSession, dispatch, closeExhaustedAuctions, type SimSession } from './driver'
import { enumerateActions } from './actions'
import { pickAction } from './agent'
import { pickProbe, applyProbe } from './invalidProbe'
import { checkInvariants } from './invariants'
import { checkConservation, checkAuctionClose } from './conservation'
import type { SimAction, SimFailure, SimResult } from './types'
import { sampleWealth, type WealthSample } from './wealth'

function addCoverage(coverage: Record<string, number>, mechanisms: string[]): void {
  for (const m of mechanisms) coverage[m] = (coverage[m] ?? 0) + 1
}

// 300 (Assumption original do spec.md) mostrou-se insuficiente na prática para a
// política puramente aleatória (Assumption "sem heurística de jogador razoável"): o
// devedor sempre tenta liquidar (mortgage/vender construção) antes de falir, o que é
// correto pela regra (§9.1) mas prolonga a sobrevivência bem mais que um jogador humano
// decidiria. O teto de 1500 cobria o benchmark anterior, mas a progressão parcial de
// construção (D-050) reduz o aluguel máximo de países incompletos: cinco seeds válidas
// passaram do limite e terminaram entre 1568 e 1930 rodadas. 2000 mantém a salvaguarda
// finita sem classificar essas partidas completas como deadlock.
const DEFAULT_ROUND_CAP = 2000
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
  coverage: Record<string, number>,
): SimResult {
  return {
    seed,
    playerCount,
    outcome: 'fail',
    rounds,
    actionsExecuted,
    durationMs,
    coverage,
    // Partida que falhou não tem formato para medir: `buildReport` agrega curva só das `ok`.
    wealth: [],
    failure: { reason, seed, playerCount, round, action, detail },
  }
}

// A partida terminou? Existe como FUNÇÃO por causa do narrowing: escrita direto na condição
// do `while`, a comparação estreitava `session.game.phase` para `'lobby' | 'playing'` pelo
// corpo inteiro do laço — e `dispatch` reatribui `session.game`, o que o TS não acompanha.
// O sintoma era o `phase === 'ended'` mais abaixo acusado como comparação impossível.
function gameEnded(session: SimSession): boolean {
  return session.game.phase === 'ended'
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
  const coverage: Record<string, number> = {}
  const wealth: WealthSample[] = []

  try {
    while (!gameEnded(session)) {
      ticks++
      if (ticks > maxTicks) {
        return fail('round-cap-exceeded', seed, playerCount, rounds, undefined, `excedeu a salvaguarda de ${maxTicks} ticks sem terminar`, rounds, actionsExecuted, Date.now() - t0, coverage)
      }

      const beforeAuctionClose = session.game
      closeExhaustedAuctions(session)
      if (session.game !== beforeAuctionClose) {
        const { violations, mechanisms } = checkAuctionClose(beforeAuctionClose, session.game)
        addCoverage(coverage, mechanisms)
        if (violations.length > 0) {
          const detail = violations.map((v) => `[${v.code}] ${v.detail}`).join('; ')
          return fail('invariant', seed, playerCount, rounds, undefined, `[fechamento de leilão] ${detail}`, rounds, actionsExecuted, Date.now() - t0, coverage)
        }
      }

      const points = enumerateActions(session)
      const { action } = pickAction(session.ctx.rng, points)
      const before = session.game
      dispatch(session, action)
      actionsExecuted++

      // Conservação de dinheiro: checada em TODO dispatch (não só na troca de assento) —
      // cada mecanismo (aluguel/imposto/cartas/GO/TaxMan/etc.) só é atribuível ao dispatch
      // exato que o disparou.
      const { violations: moneyViolations, mechanisms } = checkConservation(before, session.game, action)
      addCoverage(coverage, mechanisms)
      if (moneyViolations.length > 0) {
        const detail = moneyViolations.map((v) => `[${v.code}] ${v.detail}`).join('; ')
        return fail('invariant', seed, playerCount, rounds, action, detail, rounds, actionsExecuted, Date.now() - t0, coverage)
      }

      const seatChanged = session.game.activeSeat !== lastActiveSeat
      if (seatChanged || gameEnded(session)) {
        const probe = pickProbe(session.ctx.rng, session.game)
        if (probe) {
          const probeResult = applyProbe(session, probe)
          if (!probeResult.ok) {
            return fail('invalid-action-accepted', seed, playerCount, rounds, action, probeResult.detail, rounds, actionsExecuted, Date.now() - t0, coverage)
          }
        }

        const violations = checkInvariants(before, session.game, action)
        if (violations.length > 0) {
          const detail = violations.map((v) => `[${v.code}] ${v.detail}`).join('; ')
          return fail('invariant', seed, playerCount, rounds, action, detail, rounds, actionsExecuted, Date.now() - t0, coverage)
        }

        if (seatChanged && session.game.activeSeat <= lastActiveSeat) {
          rounds++
          // Uma amostra por rodada FECHADA (item 3 do backlog). No fecho da rodada todos
          // jogaram o mesmo número de turnos, então a comparação entre jogadores é justa —
          // amostrar por dispatch daria vantagem a quem acabou de agir.
          wealth.push(sampleWealth(session.game, rounds))
        }
        lastActiveSeat = session.game.activeSeat

        if (!gameEnded(session) && rounds >= roundCap) {
          return fail('round-cap-exceeded', seed, playerCount, rounds, action, `estourou o teto de ${roundCap} rodadas`, rounds, actionsExecuted, Date.now() - t0, coverage)
        }
      }
    }
  } catch (e) {
    return fail('exception', seed, playerCount, rounds, undefined, e instanceof Error ? (e.stack ?? e.message) : String(e), rounds, actionsExecuted, Date.now() - t0, coverage)
  }

  const winner = session.game.players.find((p) => !p.eliminated)
  const alive = session.game.players.filter((p) => !p.eliminated).length
  if (alive !== 1) {
    return fail('invariant', seed, playerCount, rounds, undefined, `fim de jogo com ${alive} jogadores vivos (esperado 1)`, rounds, actionsExecuted, Date.now() - t0, coverage)
  }
  return { seed, playerCount, outcome: 'ok', rounds, actionsExecuted, durationMs: Date.now() - t0, winnerId: winner?.id, coverage, wealth }
}
