// Classificação de fim de jogo (044, D-038 / D2 do plan). Função PURA e DERIVADA: nenhuma
// posição é guardada no estado — `matchSummary` reconstrói a classificação a partir de
// `eliminationOrder` toda vez que é chamada, em qualquer tela, sem relógio e sem rede.
//
// Contrato completo: specs/044-polimento-lancamento/contracts/match-summary.md.
//
// A GARANTIA que domina o resto do arquivo: esta função NUNCA lança. Ela roda durante o
// render da tela de fim de jogo — uma exceção ali cairia na `MatchErrorBoundary` e trocaria
// o encerramento da partida por uma tela de falha (a mesma lição da 040/042). Estado
// inconsistente ou snapshot antigo vira `partial: true`, nunca exceção.
import type { GameState, EliminationRecord } from './turn/types'
import { netWorth } from './cards/effects'

export interface StandingRow {
  playerId: string
  /** 1 = vencedor (ou 1º da classificação corrente, se a partida ainda não terminou). */
  rank: number
  /** Patrimônio líquido no estado final. Eliminados dão 0 por definição de falência
   *  (§9.1) — não é caso especial aqui, é só o que `netWorth` computa sobre o estado. */
  netWorth: number
  /** Quantidade de títulos (propriedade/aeroporto/utilidade) no estado final. */
  properties: number
  /** Rodada em que foi eliminado; null para quem não caiu (inclui o vencedor). */
  eliminatedAtRound: number | null
}

export interface MatchSummary {
  winnerId: string | null
  standings: StandingRow[] // ordenado por rank crescente
  rounds: number
  durationMs: number | null // null quando falta relógio (startedAt === 0 ou endedAt === null)
  /** true quando a classificação não pode ser afirmada com confiança: snapshot sem os
   *  campos novos (eliminado sem registro correspondente) ou registro órfão (id que não
   *  existe mais em `players`). A UI usa isto para não afirmar posição que não pode. */
  partial: boolean
}

function countProperties(game: GameState, playerId: string): number {
  const titles = game.titles ?? {}
  let n = 0
  for (const pos in titles) {
    if (titles[pos]?.ownerId === playerId) n += 1
  }
  return n
}

function computeSummary(game: GameState): MatchSummary {
  const players = game.players ?? []
  const validIds = new Set(players.map((p) => p.id))
  const eliminationOrder: EliminationRecord[] = game.eliminationOrder ?? []

  // Registros órfãos (id que não existe mais em `players`) são descartados da
  // classificação — nunca lançamos, e nunca inventamos uma linha para quem não é
  // mais um jogador desta partida (teste obrigatório 7).
  const validRecords = eliminationOrder.filter((r) => validIds.has(r.playerId))
  const orphanCount = eliminationOrder.length - validRecords.length

  const recordedIds = new Set(validRecords.map((r) => r.playerId))
  const alivePlayers = players.filter((p) => !p.eliminated)
  const eliminatedFlagged = players.filter((p) => p.eliminated)
  // `player.eliminated === true` sem registro em `eliminationOrder`: snapshot gravado
  // antes desta spec (data-model — Compatibilidade). Ficam agrupados, sem posição
  // afirmada entre si (teste obrigatório 5 / FR-009).
  const eliminatedWithoutRecord = eliminatedFlagged.filter((p) => !recordedIds.has(p.id))

  const partial = eliminatedWithoutRecord.length > 0 || orphanCount > 0

  // D2: o(s) não-eliminado(s) primeiro; eliminados na ordem INVERSA de queda — quem caiu
  // por último aparece logo depois dos vivos. `[...validRecords]` copia antes de inverter
  // (G7 — nunca muta `game.eliminationOrder`).
  const eliminatedDesc = [...validRecords].reverse()
  const orderedIds = [
    ...alivePlayers.map((p) => p.id),
    ...eliminatedDesc.map((r) => r.playerId),
    ...eliminatedWithoutRecord.map((p) => p.id),
  ]

  const roundByPlayer = new Map(validRecords.map((r) => [r.playerId, r.round]))

  const standings: StandingRow[] = orderedIds.map((playerId, i) => ({
    playerId,
    rank: i + 1,
    netWorth: netWorth(game, playerId),
    properties: countProperties(game, playerId),
    eliminatedAtRound: roundByPlayer.get(playerId) ?? null,
  }))

  // G4: fora de `phase === 'ended'`, não há vencedor a afirmar — mesmo que só reste 1 vivo
  // (estado transitório). Com >1 ou 0 vivos em 'ended' (estado inconsistente), também null.
  const winnerId = game.phase === 'ended' && alivePlayers.length === 1 ? alivePlayers[0].id : null

  const durationMs = game.startedAt && game.endedAt != null ? game.endedAt - game.startedAt : null

  return {
    winnerId,
    standings,
    rounds: game.round ?? 0,
    durationMs,
    partial,
  }
}

export function matchSummary(game: GameState): MatchSummary {
  try {
    return computeSummary(game)
  } catch {
    // Rede de segurança final (defesa em profundidade): mesmo um estado corrompido além
    // do previsto não pode virar exceção no caminho de render do fim de jogo.
    return { winnerId: null, standings: [], rounds: 0, durationMs: null, partial: true }
  }
}
