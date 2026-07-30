import { PlayerFace } from '@/boards/PlayerFace'
import {
  deriveRoomStats,
  normalizeMatchHistory,
  type RoomMatchHistoryEntry,
} from '@/net/roomHistory'

function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString('pt-BR')}`
}

function duration(ms: number | null): string {
  if (ms === null) return 'Indisponível'
  const minutes = Math.max(0, Math.round(ms / 60_000))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours > 0 ? `${hours}h ${String(rest).padStart(2, '0')}min` : `${rest}min`
}

function endedAt(value: number | null): string {
  if (value === null) return 'Horário indisponível'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function decimal(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

export function RoomHistoryPanel({ history }: { history: readonly RoomMatchHistoryEntry[] }) {
  const entries = normalizeMatchHistory(history)
  const stats = deriveRoomStats(entries)
  const newestFirst = [...entries].reverse()

  return (
    <details className="room-history-panel">
      <summary>
        <span>
          <strong>Histórico da sala</strong>
          <small>Partidas e estatísticas deste grupo</small>
        </span>
        <span className="room-history-panel__count">
          {entries.length} {entries.length === 1 ? 'partida' : 'partidas'}
        </span>
      </summary>

      <div className="room-history-panel__body">
        {entries.length === 0 ? (
          <p className="room-history-panel__empty">
            A primeira partida finalizada aparecerá aqui.
          </p>
        ) : (
          <>
            <section aria-labelledby="room-history-stats-title">
              <div className="room-history-panel__heading">
                <h3 id="room-history-stats-title">Estatísticas da sala</h3>
                <div className="room-history-panel__averages">
                  <span>
                    <small>Duração média</small>
                    <strong>{duration(stats.averageDurationMs)}</strong>
                  </span>
                  <span>
                    <small>Média de rodadas</small>
                    <strong>{decimal(stats.averageRounds)}</strong>
                  </span>
                </div>
              </div>

              <div className="room-history-players">
                {stats.players.map((player) => (
                  <article key={player.historyId} className="room-history-player">
                    <PlayerFace
                      color={player.color}
                      avatar={player.avatar}
                      skin={player.skin}
                      size={30}
                    />
                    <span className="room-history-player__identity">
                      <strong>{player.name}</strong>
                      <small>
                        {player.wins} {player.wins === 1 ? 'vitória' : 'vitórias'} ·{' '}
                        {Math.round(player.winRate * 100)}%
                      </small>
                    </span>
                    <span className="room-history-player__numbers">
                      <small>{player.matches}j · média {decimal(player.averageRank)}º</small>
                      <strong>{money(player.bestNetWorth)}</strong>
                    </span>
                  </article>
                ))}
              </div>
            </section>

            <section aria-labelledby="room-history-matches-title">
              <h3 id="room-history-matches-title" className="room-history-panel__matches-title">
                Partidas recentes
              </h3>
              <div className="room-history-matches">
                {newestFirst.map((entry, index) => {
                  const winner = entry.standings.find((standing) => standing.rank === 1)
                  return (
                    <details
                      key={entry.generation}
                      className="room-history-match"
                      open={index === 0 ? true : undefined}
                    >
                      <summary>
                        <span>
                          <strong>Partida {entry.generation + 1}</strong>
                          <small>{endedAt(entry.endedAt)}</small>
                        </span>
                        <span>
                          <small>{entry.rounds} rodadas · {duration(entry.durationMs)}</small>
                          <strong>{winner?.name ?? 'Classificação parcial'}</strong>
                        </span>
                      </summary>
                      <div className="room-history-match__table-wrap">
                        <table>
                          <caption className="sr-only">
                            Classificação da partida {entry.generation + 1}
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">Pos.</th>
                              <th scope="col">Jogador</th>
                              <th scope="col">Patrimônio</th>
                              <th scope="col">Imóveis</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.standings.map((standing) => (
                              <tr key={standing.historyId}>
                                <td>{standing.rank}º</td>
                                <th scope="row">{standing.name}</th>
                                <td>{money(standing.netWorth)}</td>
                                <td>{standing.properties}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </details>
  )
}
