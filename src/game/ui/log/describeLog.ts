// Descritor do log (040/D-032) — a ÚNICA fronteira onde o fato tipado vira frase em
// português. O motor emite `LogEntry` (fatos); esta camada compõe `LogSentence` (fragmentos
// tipados, não string — contrato §2) a partir dos campos do evento + a identidade da sala.
// Pura: `room` é parâmetro, nunca hook (4.5 do research) — é o que torna SC-001 (zero id na
// frase) verificável por inspeção da estrutura, sem montar React.
import type { LogEntry } from '@/game/economy/types'
import { identityOf, type PlayerIdentity } from '@/net/identity'
import type { Room } from '@/net/room'

export type LogFragment =
  | { t: 'text'; text: string }
  | { t: 'money'; amount: number }
  | { t: 'player'; identity: PlayerIdentity }
  | { t: 'place'; pos: number }

export type LogSentence = LogFragment[]

function assertNever(x: never): never {
  throw new Error(`LogKind não tratado pelo descritor: ${JSON.stringify(x)}`)
}

const text = (s: string): LogFragment => ({ t: 'text', text: s })
const money = (amount: number): LogFragment => ({ t: 'money', amount })
const place = (pos: number): LogFragment => ({ t: 'place', pos })

// Autor/alvo do fato: 'bank' vira o texto "Banco" (nunca um fragmento de jogador — o
// banco não tem assento na sala, FR-018); qualquer outro id resolve pela identidade da
// sala, com o fallback da 038 quando `room` é null.
function who(room: Room | null, id: string): LogFragment {
  if (id === 'bank') return text('Banco')
  return { t: 'player', identity: identityOf(room, id) }
}

// Nome legível a partir do id da carta ('investidor-anjo-2' → 'Investidor Anjo').
// Espelha `cardNameFromId` de `cards/draw.ts` — carta imediata é pública (§12.2), o nome
// já chega pronto no campo `name` do evento, então aqui só se casa o nome com a frase.
const CARD_FIXED_PHRASE: Record<string, string> = {
  'Va Prisao': 'foi para a Prisão',
  'Volte 3': 'voltou 3 casas',
  'Apagao': 'Apagão: hangares ficam inativos por 1 volta',
  'Greve Utilidades': 'Greve: utilidades sem aluguel por 1 volta',
  'Investidor Anjo': 'Investidor Anjo: 20% de desconto na próxima compra',
  'Passagem Onibus': 'ganhou 1 Bus Ticket',
}

// Cartas cujo efeito varia com `delta` (dCash de `describeImmediate`, pré-040) — a fase
// verbal muda com o sinal, mas o valor em si é sempre o mesmo campo do evento.
function cardImmediatePhrase(name: string, delta: number): LogSentence {
  const fixed = CARD_FIXED_PHRASE[name]
  if (fixed) return [text(fixed)]
  switch (name) {
    case 'Atalho':
      return [text('Atalho: escolhendo direção')]
    case 'Volta Go':
      return [text('foi para o GO (+'), money(delta), text(')')]
    case 'Avance 3':
      return delta > 0 ? [text('avançou 3 casas e passou no GO (+'), money(delta), text(')')] : [text('avançou 3 casas')]
    case 'Refinanciamento':
      return delta < 0
        ? [text('desipotecou uma propriedade pagando só 5% de juros ('), money(-delta), text(')')]
        : [text('Refinanciamento desipotecaria uma propriedade a juros de só 5%, mas não havia nada hipotecado')]
    case 'Conserto Imoveis':
      return delta < 0
        ? [text('pagou '), money(-delta), text(' de conserto dos imóveis ($25/casa, $100/hotel)')]
        : [text('Conserto de Imóveis cobraria $25/casa e $100/hotel, mas não havia construções')]
    case 'Crise Imobiliaria':
      return delta < 0
        ? [text('pagou '), money(-delta), text(' na crise (5% do patrimônio)')]
        : [text('Crise imobiliária cobraria 5% do patrimônio, mas não havia o que cobrar')]
    case 'Aniversario':
      return delta > 0
        ? [text('recebeu '), money(delta), text(' de aniversário (cada adversário paga $10)')]
        : [text('Aniversário: cada adversário pagaria $10, mas não há outro jogador para cobrar')]
    case 'Honorarios':
      return [text('pagou '), money(-delta), text(' de honorários')]
    case 'Boom Economico':
      return [text('Boom econômico: todos que ainda estão na partida receberam '), money(delta)]
    default: // erroBanco, boomEconomico e demais efeitos baseados só em caixa
      if (delta < 0) return [text('pagou '), money(-delta)]
      if (delta > 0) return [text('recebeu '), money(delta)]
      return [text('nenhum efeito')]
  }
}

