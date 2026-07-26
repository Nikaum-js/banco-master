// Classificadores PUROS evento→cue (spec 035). Sem Web Audio, sem GameState —
// só mapeiam dados em SoundCue (testáveis em ambiente node). Os imports são
// type-only: este módulo não tem dependência de runtime sobre o motor nem o engine.
import type { SoundCue } from './cues'
import type { LogEntry, ResolutionSlice } from '@/game/economy/types'
import type { Roll, Notice } from '@/game/turn/types'

// Rolagem → cue, ramificando face Ônibus / dupla / Speed Die / base (FR-001).
export function cueForRoll(roll: Roll): SoundCue {
  if (roll.special === 'onibus') return 'dice-bus'
  if (roll.isDouble) return 'dice-double'
  if (roll.speed !== null) return 'dice-speed'
  return 'dice-roll'
}

// Borda de subida de resolução → cue (FR-003/FR-004). `auction` aqui = abertura.
// `purchase` (prompt de compra ao cair na casa) é SILENCIOSO — o cha-ching do `buy`
// toca só na compra CONFIRMADA (log `comprou ...`), não na oferta.
export function cueForResolution(kind: ResolutionSlice['kind']): SoundCue | null {
  switch (kind) {
    case 'auction': return 'auction-bid'
    case 'card-reveal': return 'card-reveal'
    case 'card-shortcut': return 'card-shortcut'
    case 'card-discard': return 'card-discard'
    case 'debt': return 'debt'
    case 'reaction-diplomacia':
    case 'reaction-bunker': return 'reaction'
    default: return null
  }
}

// Notice → cue (FR-005/FR-004). free-parking é neutro (catch-up discreto, FR-017).
export function cueForNotice(kind: Notice['kind']): SoundCue | null {
  switch (kind) {
    case 'free-parking': return 'free-parking'
    case 'hostile-takeover': return 'hostile-takeover'
    default: return null
  }
}

function assertNever(x: never): never {
  throw new Error(`LogKind não tratado por logKey: ${JSON.stringify(x)}`)
}

// Chave de VALOR de uma entrada de log. O motor clona o estado inteiro a cada
// ação (structuredClone) — identidade de objeto nunca sobrevive; qualquer
// comparação do log tem que ser por valor. Concatenação em ORDEM FIXA por `kind`
// (D7 do plan) — `JSON.stringify` não serve: a ordem das chaves depende da ordem
// de construção do objeto, e uma chave instável quebraria `countNewLogEntries` de
// forma intermitente (o pior modo de falha possível para áudio).
export function logKey(e: LogEntry): string {
  switch (e.kind) {
    case 'roll': return [e.kind, e.who, e.white[0], e.white[1], e.isDouble, e.special, e.speed, e.attempt].join('|')
    case 'go': return [e.kind, e.who, e.amount, e.landed].join('|')
    case 'buy': return [e.kind, e.who, e.pos, e.price].join('|')
    case 'rent': return [e.kind, e.who, e.pos, e.amount, e.ownerId].join('|')
    case 'tax': return [e.kind, e.who, e.amount].join('|')
    case 'bus-ticket-gain': return [e.kind, e.who].join('|')
    case 'card-draw': return [e.kind, e.who, e.deck].join('|')
    case 'card-immediate': return [e.kind, e.who, e.deck, e.name, e.delta].join('|')
    case 'build': return [e.kind, e.who, e.pos, e.level, e.cost].join('|')
    case 'build-hangar': return [e.kind, e.who, e.pos, e.cost].join('|')
    case 'sell-building': return [e.kind, e.who, e.pos, e.level, e.amount].join('|')
    case 'sell-hangar': return [e.kind, e.who, e.pos, e.amount].join('|')
    case 'mortgage': return [e.kind, e.who, e.pos, e.amount].join('|')
    case 'unmortgage': return [e.kind, e.who, e.pos, e.cost].join('|')
    case 'auction-won': return [e.kind, e.who, e.pos, e.amount, e.winnerId].join('|')
    case 'auction-unsold': return [e.kind, e.who, e.pos].join('|')
    case 'lot-won': return [e.kind, e.who, e.pos, e.amount, e.winnerId, e.origin].join('|')
    case 'lot-unsold': return [e.kind, e.who, e.pos, e.origin].join('|')
    case 'free-parking': return [e.kind, e.who, e.amount].join('|')
    case 'jail-fine': return [e.kind, e.who, e.amount].join('|')
    case 'debt-paid': return [e.kind, e.who, e.amount].join('|')
    case 'bankruptcy': return [e.kind, e.who].join('|')
    case 'trade': return [e.kind, e.who, e.toId].join('|')
    case 'loan-interest': return [e.kind, e.who, e.amount, e.creditorId].join('|')
    case 'loan-interest-short': return [e.kind, e.who, e.amount, e.creditorId, e.shortfall].join('|')
    case 'legacy': return [e.kind, e.who, e.what].join('|')
    default: return assertNever(e)
  }
}

