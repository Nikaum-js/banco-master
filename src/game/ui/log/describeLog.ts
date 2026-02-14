// Descritor do log (040/D-032) — a ÚNICA fronteira onde o fato tipado vira frase em
// português. O motor emite `LogEntry` (fatos); esta camada compõe `LogSentence` (fragmentos
// tipados, não string — contrato §2) a partir dos campos do evento + a identidade da sala.
// Pura: `room` é parâmetro, nunca hook (4.5 do research) — é o que torna SC-001 (zero id na
// frase) verificável por inspeção da estrutura, sem montar React.
import type { DebtCause, LogEntry } from '@/game/economy/types'
import { identityOf, type PlayerIdentity } from '@/net/identity'
import type { Room } from '@/net/room'
import { activeLabels } from '@/game/ui/theme/boardTheme'

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
  'Investidor Anjo': 'Investidor Anjo: 20% de desconto na próxima compra',
}

// Frases que citam contratos do motor apresentados por mapa (055): resolvidas na hora
// para o vocabulário do mapa ativo — 'Bus Ticket'/'Bilhete de Trem', 'hangares'/'Estações
// de Carga'. O NOME canônico da carta no evento não muda.
function mapAwareFixedPhrase(name: string): string | null {
  const labels = activeLabels()
  if (name === 'Passagem Onibus') return `ganhou 1 ${labels.busTicket}`
  if (name === 'Apagao') return `Apagão: ${labels.hangar.toLowerCase()}s ficam inativas por 1 volta`
  if (name === 'Greve' || name === 'Greve Utilidades') {
    return `Greve: bônus de ${labels.hangar} suspenso e utilidades sem aluguel por 1 volta`
  }
  return null
}

// Cartas cujo efeito varia com `delta` (dCash de `describeImmediate`, pré-040) — a fase
// verbal muda com o sinal, mas o valor em si é sempre o mesmo campo do evento.
function cardImmediatePhrase(name: string, delta: number): LogSentence {
  const fixed = mapAwareFixedPhrase(name) ?? CARD_FIXED_PHRASE[name]
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
      return [text('Crise imobiliária: adversários pagam 10% do patrimônio à Loteria')]
    case 'Aniversario':
      return delta > 0
        ? [text('recebeu '), money(delta), text(' de aniversário (cada adversário paga $50)')]
        : [text('Aniversário: cada adversário pagaria $50, mas não há outro jogador para cobrar')]
    case 'Honorarios':
      return [text('pagou '), money(-delta), text(' de honorários')]
    case 'Boom Economico':
      return [text('Boom econômico: todos que ainda estão na partida receberam '), money(delta)]
    // Cartas dependentes de estado podem não movimentar caixa (SRS §10.6), mas isso precisa ser
    // narrado: o jogador deve distinguir um efeito persistente ou sem alvo de um bug silencioso.
    case 'Incentivo Fiscal':
      return delta > 0
        ? [text('recebeu '), money(delta), text(' de incentivo fiscal ($50 por propriedade hipotecada)')]
        : [text('Incentivo Fiscal pagaria $50 por propriedade hipotecada, mas não havia hipotecas')]
    case 'Resgate Do Pote':
      return delta > 0
        ? [text('resgatou '), money(delta), text(' (metade da Loteria)')]
        : [text('Resgate do Pote pagaria metade da Loteria, mas o pote estava vazio')]
    case 'Obra Relampago':
      return [text('Obra Relâmpago: a próxima construção será gratuita')]
    case 'Estatizacao':
      return [text('Estatização: por 1 volta, todo aluguel vai para a Loteria')]
    default: // erroBanco, boomEconomico e demais efeitos baseados só em caixa
      if (delta < 0) return [text('pagou '), money(-delta)]
      if (delta > 0) return [text('recebeu '), money(delta)]
      // ÚLTIMO RECURSO, e nunca "nenhum efeito" seco: carta que sai e não explica nada parece
      // bug para quem está jogando — foi exatamente o relato. Aqui a frase pelo menos diz que o
      // efeito não era de caixa ou não encontrou alvo, que é a única coisa verdadeira que se
      // pode afirmar sem saber qual carta é. Carta nova que caia neste ramo com delta 0 merece
      // um `case` próprio acima, não esta frase.
      return [text('a carta não movimentou dinheiro: o efeito dela não é de caixa, ou não encontrou alvo nesta situação')]
  }
}

