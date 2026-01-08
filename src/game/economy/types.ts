// Tipos da economia (Compra & Aluguel, spec 003). Autocontido (só primitivos) para
// evitar ciclo de imports — `turn/types.ts` importa daqui, não o contrário.
import type { DeckId } from '../cards/types'

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

export interface Loan {
  debtorId: string // tomou o empréstimo (máx. 1 ativo por devedor, §15.3)
  creditorId: string // concedeu
  principal: number // valor emprestado (> 0)
  ratePct: number // 10..50 — juros simples sobre o principal (§15.4), cobrados por GO
}

export interface Immunity {
  beneficiaryId: string // quem não paga aluguel naquela propriedade (014, §8.4)
  pos: number // propriedade isenta
  lapsRemaining: number | null // voltas restantes; null = permanente (até o fim)
  granterId?: string // quem concedeu (setado na troca) — limpeza da eliminação §9.4 (019)
}

export interface LogEntry {
  who: string // id do jogador (ou "Banco") — sem timestamp; recência = ordem no log (021)
  what: string
}

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
  fromImmunities?: ImmunityGrant[] // concedidas por `from` → beneficiário `to` (014)
  toImmunities?: ImmunityGrant[] // concedidas por `to` → beneficiário `from`
  fromImmunityTransfers?: number[] // posições de imunidades de que `from` é beneficiário, transferidas a `to` (028, §8.4)
  toImmunityTransfers?: number[] // imunidades de que `to` é beneficiário, transferidas a `from`
}

export type ResolutionSlice =
  | { kind: 'purchase'; pos: number }
  | { kind: 'auction'; auction: Auction }
  | { kind: 'card-reveal'; deckId: DeckId; cardId: string } // carta sacada revelada, aguardando "Continuar" (025)
  | { kind: 'card-discard'; deckId: DeckId; drawnId: string } // mão cheia: escolher descarte (006)
  | { kind: 'card-shortcut'; deckId: DeckId; cardId: string } // Atalho: escolher ±3 (006)
  | { kind: 'debt'; amount: number; creditorId: string | null } // dívida pendente: pagar/falir (008)
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
