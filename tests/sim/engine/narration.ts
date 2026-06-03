/**
 * NARRAÇÃO — o invariante que faltava (D-063).
 *
 * ## Por que a simulação não pegou os bugs financeiros
 *
 * O harness já verificava **conservação**: `conservation.ts` recomputa cada mecanismo de forma
 * independente e acusa qualquer jogador cujo Δcaixa não seja explicado por algum sub-checker.
 * Passou em todos os lotes. E ainda assim quatro relatos de bug financeiro chegaram do playtest.
 *
 * A razão é que **conservação e explicabilidade são propriedades diferentes**, e o harness só
 * tinha a primeira:
 *
 *   • O dinheiro do Fiscal (§13.8) está perfeitamente conservado — sai do dono, é destruído pelo
 *     banco. `conservation.ts` sabe disso e marca `taxman-sink` como *esperado*. O que ninguém
 *     verificava é se existia **uma frase** para o jogador entender aquilo. Não existia: nem log,
 *     nem notice, nem som. Um invariante contábil não vira invariante narrativo de graça.
 *   • Pior, o oráculo tinha **espelhado o bug como especificação**. O checker do Aniversário
 *     calculava o esperado com `Math.min(50, p.cash)` — a MESMA truncagem do reducer. Recomputar
 *     "de forma independente" copiando a fórmula do código sob teste não é independência: é a
 *     mesma afirmação escrita duas vezes, e ela concorda consigo mesma para sempre.
 *
 * Este módulo acrescenta os dois invariantes que faltavam:
 *
 *   (i)  **narração** — todo jogador com Δcaixa num despacho tem de ser NOMEADO por um fato
 *        narrativo emitido naquele mesmo despacho;
 *   (ii) **não-truncagem** — nenhum jogador pode acabar um despacho com caixa em zero por uma
 *        cobrança de OUTRO JOGADOR sem que a diferença exista como obrigação pendente (D-061).
 *
 * O (i) falha alto no Fiscal mudo, na Aquisição Hostil muda, na Auditoria muda, no Despejo mudo,
 * nas cartas que cobram de todos e na troca sem valores — os seis furos que a D-063 fechou. É
 * deliberado que ele seja formulado sobre **quem é nomeado**, e não sobre "existe alguma entrada
 * nova": um log que diz "p1 sacou Tesouro" não explica por que o caixa de **p3** caiu.
 */
import type { GameState } from '@/game/turn/types'
import type { LogEntry } from '@/game/economy/types'
import type { Violation } from './invariants'

/**
 * Todos os ids de jogador que uma entrada de log NOMEIA.
 *
 * Exaustiva por `kind` de propósito (o `switch` sem `default` faz o TS recusar um `LogKind`
 * novo): um fato narrativo que mova caixa sem aparecer aqui deixa de cobrir o jogador afetado, e
 * é exatamente isso que o invariante existe para caçar. Um fato novo custa uma linha; esquecê-la
 * custa um bug financeiro invisível.
 */
export function namesIn(e: LogEntry): string[] {
  switch (e.kind) {
    case 'rent': return [e.who, e.ownerId]
    case 'auction-won':
    case 'lot-won': return [e.winnerId]
    case 'trade': return [e.who, e.toId]
    case 'loan-interest':
    case 'loan-interest-short':
    case 'loan-due':
    case 'loan-due-short': return [e.who, e.creditorId]
    case 'debt-open':
    case 'debt-paid': return e.creditorId ? [e.who, e.creditorId] : [e.who]
    // `swap` = Permuta Forçada (D-064): troca compulsória entre dois jogadores — os dois são
    // nomeados, porque os dois trocam de patrimônio (mesmo sem caixa envolvido).
    case 'hostile-takeover':
    case 'evict':
    case 'swap': return [e.who, e.victimId]
    case 'audit': return [e.who, e.targetId]
    case 'card-collect': return e.counterpartId === 'bank' ? [e.who] : [e.who, e.counterpartId]
    // Fatos de um só protagonista. `who === 'bank'` não nomeia jogador nenhum — e é por isso
    // que `auction-unsold`/`lot-unsold` não cobrem ninguém: ali não há Δcaixa a explicar.
    case 'roll':
    case 'go':
    case 'buy':
    case 'tax':
    case 'tax-man':
    case 'bus-ticket-gain':
    case 'card-draw':
    case 'card-immediate':
    case 'build':
    case 'smoke-tax': // D-072: compatibilidade com log histórico
    case 'rail-hop': // D-070: só quem embarcou; não move caixa de ninguém
    case 'build-hangar':
    case 'sell-building':
    case 'sell-hangar':
    case 'mortgage':
    case 'unmortgage':
    case 'sell-to-bank':
    case 'free-parking':
    case 'jail-fine':
    case 'bankruptcy':
    case 'concede':
    case 'auction-unsold':
    case 'lot-unsold':
    case 'legacy':
      return e.who === 'bank' ? [] : [e.who]
  }
}

