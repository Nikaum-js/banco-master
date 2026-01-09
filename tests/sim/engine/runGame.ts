// Orquestra 1 partida completa: enumerar → escolher → aplicar → checar conservação de
// dinheiro (todo dispatch) → sondar/invariantes estruturais (1x/turno) → checar fim de
// jogo/teto de rodadas (036 + extensão de conservação/cobertura).
import { createSimSession, closeExhaustedAuctions, type SimSession } from './driver'
import { enumerateActions } from './actions'
import { pickAction } from './agent'
import { pickProbe, applyProbe } from './invalidProbe'
import { checkInvariants } from './invariants'
import { checkConservation, checkAuctionClose } from './conservation'
import { checkNarration, checkNoTruncation } from './narration'
import { stepWithConvergence } from './convergence'
import type { GameState } from '@/game/turn/types'
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
// passaram do limite e terminaram entre 1568 e 1930 rodadas. 2000 manteve a salvaguarda
// finita sem classificar essas partidas completas como deadlock.
//
// 3000 desde a 050: a contrapartida mínima (§8.5/D-055) reduz quanta propriedade muda de
// mão por rodada sob política aleatória — doar deixou de ser legal, e comprar exige caixa
// que o bot nem sempre tem. O harness ganhou as duas formas que faltavam (compra no piso e
// troca propriedade-por-propriedade), o que devolveu a maior parte da convergência, mas a
// seed 2026070570 de 2 jogadores ainda fecha em 2028 rodadas. Ela TERMINA — não é deadlock,
// é a mesma classe de caso que já forçou 300 → 1500 → 2000.
const DEFAULT_ROUND_CAP = 3000
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

/**
 * Observador de transição, opcional. Recebe TODA mudança de estado da partida — a do
 * despacho escolhido e a do fecho por relógio lógico —, na ordem em que ocorreram.
 *
 * Existe para medir o que o `SimResult` não carrega e não deveria carregar: um estudo A/B
 * pontual (o da D-078 comparou os limiares 3 e 6 nas mesmas seeds) precisa de contagens que
 * só fazem sentido para ele, e enfiá-las no resultado padrão deixaria o campo morto no lote
 * do CI para sempre. Como é `undefined` por default, o caminho do CI não muda.
 */
export type SimObserver = (prev: GameState, next: GameState) => void

export function runGame(
  seed: number,
  playerCount: number,
  roundCap: number = DEFAULT_ROUND_CAP,
  observe?: SimObserver,
): SimResult {
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
        observe?.(beforeAuctionClose, session.game)
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
      // CONVERGÊNCIA (v): cada despacho passa pelo caminho de produção do multiplayer — host
      // gravando o não-determinismo, cliente reproduzindo — e os dois estados têm de ser
      // idênticos. Antes disto o harness rodava só a autoridade, e por construção não conseguia
      // encontrar divergência nenhuma; "as contas oscilam" (CARD 04) é o sintoma exato de uma.
      const step = stepWithConvergence(before, action, session.ctx)
      session.game = step.host
      observe?.(before, session.game)
      actionsExecuted++
      if (step.violations.length > 0) {
        const detail = step.violations.map((v) => `[${v.code}] ${v.detail}`).join('; ')
        return fail('invariant', seed, playerCount, rounds, action, detail, rounds, actionsExecuted, Date.now() - t0, coverage)
      }

      // Conservação de dinheiro: checada em TODO dispatch (não só na troca de assento) —
      // cada mecanismo (aluguel/imposto/cartas/GO/TaxMan/etc.) só é atribuível ao dispatch
      // exato que o disparou.
      //
      // NARRAÇÃO (n) e NÃO-TRUNCAGEM (t) andam junto e no mesmo lugar, e por um motivo: as três
      // são propriedades DO DESPACHO, não do estado final. Conservação diz que o dinheiro fecha;
      // narração diz que alguém consegue explicar por quê; não-truncagem diz que nenhuma
      // obrigação a jogador foi apagada no caminho. O harness tinha só a primeira, e é por isso
      // que quatro relatos de bug financeiro passaram por milhares de partidas simuladas.
      const { violations: moneyViolations, mechanisms } = checkConservation(before, session.game, action)
      addCoverage(coverage, mechanisms)
      const ledgerViolations = [
        ...moneyViolations,
        ...checkNarration(before, session.game),
        ...checkNoTruncation(before, session.game),
      ]
      if (ledgerViolations.length > 0) {
        const detail = ledgerViolations.map((v) => `[${v.code}] ${v.detail}`).join('; ')
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
