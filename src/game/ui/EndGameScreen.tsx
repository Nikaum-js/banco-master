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
import { Clock3, Crown, DoorOpen, RotateCcw } from 'lucide-react'
import { PlayerFace } from '@/boards/PlayerFace'
import { Overlay, ModalShell } from '@/game/ui/shell'
import { Button } from '@/game/ui/primitives'
import { Confetti } from '@/game/ui/NoticeLayer'
import { PlayerName } from '@/net/ui/PlayerName'
import { useIdentity } from '@/net/roomStore'
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
  const winner = standings.find((row) => row.playerId === winnerId) ?? null
  const winnerIdentity = useIdentity(winnerId ?? 'p1')

  return (
    // 044/T024: sem título via ModalHeader (o cabeçalho é o "VENCEDOR" custom abaixo) —
    // `ariaLabel` supre o nome do diálogo. Sem `dismissible`: não há ação de fechar
    // separada do botão de saída (nenhum `onClick` de backdrop foi passado), então o
    // default seguro (Esc não faz nada) não muda comportamento nenhum.
    <Overlay z={70} ariaLabel="Fim de jogo" className="overflow-y-auto">
      <Confetti />
      <ModalShell className="endgame-shell relative w-full max-w-3xl my-8">
        <header className="endgame-hero">
          <div className="endgame-winner-mark" aria-hidden>
            <span className="endgame-crown">
              <Crown size={32} strokeWidth={1.8} />
            </span>
            <PlayerFace
              color={winnerIdentity.color}
              avatar={winnerIdentity.avatar}
              skin={winnerIdentity.skin}
              size={92}
              showActiveRing={false}
            />
          </div>

          <div className="endgame-winner-copy">
            <p className="label text-cream-muted">PARTIDA ENCERRADA</p>
            <div className="endgame-winner-label">
              <span>VENCEDOR</span>
              <span aria-hidden />
            </div>
            <h2 className="display text-cream">
              {winnerId ? <PlayerName playerId={winnerId} /> : '·'}
            </h2>
            {winner && (
              <dl className="endgame-winner-stats">
                <div>
                  <dt>Patrimônio final</dt>
                  <dd className="currency">{money(winner.netWorth)}</dd>
                </div>
                <div>
                  <dt>Em caixa</dt>
                  <dd className="currency">{money(winner.cash)}</dd>
                </div>
                <div>
                  <dt>Países fechados</dt>
                  <dd>{winner.countries}</dd>
                </div>
              </dl>
            )}
          </div>
        </header>

        {partial && (
          <div className="mx-6 mb-3 px-3 py-2 rounded-[var(--radius-card)] border border-gold/40 bg-gold/10">
            <p className="label text-cream-muted normal-case leading-snug">
              Partida carregada de uma gravação anterior a este recurso: a ordem de queda de
              alguns jogadores não foi registrada. Eles aparecem agrupados abaixo, sem posição
              afirmada entre si.
            </p>
          </div>
        )}

        <section className="endgame-standings">
          <div className="endgame-section-heading">
            <div>
              <p className="label text-gold">RESULTADO OFICIAL</p>
              <h3 className="display text-cream">Classificação final</h3>
            </div>
            <span className="label text-cream-muted">
              {standings.length} {standings.length === 1 ? 'jogador' : 'jogadores'}
            </span>
          </div>

          <div className="endgame-table-scroll">
          <table className="endgame-table w-full text-sm border-separate border-spacing-y-1.5">
            <caption className="sr-only">Classificação final da partida</caption>
            <thead>
              <tr className="label text-cream-muted text-left">
                <th scope="col" className="py-1.5 pr-2 font-normal">Pos.</th>
                <th scope="col" className="py-1.5 pr-2 font-normal">Jogador</th>
                <th scope="col" className="py-1.5 pr-2 font-normal text-right">Patrimônio</th>
                <th scope="col" className="py-1.5 pr-2 font-normal text-right">Em caixa</th>
                <th scope="col" className="py-1.5 pr-2 font-normal text-right" title="Países com todas as cidades: é o que destrava construção">Países</th>
                <th scope="col" className="py-1.5 pr-2 font-normal text-right" title="Construções e melhorias somadas">Construções</th>
                <th scope="col" className="py-1.5 font-normal text-right" title="O maior aluguel que uma propriedade dele cobraria no fim">Maior aluguel</th>
              </tr>
            </thead>
            <tbody>
              {confirmed.map((row) => (
                <tr key={row.playerId} data-rank={row.rank}>
                  <td className="endgame-rank py-2 pl-2 pr-2 text-cream-muted tabular-nums">{row.rank}º</td>
                  <td className="endgame-player py-2 pr-2 text-cream max-w-[9rem]">
                    <PlayerName playerId={row.playerId} dot />
                  </td>
                  <td data-label="Patrimônio" className="endgame-wealth py-2 pr-2 text-right currency text-cream">
                    {money(row.netWorth)}
                  </td>
                  <td data-label="Em caixa" className="endgame-cash py-2 pr-2 text-right currency text-cream-muted">
                    {money(row.cash)}
                  </td>
                  <td data-label="Países" className="endgame-countries py-2 pr-2 text-right text-cream-muted tabular-nums">
                    {row.countries || '·'}
                  </td>
                  <td data-label="Construções" className="endgame-buildings py-2 pr-2 text-right text-cream-muted tabular-nums">
                    {row.buildings || '·'}
                  </td>
                  <td data-label="Maior aluguel" className="endgame-toprent py-2 pr-2 text-right currency text-cream-muted">
                    {row.topRent > 0 ? money(row.topRent) : '·'}
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
        </section>

        <footer className="endgame-footer">
          <div className="endgame-meta" aria-label="Duração da partida">
            <span>
              <RotateCcw size={15} aria-hidden />
              {formatRounds(rounds)}
            </span>
            <span>
              <Clock3 size={15} aria-hidden />
              {formatDuration(durationMs)}
            </span>
          </div>

          <Button onClick={onExit} className="endgame-action">
            <DoorOpen size={18} aria-hidden />
            {online ? 'Voltar à sala' : 'Novo jogo'}
          </Button>
        </footer>
      </ModalShell>
    </Overlay>
  )
}