// Entradas ACRESCENTADAS por este despacho. O log é um anel de 50 com `shift`, então "as novas"
// não é `slice(prev.length)`: com o anel cheio, o comprimento não muda e o prefixo desliza.
// Casamos o maior sufixo de `next.log` que ainda não estava em `prev.log`.
function appended(prev: GameState, next: GameState): LogEntry[] {
  const key = (e: LogEntry): string => JSON.stringify(e)
  const prevKeys = prev.log.map(key)
  const nextKeys = next.log.map(key)
  for (let d = 0; d <= nextKeys.length; d++) {
    const keep = nextKeys.length - d
    if (keep > prevKeys.length) continue
    const off = prevKeys.length - keep
    let ok = true
    for (let i = 0; i < keep; i++) {
      if (prevKeys[off + i] !== nextKeys[i]) { ok = false; break }
    }
    if (ok) return next.log.slice(nextKeys.length - d)
  }
  return next.log.slice() // log irreconhecível (reset) — trata tudo como novo
}

/**
 * (i) Todo Δcaixa é NOMEADO por um fato narrativo do mesmo despacho.
 *
 * Duas isenções, ambas estruturais e não de conveniência:
 *   • **eliminação** — `leaveTable` zera o caixa de quem sai e credita o herdeiro; `bankruptcy`/
 *     `concede` nomeiam só quem saiu, e o herdeiro é derivável do estado (não é um fato novo).
 *   • **caixa inicial** — o primeiro despacho de uma partida nova não tem log anterior.
 */
export function checkNarration(prev: GameState, next: GameState): Violation[] {
  const out: Violation[] = []
  const entries = appended(prev, next)
  const named = new Set(entries.flatMap(namesIn))
  const eliminatedNow = new Set(
    next.players.filter((p) => p.eliminated && !prev.players.find((q) => q.id === p.id)?.eliminated).map((p) => p.id),
  )
  const heirCredited = eliminatedNow.size > 0 // herança move o caixa de um terceiro por dedução

  for (const before of prev.players) {
    const after = next.players.find((p) => p.id === before.id)
    if (!after) continue
    const delta = after.cash - before.cash
    if (delta === 0) continue
    if (eliminatedNow.has(before.id)) continue // §9.4 — o caixa do eliminado é zerado por regra
    if (heirCredited && delta > 0) continue // herdeiro do espólio (§9.2/§9.3)
    if (named.has(before.id)) continue
    out.push({
      code: 'n',
      detail:
        `Δcaixa(${before.id}) = ${delta} sem fato narrativo que o nomeie ` +
        `[fatos do despacho: ${entries.map((e) => e.kind).join(',') || 'nenhum'}]`,
    })
  }
  return out
}

/**
 * (ii) Nenhuma obrigação a outro JOGADOR é truncada (D-061).
 *
 * A assinatura de uma cobrança truncada é precisa: o caixa do devedor foi a **exatamente zero**
 * num despacho em que ele pagou algo a outro jogador. Quando isso acontece, ou o valor devido
 * coube (e não houve truncagem), ou a diferença TEM de existir em `obligations`/`resolution`.
 *
 * Formulado sobre a assinatura observável, e NÃO recomputando `Math.min(50, cash)` — foi a
 * recomputação que fez o oráculo antigo concordar com o bug.
 */
export function checkNoTruncation(prev: GameState, next: GameState): Violation[] {
  const out: Violation[] = []
  const entries = appended(prev, next)
  // Cobranças a JOGADOR neste despacho (não ao banco/pote).
  const paidToPlayer = entries.filter(
    (e) => e.kind === 'card-collect' && e.counterpartId !== 'bank' && e.delta < 0,
  ) as Extract<LogEntry, { kind: 'card-collect' }>[]

  for (const e of paidToPlayer) {
    const after = next.players.find((p) => p.id === e.who)
    if (!after || after.cash !== 0) continue // não zerou → não houve truncagem possível
    const owed =
      next.obligations.filter((o) => o.debtorId === e.who).reduce((s, o) => s + o.amount, 0) +
      (next.resolution?.kind === 'debt' && next.resolution.debtorId === e.who ? next.resolution.amount : 0)
    // O pagamento foi CURTO? Esta é a pergunta, e ela precisa de `due` (o que a regra queria
    // mover) além de `delta` (o que moveu). Sem `due`, "pagou todo o caixa e ficou em zero"
    // inclui quem tinha o valor EXATO — pagamento completo, obrigação nenhuma. Foi esse falso
    // positivo que 300 partidas do lote headless acusaram: três seeds em que o devedor tinha
    // exatamente os $50 do Aniversário.
    if (-e.delta < e.due && owed === 0) {
      out.push({
        code: 't',
        detail:
          `${e.who} pagou ${-e.delta} de ${e.due} a ${e.counterpartId} por "${e.name}" e ficou em zero ` +
          `sem obrigação registrada — o restante da cobrança desapareceu (D-061)`,
      })
    }
  }
  return out
}
