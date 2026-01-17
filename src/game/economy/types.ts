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

// Pregão SIMULTÂNEO (SRS §7.3) — cada lote é um leilão inglês próprio, com prazo próprio.
// Evento autônomo, fora do turno. DUAS procedências: escassez de terrenos (§7.5, 031/D-060) e
// espólio do falido (§9.2, 039/D-031). NÃO confundir com o leilão de CASAS (removido, D-022).
export interface LandLot {
  pos: number
  currentBid: number // 0 = ainda sem lance
  highBidder: string | null
  deadline: number // epoch ms — prazo PRÓPRIO deste lote; reinicia só com lance NELE; fecha sozinho
}

// Origem dos lotes de um pregão (031/039). O MECANISMO é um só — pregão simultâneo — e o que
// distingue escassez de terrenos (§7.5) de espólio de falido (§9.2) é só de onde os lotes
// vieram. Nenhuma regra de lance ou de fecho lê este campo: ele existe para a UI poder contar
// ao jogador o que aconteceu. `mixed` = pregão que recebeu lotes de outra origem depois de
// aberto (sem ele, o título mentiria sobre ser de uma só). Saiu na D-059 com a escassez;
// voltou na D-060 junto com ela, porque o mecanismo voltou a ter duas entradas.
export type AuctionOrigin = 'scarcity' | 'bankruptcy' | 'mixed'

export interface LandAuction {
  lots: LandLot[] // terrenos sem dono em disputa; cada lote fecha no seu próprio prazo
  bidders: string[] // jogadores não-eliminados participantes; RECALCULADO se um espólio entrar (039)
  origin: AuctionOrigin // 031/039 — de onde vieram os lotes
  bankruptId: string | null // 039 — quem faliu; null em pregão de escassez puro. ID, não nome:
  // nome de jogador vive na SALA, fora do GameState (D-019) — a UI resolve via identityOf (038).
}

export interface Loan {
  debtorId: string // tomou o empréstimo (máx. 1 ativo por devedor, §15.3)
  creditorId: string // concedeu
  principal: number // valor emprestado (> 0)
  ratePct: number // 10..50 — juros simples sobre o principal (§15.4), cobrados por GO
  // Passagens do devedor pelo GO desde a concessão (§15.6, D-054). Vence em LOAN_TERM_LAPS,
  // e o empréstimo é removido no MESMO passo — o valor de vencimento nunca fica no estado.
  // Opcional porque snapshot gravado antes da D-054 não tem o campo: `lapsElapsedOf` lê
  // ausente como 0 (conservador — não há histórico de GO para recuperar).
  lapsElapsed?: number
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
  'mortgage', 'unmortgage', 'sell-to-bank',
  'auction-won', 'auction-unsold', 'lot-won', 'lot-unsold',
  'free-parking', 'jail-fine',
  'debt-open', 'debt-paid', 'bankruptcy', 'concede', 'trade',
  // D-063 — seis regras que moviam caixa sem emitir fato nenhum:
  'tax-man', 'hostile-takeover', 'audit', 'evict', 'card-collect', 'swap',
  'loan-interest', 'loan-interest-short', 'loan-due', 'loan-due-short',
  // 058/US2 — a reação USADA era o único desfecho do jogo sem fato nenhum.
  'reaction-blocked',
  'legacy',
] as const

export type LogKind = (typeof ALL_LOG_KINDS)[number]

