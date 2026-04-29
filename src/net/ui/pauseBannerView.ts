// VIEW-MODEL do banner de pausa (041, FR-016..020) — mesmo padrão `*View.ts` puro/testável
// do card 4 (038): o componente só desenha, a decisão de "o que a frase diz" vive aqui.
//
// A pausa pode ter DUAS causas ativas ao mesmo tempo (D-034/SRS §11.3-11.4 v1.7): a mesa só
// retoma quando NENHUMA persiste, e a frase nomeia TODAS as que estão ativas — nunca só a
// mais recente. Antes, uma pausa por persistência (sem ausentes) era invisível: `show`
// dependia de `ausentes.length > 0`, que só existe para a causa 'disconnect'.
import type { GameState } from '@/game/turn/types'
import { blockingSeats, type Room, type Seat } from '@/net/room'

export interface PauseBannerView {
  readonly ausentes: readonly Seat[] // quem está desconectado e trava a mesa (vazio se só 'persistence')
  readonly hostFora: boolean
  /** Como a frase termina após "Aguardando " (+ nomes, se houver): "reconectar", "o
   * host voltar", "o salvamento voltar", ou a junção das duas causas com "e". */
  readonly tail: string
}

export function pauseBannerView(game: GameState, room: Room | null): PauseBannerView | null {
  if (!room) return null // cliente único: a pausa local é do próprio jogador, sem banner
  const paused = game.paused
  if (!paused) return null

  // Eliminados não travam a mesa (D-029) — e por isso também não aparecem aqui.
  const eliminados = new Set(game.players.filter((p) => p.eliminated).map((p) => p.id))
  const ausentes = blockingSeats(room, eliminados)
  const hostFora = ausentes.some((s) => s.isHost)

  const clauses: string[] = []
  if (paused.causes.includes('disconnect')) clauses.push(hostFora ? 'o host voltar' : 'reconectar')
  if (paused.causes.includes('persistence')) clauses.push('o salvamento voltar')

  return { ausentes, hostFora, tail: clauses.join(' e ') }
}
