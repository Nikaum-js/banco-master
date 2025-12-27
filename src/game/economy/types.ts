// Tipos da economia (Compra & Aluguel, spec 003). Autocontido (só primitivos) para
// evitar ciclo de imports — `turn/types.ts` importa daqui, não o contrário.
import type { DeckId } from '../cards/types'

export interface Title {
  ownerId: string | null // null = banco (livre)
  mortgaged: boolean // gerido pela spec Hipoteca; lido aqui para isentar aluguel
  houses: number // 0–4 (só cidades; aeroporto/utilidade ficam 0) — Construção (004)
  hotel: boolean // hotel construído (substitui 4 casas) — Construção (004); permanece true nos níveis acima
  hotel2: boolean // 2º hotel (nível 6) — Construção avançada (011, §14); não altera aluguel
  skyscraper: boolean // Skyscraper (nível 7) — Construção avançada (011, §13.7)
  hangar: boolean // Hangar de aeroporto — dobra o aluguel daquele aeroporto (011, §13.6)
}

export interface BankStock {
  houses: number // de 40 (D-017)
  hotels: number // de 16 (2º hotel consome do mesmo estoque)
  skyscrapers: number // estoque global de Skyscrapers (011, §13.7) — limite provisório de tema
}

export interface HouseAuction {
  housesAvailable: number
  currentBid: number
  highBidder: string | null
  activeBidders: string[]
  deadline: number // epoch ms — serializável
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
}

export interface TempEffect {
  kind: 'apagao' | 'greve' | 'boicote' | 'imunidade-temp' // efeitos temporários de carta (015, §10.6)
  ownerId: string // quem originou — relógio da expiração (passagem dele pelo GO)
  pos: number | null // propriedade (boicote/imunidade-temp) ou null (apagao/greve, board-wide)
  lapsRemaining: number // voltas restantes (apagao/greve: 1; boicote/imunidade-temp: 2)
}

export type ResolutionSlice =
  | { kind: 'purchase'; pos: number }
  | { kind: 'auction'; auction: Auction }
  | { kind: 'house-auction'; auction: HouseAuction } // leilão de casas em escassez (004)
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