// Faces especiais do dado (espelha `SpecialMove`/`SpeedFace` de `turn/types.ts`, sem
// importar de lá — este arquivo é autocontido para evitar ciclo de imports).
type LogRollSpecial = 'mr-magnata' | 'onibus' | 'triple' | null

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
  // D-072: compatibilidade de leitura para logs persistidos; nenhum reducer novo emite.
  | { kind: 'smoke-tax'; who: string; pos: number; amount: number }
  | { kind: 'rail-hop'; who: string; from: number; to: number } // Desvio pela Ferrovia (D-070)
  | { kind: 'build-hangar'; who: string; pos: number; cost: number }
  | { kind: 'sell-building'; who: string; pos: number; level: number; amount: number } // level = nível resultante
  | { kind: 'sell-hangar'; who: string; pos: number; amount: number }
  | { kind: 'mortgage'; who: string; pos: number; amount: number }
  | { kind: 'unmortgage'; who: string; pos: number; cost: number } // `cost`, não `amount`: o dinheiro SAI
  // §6.4/D-062 — devolução da hipotecada ao banco. `amount` é SEMPRE 0 (a metade do preço já
  // foi paga na hipoteca); o campo existe para o zero ser um fato registrado, não um silêncio.
  | { kind: 'sell-to-bank'; who: string; pos: number; amount: number }
  | { kind: 'auction-won'; who: string; pos: number; amount: number; winnerId: string } // who = 'bank'
  | { kind: 'auction-unsold'; who: string; pos: number } // who = 'bank'
  | { kind: 'lot-won'; who: string; pos: number; amount: number; winnerId: string; origin: AuctionOrigin } // who = 'bank'
  | { kind: 'lot-unsold'; who: string; pos: number; origin: AuctionOrigin } // who = 'bank'
  | { kind: 'free-parking'; who: string; amount: number } // princípio IV: só o valor, nada de catch-up
  | { kind: 'jail-fine'; who: string; amount: number }
  // D-063 — abertura de dívida era MUDA: só o pagamento tinha fato. Sem isto, a única
  // evidência de que uma cobrança virou dívida era a faixa na tela de quem devia.
  | { kind: 'debt-open'; who: string; amount: number; creditorId: string | null; cause: DebtCause }
  | { kind: 'debt-paid'; who: string; amount: number; creditorId: string | null }
  | { kind: 'bankruptcy'; who: string }
  | { kind: 'concede'; who: string } // saída voluntária (§9.6/D-057) — fato distinto da falência
  // `fromDelta`/`toDelta` (D-063): a troca movia caixa dos DOIS lados e o fato registrava só
  // quem trocou com quem. Um Δcaixa sem valor no log é indistinguível de um bug.
  | { kind: 'trade'; who: string; toId: string; fromDelta: number; toDelta: number } // who = fromId
  | { kind: 'loan-interest'; who: string; amount: number; creditorId: string }
  | { kind: 'loan-interest-short'; who: string; amount: number; creditorId: string; shortfall: number }
  // Vencimento das 3 voltas (§15.6): `amount` é o que SAIU do devedor. No `-short`, saiu tudo
  // o que havia e `shortfall` virou dívida pendente ao credor. `principal`/`interest` quebram
  // o total porque a narrativa precisa dizer que aquilo encerra o contrato, não é mais uma volta.
  | { kind: 'loan-due'; who: string; amount: number; creditorId: string; principal: number; interest: number }
  | { kind: 'loan-due-short'; who: string; amount: number; creditorId: string; shortfall: number }
  // Fiscal (§13.8) — `who` é o DONO cobrado, que quase nunca é o jogador da vez. Era a única
  // regra do jogo a debitar fora da vez, e era muda: três relatos de bug financeiro distintos
  // ("perdi dinheiro fora da vez", "perdi 200 fora da vez", "as contas oscilam") descrevem
  // exatamente isto. `amount` é o que SAIU (truncado ao caixa, §9.1 — o Fiscal não abre dívida).
  | { kind: 'tax-man'; who: string; pos: number; amount: number; due: number }
  // Aquisição Hostil (§10.6) — `who` = atacante. Tinha `notice` efêmero, nunca fato no log.
  | { kind: 'hostile-takeover'; who: string; pos: number; amount: number; victimId: string }
  | { kind: 'audit'; who: string; targetId: string; amount: number } // Imposto Federal (ex-Auditoria, D-064) — who = atacante
  | { kind: 'evict'; who: string; pos: number; victimId: string } // Confisco Geral (ex-Despejo, D-064) — sem dinheiro, mas destrói valor
  // Permuta Forçada (D-064) — who = atacante entrega `posGiven` e leva `posTaken` de `victimId`.
  | { kind: 'swap'; who: string; posGiven: number; posTaken: number; victimId: string }
  // Carta imediata que move o caixa de quem NÃO sacou (Aniversário, Boom, Crise). `card-immediate`
  // registra só o delta do sacador; os outros mudavam de saldo sem fato. `delta` é assinado;
  // `counterpartId` é quem está do outro lado ('bank' quando é banco/pote).
  // `due` é o que a REGRA queria mover; `delta` é o que de fato moveu. Os dois separados porque
  // sem eles não se distingue pagamento completo de truncado — e foi exatamente essa confusão
  // que fez o invariante de não-truncagem acusar falso positivo em quem tinha o valor exato.
  | { kind: 'card-collect'; who: string; name: string; delta: number; due: number; counterpartId: string }
  // Reação que ANULOU uma ofensiva (058/US2, §10.6). `who` é o REATOR — o autor do fato é
  // quem jogou a carta que produziu o desfecho, e o desfecho é o cancelamento.
  //
  // Sem isto, usar Diplomacia era indistinguível de bug: a ofensiva não logava (foi
  // cancelada) e a reação também não, então a mesa via a carta cara do atacante sair da mão
  // e nada acontecer. `effect` é o id CANÔNICO do efeito ofensivo ('aquisicaoHostil'), nunca
  // o rótulo em português — a frase é composta pela apresentação, como em todo o resto.
  //
  // Público só a partir daqui: a janela de reação vaza a EXISTÊNCIA da carta (§10.3), e o
  // uso a torna uma jogada como outra qualquer. Antes do uso, nada é registrado.
  | {
      kind: 'reaction-blocked'
      who: string // reator
      attackerId: string
      effect: string // id canônico do efeito cancelado
      reaction: string // id canônico da reação usada ('diplomacia')
      targetPos: number | null // propriedade alvo, quando a ofensiva tem uma
      targetPlayer: string | null // jogador alvo, quando a ofensiva mira gente
    }
  | { kind: 'legacy'; who: string; what: string } // NUNCA emitida por reducer — só normalização de snapshot velho (FR-022)

