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
import { BOARD, type GroupKey } from '@/lib/boardData'
import type { GameState, EliminationRecord } from './turn/types'
import { netWorth } from './cards/effects'
import { cityLevel } from './economy/construction'
import { groupSize } from './economy/titles'
import { rentDue } from './economy/rent'

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
  // ── Contas que contam a HISTÓRIA da partida (v1.27) ────────────────────────────
  // "Propriedades" e "Queda" saíram da tabela porque nenhuma das duas explica o
  // resultado: a contagem de lotes não distingue um país fechado e construído de cinco
  // terrenos soltos, e a rodada da queda só repete a ordem da própria classificação.
  //
  // As três abaixo são DERIVADAS do estado final, sem estado novo: dá para calculá-las de
  // qualquer snapshot, inclusive de partida antiga, e por isso a tela nunca fica sem elas.
  /** Caixa líquido no fim — o quanto do patrimônio estava líquido e não preso em título. */
  cash: number
  /** Países (grupos de cidade) COMPLETOS possuídos. É o que destrava construção (§5.2/§13.3). */
  countries: number
  /** Construções somadas: níveis de cidade (casa→arranha-céu) + Hangares. */
  buildings: number
  /** Maior aluguel que uma propriedade dele cobraria no fim — o pico de ameaça na mesa. */
  topRent: number
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

/**
 * Contas derivadas do estado final. Blindadas do mesmo jeito que o resto do arquivo: esta
 * função roda no render da tela de fim de jogo e NUNCA pode lançar, então tudo é lido com
 * `??` e qualquer degrau ausente vira zero em vez de exceção.
 */
function matchStats(game: GameState, playerId: string): { cash: number; countries: number; buildings: number; topRent: number } {
  const player = (game.players ?? []).find((p) => p.id === playerId)
  const titles = game.titles ?? {}
  let buildings = 0
  let topRent = 0
  const ownedByGroup = new Map<GroupKey, number>()

  for (const sq of BOARD) {
    const t = titles[sq.pos]
    if (!t || t.ownerId !== playerId) continue
    if (sq.kind === 'property') {
      buildings += cityLevel(t)
      ownedByGroup.set(sq.group, (ownedByGroup.get(sq.group) ?? 0) + 1)
    }
    if (sq.kind === 'airport' && t.hangar) buildings += 1
    // Aluguel de pico: `rentDue` já embute construção, país fechado, Hangar e dobras. Nunca
    // lança — hipotecada e boicotada devolvem 0 pelas guardas do próprio motor.
    if (!t.mortgaged) {
      try {
        const due = rentDue(game, sq.pos, playerId, game.turn?.lastRoll ?? null)
        if (Number.isFinite(due) && due > topRent) topRent = due
      } catch {
        // Estado inconsistente de snapshot antigo: o pico fica no que já foi medido.
      }
    }
  }

  let countries = 0
  for (const [group, owned] of ownedByGroup) if (owned >= groupSize(group)) countries += 1

  return { cash: player?.cash ?? 0, countries, buildings, topRent }
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
    ...matchStats(game, playerId),
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
