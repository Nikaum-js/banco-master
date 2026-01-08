// Tipos de domínio do Fluxo de Turno (spec 002). Tudo serializável (JSON puro):
// nada de funções/refs no estado — pré-requisito de pausa/reconexão (FR-028).
import type { Title, ResolutionSlice, Loan, Immunity, TempEffect, LogEntry, Trade } from '../economy/types'
import type { DeckId } from '../cards/types'

export type SpeedFace = 1 | 2 | 3 | 'mr-banco' | 'onibus'

export type SpecialMove = 'mr-banco' | 'onibus' | 'triple' | null

export interface Roll {
  white: [number, number]
  speed: SpeedFace | null
  isDouble: boolean // só pelos dois dados brancos (FR-014)
  move: number // casas a mover (brancos + face numérica do Speed Die)
  special: SpecialMove
}

export type TurnState =
  | 'aguardando-rolagem'
  | 'prisao-decisao'
  | 'casa-a-resolver'
  | 'aguardando-finalizacao'
  | 'encerrado'

export interface JailState {
  inJail: boolean
  attempts: number // 0..3
}

export interface Player {
  id: string
  pos: number // 0..47
  completouPrimeiraVolta: boolean // gatilho do Speed Die (FR-005)
  jail: JailState
  eliminated: boolean // lido para pular na ordem (Falência)
  cash: number // saldo (semente $2.000, SRS §3.1) — introduzido por Compra & Aluguel (003)
  hand: string[] // ids de cartas na mão (≤ 3) — Sistema de Cartas (006)
  busTickets: number // contador separado (uso = spec Bus Tickets) — 006
  nextPurchaseDiscount: number // 0 normal; 0,2 após Investidor Anjo — 006
}

export type AwaitingChoice = 'onibus' | 'triple' | 'bus-ride' | null

export interface Turn {
  state: TurnState
  seat: number
  consecutiveDoubles: number // 0..2 (3 → prisão)
  lastRoll: Roll | null
  pendingResolve: boolean
  mayRollAgain: boolean
  awaitingChoice: AwaitingChoice
}

export type GamePhase = 'lobby' | 'playing' | 'ended'

// Notificação informativa (030, §12.2) — evento autônomo (não resolução): não bloqueia
// o turno; a UI exibe e dispensa. Serializável (princípio VII).
export type Notice =
  | { kind: 'free-parking'; playerId: string; amount: number } // coletou o pote
  | { kind: 'hostile-takeover'; victimId: string; attackerId: string; pos: number } // perdeu propriedade (Aquisição Hostil)

export interface GameState {
  players: Player[]
  turnOrder: number[] // índices em players (insumo do Lobby)
  activeSeat: number // índice em turnOrder
  turn: Turn
  paused: boolean // FR-028
  phase: GamePhase
  titles: Record<number, Title> // pos → posse (003); só casas compráveis
  resolution: ResolutionSlice | null // interação transitória de compra/leilão (003)
  decks: Record<DeckId, string[]> // ids de cartas por deck; topo = índice 0 (006)
  centerPot: number // pote do Free Parking (007); semente/reabastecimento $500
  loans: Loan[] // empréstimos ativos entre jogadores (010, §15)
  taxManPos: number // posição do Fiscal/Tax Man (012, §13.8); inicia em GO=0
  immunities: Immunity[] // imunidades de aluguel ativas (014, §8.4)
  tempEffects: TempEffect[] // efeitos temporários de carta (015, §10.6): apagão/greve/boicote/imunidade-temp
  log: LogEntry[] // eventos do jogo (021); bounded em 50, mais recentes ao fim
  pendingTrade: Trade | null // proposta de troca pendente (024); uma por vez; null = nenhuma
  tradeHistory: Trade[] // trocas aceitas (027); mais recentes ao fim, bounded ~12
  notice: Notice | null // notificação informativa ativa (030, §12.2); null = nenhuma
}