export interface TempEffect {
  // Efeitos temporários de carta (015, §10.6). D-064 acrescenta: estatização (aluguel → Loteria),
  // valorização (aluguel ×2 numa propriedade própria), embargo (alvo não constrói) e
  // imunidade-total (jogador não paga aluguel/imposto nem é alvo de efeito negativo).
  // `imunidade-temp` não tem mais fonte (a carta virou Imunidade Total) — fica no tipo por
  // compatibilidade de snapshot em voo.
  kind: 'apagao' | 'greve' | 'boicote' | 'imunidade-temp' | 'estatizacao' | 'valorizacao' | 'embargo' | 'imunidade-total'
  ownerId: string // quem originou — relógio da expiração (passagem dele pelo GO)
  pos: number | null // propriedade (boicote/valorizacao) ou null (efeitos board-wide/de jogador)
  lapsRemaining: number // voltas restantes (apagao/greve/valorizacao/imunidade-total/estatizacao: 1 — a última desde a D-080; boicote/embargo: 2)
  targetId?: string // embargo (D-064): jogador proibido de construir
}

// Negociação (013/024/047) — troca entre dois jogadores e seu envelope persistente.
// Aqui (não em trade.ts) para o GameState referenciar propostas sem ciclo de imports.
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

export interface TradeProposal {
  id: number // monotônico e único durante a partida (D-048)
  trade: Trade
}

// Obrigação pendente (§9.1, D-061) — o RESTO de uma cobrança a outro jogador que o caixa não
// cobriu. Fila, porque uma carta pode deixar vários devedores curtos e o slot de decisão é um.
export interface Obligation {
  debtorId: string
  creditorId: string | null // null = banco/pote (hoje só a fila de jogador usa; reservado)
  amount: number // > 0 — o que AINDA falta
  cause: DebtCause
}

// Causa da dívida pendente (D-063) — narrada na abertura e o que a UI usa para explicar de
// onde a cobrança veio. `obligation` é a novidade da D-061: o RESTO de uma obrigação a outro
// jogador que o caixa não cobriu.
export type DebtCause = 'rent' | 'tax' | 'bunker-tax' | 'loan-interest' | 'loan-due' | 'obligation'

export type ResolutionSlice =
  | { kind: 'purchase'; pos: number }
  | { kind: 'auction'; auction: Auction }
  // 043, D-037: `cardId`/`drawnId` viram `CardSlot` — carta de MÃO alheia chega como `null`
  // (slot oculto, FR-027); `card-shortcut` fica `string` puro porque Atalho é IMEDIATO e
  // imediata nunca é redigida (D9/D10 do plan da 043).
  | { kind: 'card-reveal'; deckId: DeckId; cardId: CardSlot } // carta sacada revelada, aguardando "Continuar" (025)
  | { kind: 'card-discard'; deckId: DeckId; drawnId: CardSlot } // mão cheia: escolher descarte (006)
  | { kind: 'card-shortcut'; deckId: DeckId; cardId: string } // Atalho: escolher ±3 (006) — imediato, nunca oculto
  // Dívida pendente: pagar/falir (008). `origin` marca dívida nascida FORA da resolução da
  // casa — juros no GO (§15.4) ou vencimento do empréstimo (§15.6) —, e quitar NÃO conclui a
  // casa onde o jogador pousou. Dois nomes porque a narrativa distingue os dois fatos; para o
  // fluxo de pagamento os dois são o mesmo caso (ver `bornInMovement` em falencia.ts).
  // `debtorId` (D-061) — QUEM deve. Até aqui a dívida era implicitamente do jogador ativo
  // (`payDebt`/`declareBankruptcy` liam `activePlayer`), e era exatamente por isso que a única
  // saída para uma cobrança fora da vez era truncar o valor. Nomeando o devedor, a dívida de
  // quem não está na vez passa a ser representável — e a mesa a aguarda como já aguarda uma
  // reação a carta ofensiva. Snapshot anterior não tem o campo: ausente lê-se como o jogador
  // ativo daquele snapshot, que era a semântica implícita (`debtorOf`).
  | {
      kind: 'debt'
      amount: number
      creditorId: string | null
      debtorId?: string
      cause?: DebtCause
      origin?: 'loan-interest' | 'loan-due'
    }
  // Reação pendente (017): a carta ofensiva fica "em voo" aqui até o alvo responder.
  // `targetPos2` (D-064): segunda posição da Permuta Forçada (a propriedade PRÓPRIA do
  // atacante); opcional para snapshot anterior continuar válido.
  | {
      kind: 'reaction-diplomacia'
      reactorId: string
      attackerId: string
      effect: string
      cardId: string
      deck: DeckId
      targetPos: number | null
      targetPlayer: string | null
      targetPos2?: number | null
    }
  | { kind: 'reaction-bunker'; reactorId: string; amount: number }
