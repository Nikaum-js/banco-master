// Harness da suíte de rede (spec 037) — monta um hub in-memory com host + N clientes,
// relógio LÓGICO e RNG seedada, tudo síncrono. Espelha o setup real: sala montada no lobby,
// host inicia, clientes entram e leem o snapshot. Prova SC-001/003/004/005 sem infra.
import { createHost, type Host } from '@/net/host'
import { createClient, type Client } from '@/net/client'
import { LocalHub, localTransport } from '@/net/localTransport'
import { createRoom, joinRoom, startGame, SEAT_COLORS, type Room } from '@/net/room'
import type { Transport } from '@/net/transport'
import type { PlayerAction } from '@/game/commands'
import type { RNG } from '@/game/turn/dice'
import type { PauseCause, PauseState } from '@/game/turn/types'
import type { Telemetry } from '@/telemetry/port'
import { enumerateActions } from '../sim/engine/actions'
import { pickAction } from '../sim/engine/agent'
import type { SimSession } from '../sim/engine/driver'
import { mulberry32 } from '../sim/engine/rng'

// Monta um `PauseState` para suítes que montam estado diretamente (041, T004) — um lugar
// só para o literal `paused: true` de antes, para não envelhecer em doze velocidades.
export function pausedBy(cause: PauseCause, at = 0): PauseState {
  return { causes: [cause], since: at }
}

export interface NetPlayer {
  token: string
  playerId: string
  client: Client
  transport: Transport
}

export interface NetGame {
  hub: LocalHub
  clock: { t: number }
  host: Host
  players: NetPlayer[]
  advance(ms: number): void // avança o relógio lógico e fecha prazos vencidos
  serialized(): string[] // JSON de cada visão (host + clientes) — comparação de convergência

  // Faltas injetáveis (041, D14) — para as suítes escreverem CENÁRIO, não encanamento.
  dropChannel(playerId: string): void // queda de canal SEM contar como takeover (defeito 1)
  restoreChannel(playerId: string): void
  failWrites(n: number | 'always'): void // recusa a(s) próxima(s) gravação(ões) de snapshot
  reorderWrites(): void // a próxima gravação chega DEPOIS da seguinte (fora de ordem)
}

// Monta e inicia uma partida em rede com `playerCount` assentos. Ordem = entrada
// (idents[0] = host). Retorna tudo já sincronizado no estado inicial (snapshot seq 0).
//
// `telemetry` (044, T046): aditivo, opcional — a MAIORIA das suítes nem sabe que existe.
// Só quem precisa provar emissão (`tests/telemetry/emission.test.ts`) o passa.
export async function setupGame(playerCount: number, seed = 1, telemetry?: Telemetry): Promise<NetGame> {
  const hub = new LocalHub()
  const clock = { t: 1_000 }
  const rng = mulberry32(seed)

  const idents = Array.from({ length: playerCount }, (_, i) => ({
    token: `tok-${i}`,
    name: `P${i + 1}`,
    color: SEAT_COLORS[i],
  }))

  // Sala montada no lobby (host cria; convidados entram).
  let room: Room = createRoom('room-1', idents[0])
  for (let i = 1; i < playerCount; i++) {
    const r = joinRoom(room, idents[i])
    if (!r.ok) throw new Error(`join falhou: ${r.reason}`)
    room = r.room
  }
  const started = startGame(room)
  if (!started.ok) throw new Error(`start falhou: ${started.reason}`)
  room = started.room

  // Host: autoridade + client próprio, sobre a MESMA conexão. Autoridade inicia ANTES dos
  // clientes entrarem (snapshot precisa existir p/ a leitura de entrada).
  const hostTransport = localTransport(hub, idents[0].token)
  const host = createHost(hostTransport, room, { rng, now: () => clock.t, telemetry })
  await host.start()

  const players: NetPlayer[] = []
  for (let i = 0; i < playerCount; i++) {
    const transport = i === 0 ? hostTransport : localTransport(hub, idents[i].token)
    const client = createClient(transport)
    await client.join()
    players.push({ token: idents[i].token, playerId: `p${i + 1}`, client, transport })
  }

  return {
    hub,
    clock,
    host,
    players,
    advance(ms: number): void {
      clock.t += ms
      host.tick()
    },
    serialized(): string[] {
      return [JSON.stringify(host.game()), ...players.map((p) => JSON.stringify(p.client.game()))]
    },
    dropChannel(playerId: string): void {
      hub.dropChannel(players.find((p) => p.playerId === playerId)!.token)
    },
    restoreChannel(playerId: string): void {
      hub.restoreChannel(players.find((p) => p.playerId === playerId)!.token)
    },
    failWrites(n: number | 'always'): void {
      hub.failWrites(n)
    },
    reorderWrites(): void {
      hub.reorderWrites()
    },
  }
}

export function clientOf(net: NetGame, playerId: string): Client {
  const p = net.players.find((x) => x.playerId === playerId)
  if (!p) throw new Error(`sem cliente p/ ${playerId}`)
  return p.client
}

// Dá UM passo: fecha prazos vencidos, enumera as ações legais agora e faz o remetente
// legítimo (ator do ponto de decisão) enviar uma escolhida aleatoriamente. Retorna o comando
// enviado, ou null se a partida acabou / não há ação. Reusa o agente aleatório do harness 036.
export function stepOnce(net: NetGame, pickRng: RNG): { actorId: string; kind: string } | null {
  settleAuctions(net)
  if (net.host.game().phase === 'ended') return null
  const points = enumerateActions({ game: net.host.game() } as unknown as SimSession)
  if (points.length === 0) return null
  const { actorId, action } = pickAction(pickRng, points)
  clientOf(net, actorId).send(action as PlayerAction)
  return { actorId, kind: action.kind }
}

// Fecha leilões/pregões quando ninguém mais pode cobrir o lance — espelha
// `closeExhaustedAuctions` do driver do 036, adaptado ao relógio do host.
export function settleAuctions(net: NetGame): void {
  const g = net.host.game()
  if (g.paused) return
  if (g.resolution?.kind === 'auction') {
    const a = g.resolution.auction
    const canBid = a.activeBidders.some((id) => (g.players.find((p) => p.id === id)?.cash ?? 0) > a.currentBid)
    if (!canBid) net.advance(a.deadline - net.clock.t + 1)
  }
  const g2 = net.host.game()
  if (g2.landAuction && g2.landAuction.lots.length > 0) {
    const la = g2.landAuction
    const biddable = la.lots.some((lot) => la.bidders.some((id) => (g2.players.find((p) => p.id === id)?.cash ?? 0) > lot.currentBid))
    if (!biddable) net.advance(Math.min(...la.lots.map((l) => l.deadline)) - net.clock.t + 1)
  }
}
