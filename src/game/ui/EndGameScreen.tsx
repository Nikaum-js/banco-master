// Tela de fim de jogo (044, T012 — US2/D-038). Substitui a coroa+nome+botão que o
// `GameHUD:157` tinha por si só: agora toda tela mostra a classificação completa, do 1º
// ao último, com patrimônio, propriedades e — para quem caiu — a rodada da queda.
//
// Consome `matchSummary(game)` (função pura, `src/game/summary.ts`) e não guarda nada:
// a classificação é recomputada a cada render, a partir do estado — é assim que ela sai
// idêntica em toda tela e sobrevive a um recarregamento (FR-006).
//
// Roda dentro da `MatchErrorBoundary` (042) — nenhum caminho de render pode lançar.
// `matchSummary` já nunca lança; este componente só faz leitura direta do que ela devolve,
// sem cálculo adicional que possa falhar.
//
// Reusa o vocabulário existente em vez de inventar um novo: `Overlay`/`ModalShell`
// (shell.tsx), `Button` (primitives.tsx), `PlayerName` (net/ui) e `money()` (lib/money) —
// a mesma casca do resto do jogo. Cabeçalho reaproveita `Crown` e `Confetti`, que o
// `GameHUD` já usava na celebração do vencedor.
import { Crown } from 'lucide-react'
import { Overlay, ModalShell } from '@/game/ui/shell'
import { Button } from '@/game/ui/primitives'
import { Confetti } from '@/game/ui/NoticeLayer'
import { PlayerName } from '@/net/ui/PlayerName'
import { matchSummary, type StandingRow } from '@/game/summary'
import type { GameState } from '@/game/turn/types'
import { money } from '@/lib/money'

function formatRounds(rounds: number): string {
  if (rounds <= 0) return 'rodadas indisponíveis'
  return `${rounds} ${rounds === 1 ? 'rodada' : 'rodadas'}`
}

// G5 do contrato: duração ausente é DITA, não estimada — nunca "0ms"/"0 min" (o bug que
// nasceria de fazer aritmética com defaults em vez de checar `durationMs === null`).
function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return 'duração indisponível'
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes} min` : `${seconds} s`
}

// Uma linha fica "sem posição confirmada" quando foi eliminada mas não tem
// `eliminatedAtRound` — snapshot gravado antes desta spec, sem registro correspondente em
// `eliminationOrder` (data-model §1, compatibilidade). O único jogador legítimo sem
// `eliminatedAtRound` é quem não caiu — sempre a linha de rank 1 nesta tela, porque o HUD
// só entra em `winner` com a partida encerrada (FR-009).
function isUnconfirmed(row: StandingRow): boolean {
  return row.rank !== 1 && row.eliminatedAtRound === null
}

export function EndGameScreen({
  game,
  online,
  onExit,
}: {
  game: GameState
  online: boolean
  onExit: () => void
}) {
  const summary = matchSummary(game)
  const { standings, winnerId, rounds, durationMs, partial } = summary
  const confirmed = standings.filter((row) => !isUnconfirmed(row))
  const unconfirmed = standings.filter(isUnconfirmed)

  return (
    // 044/T024: sem título via ModalHeader (o cabeçalho é o "VENCEDOR" custom abaixo) —
    // `ariaLabel` supre o nome do diálogo. Sem `dismissible`: não há ação de fechar
    // separada do botão de saída (nenhum `onClick` de backdrop foi passado), então o
    // default seguro (Esc não faz nada) não muda comportamento nenhum.
    <Overlay z={70} ariaLabel="Fim de jogo" className="overflow-y-auto">
      <Confetti />
      <ModalShell className="relative w-full max-w-lg my-8">
        <div className="flex flex-col items-center px-6 pt-8 pb-4 text-center">
          <Crown
            size={56}
            className="text-gold"
            style={{ filter: 'drop-shadow(0 4px 14px color-mix(in srgb, var(--color-brass) 65%, transparent))' }}
          />
          <p className="label text-gold tracking-[var(--tracking-caps)] mt-2">VENCEDOR</p>
          <p className="display text-4xl leading-none text-cream mt-1">
            {winnerId ? <PlayerName playerId={winnerId} /> : '—'}
          </p>
        </div>

        {partial && (
          <div className="mx-6 mb-3 px-3 py-2 rounded-[var(--radius-card)] border border-gold/40 bg-gold/10">
            <p className="label text-cream-muted normal-case leading-snug">
              Partida carregada de uma gravação anterior a este recurso: a ordem de queda de
              alguns jogadores não foi registrada. Eles aparecem agrupados abaixo, sem posição
              afirmada entre si.
            </p>
          </div>
        )}

        <div className="px-6 pb-2 overflow-y-auto max-h-[42vh]">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">Classificação final da partida</caption>
            <thead>
              <tr className="label text-cream-muted text-left">
                <th scope="col" className="py-1.5 pr-2 font-normal">Pos.</th>
                <th scope="col" className="py-1.5 pr-2 font-normal">Jogador</th>
                <th scope="col" className="py-1.5 pr-2 font-normal text-right">Patrimônio</th>
                <th scope="col" className="py-1.5 pr-2 font-normal text-right">Propriedades</th>
                <th scope="col" className="py-1.5 font-normal text-right">Queda</th>
              </tr>
            </thead>
            <tbody>
              {confirmed.map((row) => (
                <tr key={row.playerId} className="border-t border-coffee-600/60">
                  <td className="py-1.5 pr-2 text-cream-muted tabular-nums">{row.rank}º</td>
                  <td className="py-1.5 pr-2 text-cream max-w-[9rem]">
                    <PlayerName playerId={row.playerId} dot />
                  </td>
                  <td className="py-1.5 pr-2 text-right currency text-cream">{money(row.netWorth)}</td>
                  <td className="py-1.5 pr-2 text-right text-cream-muted tabular-nums">{row.properties}</td>
                  <td className="py-1.5 text-right text-cream-muted tabular-nums">
                    {row.eliminatedAtRound ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {unconfirmed.length > 0 && (
            <div className="mt-3">
              <p className="label text-cream-muted mb-1.5">Sem posição confirmada</p>
              <ul className="flex flex-col gap-1">
                {unconfirmed.map((row) => (
                  <li
                    key={row.playerId}
                    className="flex items-center justify-between gap-2 text-sm text-cream-muted py-1 border-t border-coffee-600/40"
                  >
                    <PlayerName playerId={row.playerId} dot />
                    <span className="currency">{money(row.netWorth)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-coffee-600/60 text-center">
          <p className="label text-cream-muted normal-case">
            {formatRounds(rounds)} · {formatDuration(durationMs)}
          </p>
        </div>

        <div className="px-6 pb-6 flex justify-center">
          <Button onClick={onExit} className="px-6 py-2.5 text-base">
            {online ? 'Voltar ao início' : 'Novo jogo'}
          </Button>
        </div>
      </ModalShell>
    </Overlay>
  )
}