// Quantas entradas NOVAS existem no fim de `keys` em relação a `prevKeys`.
// O log é append-only com shift no teto de 50: descontadas as `d` novas, o
// prefixo restante de `keys` tem que casar com o sufixo de `prevKeys`.
// Log inteiramente irreconhecível (reset/reconexão) → 0: não re-tocar
// histórico (FR-011).
export function countNewLogEntries(prevKeys: string[], keys: string[]): number {
  for (let d = 0; d <= keys.length; d++) {
    const keep = keys.length - d
    if (keep > prevKeys.length) continue
    if (keep === 0) return prevKeys.length === 0 ? keys.length : 0
    const off = prevKeys.length - keep
    let ok = true
    for (let i = 0; i < keep; i++) {
      if (prevKeys[off + i] !== keys[i]) { ok = false; break }
    }
    if (ok) return d
  }
  return 0
}

// Classifica UMA entrada de log nova → cue (ou null). Ramifica por `kind`, nunca por
// texto (FR-023, SC-004) — os 13 pares preservam exatamente o oráculo pré-040
// (`classify.test.ts`, T004/SC-009). `card-draw` é GENÉRICO — nunca varia por deck
// nem raridade (privacidade, FR-016): o tipo não carrega o campo, então virou
// impossível ramificar por carta, não só indisciplina evitada.
export function classifyLogEntry(e: LogEntry): SoundCue | null {
  switch (e.kind) {
    case 'buy': return 'buy' // compra CONFIRMADA (não o prompt)
    case 'tax': return 'tax-paid'
    case 'rent': return 'rent-paid'
    case 'go': return 'go-bonus'
    case 'loan-interest':
    case 'loan-interest-short': return 'loan-interest'
    case 'bus-ticket-gain': return 'busticket-gain'
    case 'bankruptcy': return 'bankruptcy'
    case 'card-draw': return 'card-draw'
    // Leilão comum: família muda (antes 100% silenciosa — closeAuction nunca soava,
    // T023/040) — 'auction-close' já existe como cue e nunca tinha dono; sem conflito
    // com o pregão de terrenos, que detecta o fecho pelo estado (Canal 1), não pelo log.
    case 'auction-won':
    case 'auction-unsold': return 'auction-close'
    // Já cobertos por OUTRO canal tipado do SoundLayer (Canal 1) — devolver cue aqui
    // tocaria duas vezes para o mesmo fato (FR-007):
    //   build/build-hangar/sell-building/sell-hangar/mortgage/unmortgage → delta de
    //     `buildLevel`/`mortgaged` por título (já soava 'build'/'sell'/'mortgage'/'unmortgage').
    //   free-parking → borda de subida de `notice.kind` (cueForNotice já devolve 'free-parking').
    //   jail-fine → borda de descida de `jail.inJail` (já soa 'jail-out', pago ou não).
    //   lot-won/lot-unsold → fecho do PREGÃO inteiro já soa 'auction-close' uma vez
    //     (Canal 1); soar por LOTE dobraria no lote que fecha o pregão.
    // 'roll': cue vem de `cueForRoll(lastRoll)`, que sabe dupla/Speed/Ônibus; o log não.
    // Os demais: sem cue apropriado nesta fatia — decisão explícita, não esquecimento (SC-009).
    case 'build':
    case 'build-hangar':
    case 'sell-building':
    case 'sell-hangar':
    case 'mortgage':
    case 'unmortgage':
    case 'free-parking':
    case 'jail-fine':
    case 'lot-won':
    case 'lot-unsold':
    case 'roll':
    case 'card-immediate':
    case 'debt-paid':
    case 'trade':
    case 'legacy':
      return null
    default: return assertNever(e)
  }
}