// Substantivo do degrau construído — deriva de `level` (nível RESULTANTE, D5 do plan):
// 1-4 = casas, 5 = hotel, 6 = 2º hotel, 7 = arranha-céu (ladder de `construction.ts`).
/**
 * O rótulo da melhoria de ferrovia com artigo, para caber na frase do log.
 *
 * O Atlas diz "Hangar" (masculino, nome comum → minúsculo na frase); a Fuligem diz
 * "Estação de Carga" (feminino, nome próprio da instalação → mantém a maiúscula). Um
 * literal só não serve para os dois, e "construiu um Estação de Carga" é pior que o bug
 * que estamos consertando.
 */
function lowerLabel(label: string): string {
  return label === 'Hangar' ? 'um hangar' : `a ${label}`
}

function buildingNoun(level: number): string {
  const labels = activeLabels()
  if (level <= 4) return `${level}ª ${labels.house}`
  if (level === 5) return labels.hotel
  if (level === 6) return labels.hotel2
  return labels.skyscraper
}

// De onde a dívida veio (D-063). Frase, não jargão: o jogador precisa reconhecer a cobrança
// que acabou de acontecer, não o nome interno do caso.
function debtCausePhrase(cause: DebtCause): string {
  switch (cause) {
    case 'rent': return 'não cobriu o aluguel'
    case 'tax': return 'não cobriu o imposto'
    case 'bunker-tax': return 'recusou o Bunker Fiscal sem cobrir o imposto'
    case 'loan-interest': return 'não cobriu os juros do empréstimo'
    case 'loan-due': return 'não cobriu o vencimento do empréstimo'
    case 'obligation': return 'não cobriu a obrigação'
  }
}

