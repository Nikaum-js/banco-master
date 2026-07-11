// Tipos de domínio do Fluxo de Turno (spec 002). Tudo serializável (JSON puro):
// nada de funções/refs no estado — pré-requisito de pausa/reconexão (FR-028).
import type { Title, ResolutionSlice, Loan, LoanRequest, Immunity, TempEffect, LogEntry, Obligation, Trade, TradeProposal, LandAuction } from '../economy/types'
import type { CardSlot, DeckId } from '../cards/types'

export type SpeedFace = 1 | 2 | 3 | 'mr-magnata' | 'onibus'

export type SpecialMove = 'mr-magnata' | 'onibus' | 'triple' | null

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
  cash: number // saldo (semente do tema, SRS §3.1) — introduzido por Compra & Aluguel (003)
  // ids de cartas na mão (≤ 3) — Sistema de Cartas (006). 043, D-037: `CardSlot[]`, não
  // `CardId[]` — na perspectiva da AUTORIDADE nunca há `null` (comprimento é a única verdade
  // pública numa mão alheia; ver data-model §4).
  hand: CardSlot[]
  busTickets: number // contador separado (uso = spec Bus Tickets) — 006
  nextPurchaseDiscount: number // 0 normal; 0,2 após Investidor Anjo — 006
  // D-064 — flags de carta consumíveis. Opcionais: snapshot/fixture antigo lê ausente como false.
  nextBuildFree?: boolean // Obra Relâmpago: próxima construção (casa/hotel/arranha-céu/Hangar) grátis
  doubleRentOnce?: boolean // Obras na Pista: o próximo aluguel que este jogador pagar é dobrado
}

export type AwaitingChoice = 'onibus' | 'triple' | null

export interface Turn {
  state: TurnState
  seat: number
  consecutiveDoubles: number // 0..2 (3 → prisão)
  lastRoll: Roll | null
  pendingResolve: boolean
  mayRollAgain: boolean
  awaitingChoice: AwaitingChoice
  /**
   * O Desvio pela Ferrovia (D-073) já foi usado NESTE turno?
   *
   * Sem esta flag a regra se auto-realimenta: as condições de `canRailHop` são "estou numa
   * ferrovia minha" + "tenho outra" + "turno aguardando finalização", e depois de embarcar as
   * TRÊS voltam a ser verdade — você pousa noutra ferrovia sua e o turno volta ao mesmo estado.
   * O resultado era embarcar de estação em estação infinitamente, de graça, no mesmo turno.
   * O limite é por TURNO e não por casa: senão dois embarques em ferrovias diferentes ainda
   * fechariam o ciclo.
   */
  railHopUsed: boolean
}

export type GamePhase = 'lobby' | 'playing' | 'ended'

// Queda registrada na ORDEM em que a falência foi processada (044, §9.4). Guarda a
// rodada junto do id porque a rodada da queda não é derivável de um estado que já
// avançou — um campo, não dois que possam discordar (data-model §1).
export interface EliminationRecord {
  playerId: string
  round: number
}

// Causa da pausa (041, D-034): a mesa pode estar parada por mais de um motivo ao
// mesmo tempo — a partida só retoma quando nenhuma causa ativa resta.
export type PauseCause = 'disconnect' | 'persistence'

export interface PauseState {
  causes: PauseCause[] // ativas, ordenadas, sem duplicata; nunca vazio (vazio = null)
  since: number // instante da PRIMEIRA causa ativa; não reinicia quando outra entra
}

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
  paused: PauseState | null // FR-028; causa e relógio da pausa (041, D-034)
  phase: GamePhase
  titles: Record<number, Title> // pos → posse (003); só casas compráveis
  resolution: ResolutionSlice | null // interação transitória de compra/leilão (003)
  decks: Record<DeckId, CardSlot[]> // ids de cartas por deck; topo = índice 0 (006). 043, D-037: idem `hand`.
  centerPot: number // pote do Free Parking (007); semente/reabastecimento definidos no tema
  loans: Loan[] // empréstimos ativos entre jogadores (010, §15)
  pendingLoan: LoanRequest | null // solicitação de empréstimo aguardando resposta do credor (§15.2); uma por vez
  // `taxManPos` saiu na D-065 (o Fiscal saiu do jogo). Snapshot anterior ainda traz o campo, e
  // campo a mais não quebra desserialização.
  immunities: Immunity[] // imunidades de aluguel ativas (014, §8.4)
  tempEffects: TempEffect[] // efeitos temporários de carta (015, §10.6): apagão/greve/boicote/imunidade-temp
  log: LogEntry[] // eventos do jogo (021); bounded em 50, mais recentes ao fim
  tradeProposals: TradeProposal[] // propostas simultâneas e independentes (047, D-048)
  nextTradeProposalId: number // próximo id monotônico; começa em 1 e nunca reutiliza
  // Obrigações a outro jogador ainda não pagas (§9.1, D-061). O slot `resolution` cabe UMA
  // decisão; esta fila guarda as demais até a vez delas. Snapshot anterior à D-061 não tem o
  // campo — `normalizeGame` lê ausente como `[]`, que é a semântica de antes (nada devido).
  obligations: Obligation[]
  landAuction: LandAuction | null // pregão simultâneo (031 §7.5 / 039 §9.2); evento autônomo, fora do turno
  landAuctionArmed: boolean // trava de episódio do pregão de escassez (031/D-060): true = pode disparar nesta "descida" a ≤3
  tradeHistory: Trade[] // trocas aceitas (027); mais recentes ao fim, bounded ~12
  notice: Notice | null // notificação informativa ativa (030, §12.2); null = nenhuma

  /** Quedas na ORDEM em que a falência foi processada (044, §9.4). Primeiro a cair =
   *  índice 0. Único insumo da classificação final (D-038). Nunca reordenado, nunca
   *  removido: `bankrupt` roda uma vez por devedor, e `eliminated` é definitivo. */
  eliminationOrder: EliminationRecord[]

  /** Voltas completas na ordem de assentos desde o início (044). Começa em 1 (a
   *  partida começa NA primeira rodada). Incrementa em `advanceSeat` quando a busca
   *  do próximo assento dá a volta na ordem — nunca decresce, é o mesmo em toda tela. */
  round: number

  /** Instante do início da partida (044), injetado (`ctx.now`/`Date.now()` na borda,
   *  nunca dentro de um reducer). `0` = sem relógio (partidas de teste) — a duração
   *  então é apresentada como indisponível. */
  startedAt: number

  /** Instante em que `phase` virou `'ended'` (044), gravado por `checkEndGame` a
   *  partir do mesmo relógio injetado. `null` enquanto a partida não terminou. */
  endedAt: number | null
}
