// Tipos da economia (Compra & Aluguel, spec 003). Autocontido (só primitivos) para
// evitar ciclo de imports — `turn/types.ts` importa daqui, não o contrário.
import type { CardSlot, DeckId } from '../cards/types'

export interface Title {
  ownerId: string | null // null = banco (livre)
  mortgaged: boolean // gerido pela spec Hipoteca; lido aqui para isentar aluguel
  houses: number // 0–4 (só cidades; aeroporto/utilidade ficam 0) — Construção (004)
  hotel: boolean // hotel construído (substitui 4 casas) — Construção (004); permanece true nos níveis acima
  hotel2: boolean // 2º hotel (nível 6) — Construção avançada (011, §14); cobra mais que o 1º hotel
  skyscraper: boolean // Skyscraper (nível 7) — Construção avançada (011, §13.7)
  hangar: boolean // Hangar de aeroporto — dobra o aluguel daquele aeroporto (011, §13.6)
}

export interface Auction {
  pos: number
  currentBid: number // 0 = ainda sem lance
  highBidder: string | null
  activeBidders: string[]
  deadline: number // epoch ms — serializável; o timer é reconstruível (princípio VII)
}

// Leilão de escassez de TERRENOS (031, SRS §7.3) — pregão SIMULTÂNEO: cada lote é um
// leilão inglês próprio; todos compartilham um `deadline`. Evento autônomo, fora do turno.
// NÃO confundir com o leilão de CASAS (removido na D-022).
export interface LandLot {
  pos: number
  currentBid: number // 0 = ainda sem lance
  highBidder: string | null
  deadline: number // epoch ms — prazo PRÓPRIO deste lote; reinicia só com lance NELE; fecha sozinho
}

// Origem dos lotes de um pregão (039 / D-031). O MECANISMO é um só — pregão simultâneo —
// e o que distingue escassez de terrenos (§7.3) de espólio de falido (§9.2) é só de onde os
// lotes vieram. Nenhuma regra de lance ou de fecho lê este campo: ele existe para a UI poder
// contar ao jogador o que aconteceu. `mixed` = pregão que recebeu lotes de outra origem
// depois de aberto (sem ele, o título mentiria sobre ser de uma só).
export type AuctionOrigin = 'scarcity' | 'bankruptcy' | 'mixed'

export interface LandAuction {
  lots: LandLot[] // terrenos sem dono em disputa; cada lote fecha no seu próprio prazo
  bidders: string[] // jogadores não-eliminados participantes; RECALCULADO se um espólio entrar (039)
  origin: AuctionOrigin // 039 — de onde vieram os lotes
  bankruptId: string | null // 039 — quem faliu; null em pregão de escassez puro. ID, não nome:
  // nome de jogador vive na SALA, fora do GameState (D-019) — a UI resolve via identityOf (038).
}

export interface Loan {
  debtorId: string // tomou o empréstimo (máx. 1 ativo por devedor, §15.3)
  creditorId: string // concedeu
  principal: number // valor emprestado (> 0)
  ratePct: number // 10..50 — juros simples sobre o principal (§15.4), cobrados por GO
}

// Solicitação de empréstimo pendente (§15.2) — o devedor pediu a um credor específico;
// aguarda o credor definir a taxa (§15.3) e aceitar/recusar. Não há dinheiro movido ainda.
export interface LoanRequest {
  debtorId: string // solicitou (jogador da vez, em dívida pendente)
  creditorId: string // a quem foi pedido — define a taxa ao aceitar
  principal: number // = déficit no momento da solicitação (≤ caixa do credor)
}

export interface Immunity {
  beneficiaryId: string // quem não paga aluguel naquela propriedade (014, §8.4)
  pos: number // propriedade isenta
  lapsRemaining: number | null // voltas restantes; null = permanente (até o fim)
  granterId?: string // quem concedeu (setado na troca) — limpeza da eliminação §9.4 (019)
}

// Log de eventos tipado (040/D-032) — união discriminada por `kind`. O motor emite fatos
// estruturados; a frase em português é composta pela apresentação (`describeLogEntry`,
// src/game/ui/log/describeLog.ts), nunca aqui. `who` é sempre o id do AUTOR do fato (ou
// o literal 'bank'), nunca "Banco" em português dentro do estado.
//
// `ALL_LOG_KINDS` é a FONTE; `LogKind` deriva dela (não o contrário) — o teste de
// exaustividade (FR-026) itera sobre a lista em runtime, e uma lista escrita à mão ao lado
// da união poderia ficar desatualizada sem que o teste percebesse.
export const ALL_LOG_KINDS = [
  'roll', 'go', 'buy', 'rent', 'tax', 'bus-ticket-gain',
  'card-draw', 'card-immediate',
  'build', 'build-hangar', 'sell-building', 'sell-hangar',
  'mortgage', 'unmortgage',
  'auction-won', 'auction-unsold', 'lot-won', 'lot-unsold',
  'free-parking', 'jail-fine',
  'debt-paid', 'bankruptcy', 'trade',
  'loan-interest', 'loan-interest-short',
  'legacy',
] as const

export type LogKind = (typeof ALL_LOG_KINDS)[number]

// Faces especiais do dado (espelha `SpecialMove`/`SpeedFace` de `turn/types.ts`, sem
// importar de lá — este arquivo é autocontido para evitar ciclo de imports).
type LogRollSpecial = 'mr-banco' | 'onibus' | 'triple' | null