// Caixa movido na troca (D-063). Só aparece quando houve movimento: uma troca puramente de
// propriedades não ganha um "(+$0 / -$0)" que só polui.
function tradeCashPhrase(fromDelta: number, toDelta: number): LogSentence {
  if (fromDelta === 0 && toDelta === 0) return []
  return [text(' ('), money(fromDelta), text(' / '), money(toDelta), text(')')]
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
      // `ownerId: 'bank'` = aluguel confiscado pela Estatização (D-064): foi à Loteria, não ao dono.
      return entry.ownerId === 'bank'
        ? [who(room, entry.who), text(` pagou `), money(entry.amount), text(` de aluguel à ${activeLabels().lottery} (Estatização)`)]
        : [who(room, entry.who), text(' pagou '), money(entry.amount), text(' de aluguel a '), who(room, entry.ownerId)]
    case 'tax':
      return [who(room, entry.who), text(' pagou '), money(entry.amount), text(' de imposto')]
    case 'bus-ticket-gain':
      return [who(room, entry.who), text(` parou no espaço ${activeLabels().busTicket} e ganhou uma passagem`)]
    case 'card-draw':
      return [who(room, entry.who), text(` sacou ${entry.deck === 'acaso' ? 'Acaso' : 'Tesouro'}`)]
    case 'card-immediate':
      return [who(room, entry.who), text(': '), ...cardImmediatePhrase(entry.name, entry.delta)]
    case 'build':
      return [who(room, entry.who), text(` construiu ${buildingNoun(entry.level)} em `), place(entry.pos), text(' por '), money(entry.cost)]
    case 'rail-hop':
      // D-070 (mapa Fuligem): embarque entre ferrovias próprias — movimento, não dinheiro.
      return [who(room, entry.who), text(' embarcou em '), place(entry.from), text(' e desceu em '), place(entry.to)]
    case 'smoke-tax':
      // D-072: somente compatibilidade com logs persistidos antes da remoção da regra.
      return [who(room, entry.who), text(' pagou '), money(entry.amount), text(' de Taxa de Fumaça em '), place(entry.pos)]
    case 'build-hangar':
      // O nome da melhoria vem do MAPA (Hangar / Estação de Carga). Era o literal
      // "hangar", então o log da Fuligem contradizia o botão que o jogador acabou de
      // clicar — ele comprou uma Estação de Carga e leu que construiu um hangar.
      return [who(room, entry.who), text(` construiu ${lowerLabel(activeLabels().hangar)} em `), place(entry.pos), text(' por '), money(entry.cost)]
    case 'sell-building':
      return [who(room, entry.who), text(` vendeu construção em `), place(entry.pos), text(' por '), money(entry.amount)]
    case 'sell-hangar':
      return [who(room, entry.who), text(` vendeu ${lowerLabel(activeLabels().hangar)} em `), place(entry.pos), text(' por '), money(entry.amount)]
    case 'mortgage':
      return [who(room, entry.who), text(' hipotecou '), place(entry.pos), text(' e recebeu '), money(entry.amount)]
    case 'unmortgage':
      return [who(room, entry.who), text(' desipotecou '), place(entry.pos), text(' pagando '), money(entry.cost)]
    // §6.4/D-062 — a frase diz "sem receber nada" de propósito: o jogador precisa ver que o
    // zero foi a regra, não uma cobrança que falhou.
    case 'sell-to-bank':
      return [who(room, entry.who), text(' devolveu '), place(entry.pos), text(' hipotecada ao banco, sem receber nada')]
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
    case 'debt-open':
      return entry.creditorId
        ? [who(room, entry.who), text(` ${debtCausePhrase(entry.cause)} e ficou devendo `), money(entry.amount), text(' a '), who(room, entry.creditorId)]
        : [who(room, entry.who), text(` ${debtCausePhrase(entry.cause)} e ficou devendo `), money(entry.amount), text(' ao banco')]
    case 'debt-paid':
      return entry.creditorId
        ? [who(room, entry.who), text(' pagou dívida '), money(entry.amount), text(' a '), who(room, entry.creditorId)]
        : [who(room, entry.who), text(' pagou dívida '), money(entry.amount), text(' ao banco')]
    case 'bankruptcy':
      return [who(room, entry.who), text(' faliu')]
    case 'concede':
      return [who(room, entry.who), text(' desistiu e deixou a partida')]
    case 'trade':
      return [who(room, entry.who), text(' ↔ '), who(room, entry.toId), text(': troca aceita'), ...tradeCashPhrase(entry.fromDelta, entry.toDelta)]
    case 'loan-interest':
      return [who(room, entry.who), text(' pagou '), money(entry.amount), text(' de juros a '), who(room, entry.creditorId)]
    case 'loan-interest-short':
      return [who(room, entry.who), text(' não cobriu os juros de '), who(room, entry.creditorId), text(' e ficou devendo '), money(entry.shortfall)]
    case 'loan-due':
      return [who(room, entry.who), text(' quitou o empréstimo no vencimento: '), money(entry.principal), text(' + '), money(entry.interest), text(' de juros a '), who(room, entry.creditorId)]
    case 'loan-due-short':
      return [who(room, entry.who), text(' não cobriu o vencimento do empréstimo de '), who(room, entry.creditorId), text(' e ficou devendo '), money(entry.shortfall)]
    // Fiscal (§13.8) — a frase diz explicitamente que é o Fiscal e QUAL propriedade, porque o
    // débito chega na vez de outra pessoa: sem os dois, o jogador não tem como ligar causa e efeito.
    case 'tax-man':
      return entry.amount < entry.due
        ? [text('Fiscal parou em '), place(entry.pos), text(': '), who(room, entry.who), text(' pagou '), money(entry.amount), text(' ao banco, todo o caixa que tinha')]
        : [text('Fiscal parou em '), place(entry.pos), text(': '), who(room, entry.who), text(' pagou '), money(entry.amount), text(' ao banco')]
    case 'hostile-takeover':
      return [who(room, entry.who), text(' tomou '), place(entry.pos), text(' de '), who(room, entry.victimId), text(' por '), money(entry.amount)]
    case 'audit':
      return [who(room, entry.who), text(' aplicou Imposto Federal em '), who(room, entry.targetId), text(': '), money(entry.amount), text(` à ${activeLabels().lottery}`)]
    case 'evict':
      return [who(room, entry.who), text(' confiscou as construções de '), who(room, entry.victimId), text(' em '), place(entry.pos)]
    // Permuta Forçada (D-064): troca seca de títulos, sem dinheiro — o fato nomeia os dois lados.
    case 'swap':
      return [who(room, entry.who), text(' permutou '), place(entry.posGiven), text(' por '), place(entry.posTaken), text(' de '), who(room, entry.victimId)]
    case 'card-collect':
      return entry.delta < 0
        ? [who(room, entry.who), text(` pagou `), money(-entry.delta), text(entry.counterpartId === 'bank' ? ' (' : ' a '), ...(entry.counterpartId === 'bank' ? [text(`${entry.name})`)] : [who(room, entry.counterpartId), text(` (${entry.name})`)])]
        : [who(room, entry.who), text(` recebeu `), money(entry.delta), text(` (${entry.name})`)]
    case 'legacy':
      return [text(entry.what)] // FR-022: texto solto, sem resolução de identidade nem ícone
    default:
      return assertNever(entry)
  }
}