// Substantivo do degrau construído — deriva de `level` (nível RESULTANTE, D5 do plan):
// 1-4 = casas, 5 = hotel, 6 = 2º hotel, 7 = arranha-céu (ladder de `construction.ts`).
function buildingNoun(level: number): string {
  if (level <= 4) return `${level}ª casa`
  if (level === 5) return 'hotel'
  if (level === 6) return '2º hotel'
  return 'arranha-céu'
}

export function describeLogEntry(entry: LogEntry, room: Room | null): LogSentence {
  switch (entry.kind) {
    case 'roll':
      return [who(room, entry.who), text(` rolou ${entry.white[0]}+${entry.white[1]}`)]
    case 'go':
      return entry.landed
        ? [who(room, entry.who), text(' parou no GO (+'), money(entry.amount), text(')')]
        : [who(room, entry.who), text(' passou pelo GO (+'), money(entry.amount), text(')')]
    case 'buy':
      return [who(room, entry.who), text(' comprou '), place(entry.pos), text(' por '), money(entry.price)]
    case 'rent':
      return [who(room, entry.who), text(' pagou '), money(entry.amount), text(' de aluguel a '), who(room, entry.ownerId)]
    case 'tax':
      return [who(room, entry.who), text(' pagou '), money(entry.amount), text(' de imposto')]
    case 'bus-ticket-gain':
      return [who(room, entry.who), text(' parou no espaço Bus Ticket e ganhou uma passagem')]
    case 'card-draw':
      return [who(room, entry.who), text(` sacou ${entry.deck === 'acaso' ? 'Acaso' : 'Tesouro'}`)]
    case 'card-immediate':
      return [who(room, entry.who), text(': '), ...cardImmediatePhrase(entry.name, entry.delta)]
    case 'build':
      return [who(room, entry.who), text(` construiu ${buildingNoun(entry.level)} em `), place(entry.pos), text(' por '), money(entry.cost)]
    case 'build-hangar':
      return [who(room, entry.who), text(' construiu um hangar em '), place(entry.pos), text(' por '), money(entry.cost)]
    case 'sell-building':
      return [who(room, entry.who), text(` vendeu construção em `), place(entry.pos), text(' por '), money(entry.amount)]
    case 'sell-hangar':
      return [who(room, entry.who), text(' vendeu o hangar em '), place(entry.pos), text(' por '), money(entry.amount)]
    case 'mortgage':
      return [who(room, entry.who), text(' hipotecou '), place(entry.pos), text(' e recebeu '), money(entry.amount)]
    case 'unmortgage':
      return [who(room, entry.who), text(' desipotecou '), place(entry.pos), text(' pagando '), money(entry.cost)]
    case 'auction-won':
      return [text('Leilão: '), who(room, entry.winnerId), text(' arrematou '), place(entry.pos), text(' por '), money(entry.amount)]
    case 'auction-unsold':
      return [text('Leilão: '), place(entry.pos), text(' não teve lance e ficou com o banco')]
    case 'lot-won':
      return [text('Pregão: '), who(room, entry.winnerId), text(' arrematou '), place(entry.pos), text(' por '), money(entry.amount)]
    case 'lot-unsold':
      return [text('Pregão: '), place(entry.pos), text(' ficou livre, sem arrematante')]
    case 'free-parking':
      return [who(room, entry.who), text(' coletou '), money(entry.amount), text(' do centro do tabuleiro')]
    case 'jail-fine':
      return [who(room, entry.who), text(' pagou '), money(entry.amount), text(' de fiança')]
    case 'debt-paid':
      return [who(room, entry.who), text(' pagou dívida '), money(entry.amount)]
    case 'bankruptcy':
      return [who(room, entry.who), text(' faliu')]
    case 'trade':
      return [who(room, entry.who), text(' ↔ '), who(room, entry.toId), text(': troca aceita')]
    case 'loan-interest':
      return [who(room, entry.who), text(' pagou '), money(entry.amount), text(' de juros a '), who(room, entry.creditorId)]
    case 'loan-interest-short':
      return [who(room, entry.who), text(' não cobriu os juros de '), who(room, entry.creditorId), text(' e ficou devendo '), money(entry.shortfall)]
    case 'legacy':
      return [text(entry.what)] // FR-022: texto solto, sem resolução de identidade nem ícone
    default:
      return assertNever(entry)
  }
}