export type LogEntry =
  | { kind: 'roll'; who: string; white: [number, number]; isDouble: boolean; special: LogRollSpecial; speed: number | null; attempt: boolean }
  | { kind: 'go'; who: string; amount: number; landed: boolean }
  | { kind: 'buy'; who: string; pos: number; price: number }
  | { kind: 'rent'; who: string; pos: number; amount: number; ownerId: string }
  | { kind: 'tax'; who: string; amount: number }
  | { kind: 'bus-ticket-gain'; who: string }
  | { kind: 'card-draw'; who: string; deck: DeckId } // genérico por construção — sem carta nem raridade (FR-015, princípio VI)
  | { kind: 'card-immediate'; who: string; deck: DeckId; name: string; delta: number }
  | { kind: 'build'; who: string; pos: number; level: number; cost: number } // level = nível RESULTANTE (1-7)
  | { kind: 'build-hangar'; who: string; pos: number; cost: number }
  | { kind: 'sell-building'; who: string; pos: number; level: number; amount: number } // level = nível resultante
  | { kind: 'sell-hangar'; who: string; pos: number; amount: number }
  | { kind: 'mortgage'; who: string; pos: number; amount: number }
  | { kind: 'unmortgage'; who: string; pos: number; cost: number } // `cost`, não `amount`: o dinheiro SAI
  | { kind: 'auction-won'; who: string; pos: number; amount: number; winnerId: string } // who = 'bank'
  | { kind: 'auction-unsold'; who: string; pos: number } // who = 'bank'
  | { kind: 'lot-won'; who: string; pos: number; amount: number; winnerId: string; origin: AuctionOrigin } // who = 'bank'
  | { kind: 'lot-unsold'; who: string; pos: number; origin: AuctionOrigin } // who = 'bank'
  | { kind: 'free-parking'; who: string; amount: number } // princípio IV: só o valor, nada de catch-up
  | { kind: 'jail-fine'; who: string; amount: number }
  | { kind: 'debt-paid'; who: string; amount: number }
  | { kind: 'bankruptcy'; who: string }
  | { kind: 'trade'; who: string; toId: string } // who = fromId (o proponente é o autor)
  | { kind: 'loan-interest'; who: string; amount: number; creditorId: string }
  | { kind: 'loan-interest-short'; who: string; amount: number; creditorId: string; shortfall: number }
  | { kind: 'legacy'; who: string; what: string } // NUNCA emitida por reducer — só normalização de snapshot velho (FR-022)

export interface TempEffect {
  kind: 'apagao' | 'greve' | 'boicote' | 'imunidade-temp' // efeitos temporários de carta (015, §10.6)
  ownerId: string // quem originou — relógio da expiração (passagem dele pelo GO)
  pos: number | null // propriedade (boicote/imunidade-temp) ou null (apagao/greve, board-wide)
  lapsRemaining: number // voltas restantes (apagao/greve: 1; boicote/imunidade-temp: 2)
}

// Negociação (013/024) — troca entre dois jogadores. Aqui (não em trade.ts) para o
// GameState poder referenciar `pendingTrade` sem ciclo de imports.
export interface ImmunityGrant {
  pos: number // propriedade própria mantida sobre a qual se concede imunidade (§8.4)
  laps: number | null // voltas (inteiro > 0) ou null = permanente
}

export interface Trade {
  fromId: string
  toId: string
  fromProps: number[] // posições que `from` oferece
  fromCash: number // ≥ 0
  toProps: number[] // posições que `to` oferece
  toCash: number // ≥ 0
  fromBusTickets?: number // Bus Tickets que `from` oferece (≥ 0; D-028 — negociáveis, §8.2)
  toBusTickets?: number // Bus Tickets que `to` oferece
  fromImmunities?: ImmunityGrant[] // concedidas por `from` → beneficiário `to` (014)
  toImmunities?: ImmunityGrant[] // concedidas por `to` → beneficiário `from`
  fromImmunityTransfers?: number[] // posições de imunidades de que `from` é beneficiário, transferidas a `to` (028, §8.4)
  toImmunityTransfers?: number[] // imunidades de que `to` é beneficiário, transferidas a `from`
}

export type ResolutionSlice =
  | { kind: 'purchase'; pos: number }
  | { kind: 'auction'; auction: Auction }
  // 043, D-037: `cardId`/`drawnId` viram `CardSlot` — carta de MÃO alheia chega como `null`
  // (slot oculto, FR-027); `card-shortcut` fica `string` puro porque Atalho é IMEDIATO e
  // imediata nunca é redigida (D9/D10 do plan da 043).
  | { kind: 'card-reveal'; deckId: DeckId; cardId: CardSlot } // carta sacada revelada, aguardando "Continuar" (025)
  | { kind: 'card-discard'; deckId: DeckId; drawnId: CardSlot } // mão cheia: escolher descarte (006)
  | { kind: 'card-shortcut'; deckId: DeckId; cardId: string } // Atalho: escolher ±3 (006) — imediato, nunca oculto
  // Dívida pendente: pagar/falir (008). `origin: 'loan-interest'` marca dívida nascida FORA
  // da resolução da casa (juros no GO, §15.4) — quitar NÃO conclui a casa onde o jogador pousou.
  | { kind: 'debt'; amount: number; creditorId: string | null; origin?: 'loan-interest' }
  // Reação pendente (017): a carta ofensiva fica "em voo" aqui até o alvo responder.
  | {
      kind: 'reaction-diplomacia'
      reactorId: string
      attackerId: string
      effect: string
      cardId: string
      deck: DeckId
      targetPos: number | null
      targetPlayer: string | null
    }
  | { kind: 'reaction-bunker'; reactorId: string; amount: number }
