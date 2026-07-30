import { describe, it, expect } from 'vitest'
import { classifyLogEntry, countNewLogEntries, cueForRoll, cueForResolution, cueForNotice, logKey } from '@/game/ui/sound/classify'
import type { LogEntry } from '@/game/economy/types'
import type { SoundCue } from '@/game/ui/sound/cues'
import type { Roll } from '@/game/turn/types'

const roll = (over: Partial<Roll>): Roll => ({ white: [3, 4], speed: null, isDouble: false, move: 7, special: null, ...over })

// Oráculo pré-040 (contrato §3, T004), preservado como registro histórico: a tabela
// ATUAL de `classifyLogEntry` por SUBSTRING, transcrita ANTES de o código trocar para
// `kind` — cada par frase→cue documentado aqui tem um par `kind`→cue equivalente em
// `PRE_040_KIND_CUE` logo abaixo (T032). Não executa mais contra `classifyLogEntry`
// (que não lê `.what`); a prova de não-regressão (SC-009) agora roda pelo `kind`.
const PRE_040_ORACLE: ReadonlyArray<{ what: string; cue: SoundCue | null }> = [
  { what: 'comprou Paris por $200', cue: 'buy' },
  { what: 'pagou $200 de imposto', cue: 'tax-paid' },
  { what: 'pagou $120 de aluguel a p2', cue: 'rent-paid' },
  { what: 'passou pelo GO (+$200)', cue: 'go-bonus' },
  { what: 'parou no GO (+$400)', cue: 'go-bonus' },
  { what: 'pagou R$ 50 de juros a p3 (GO)', cue: 'loan-interest' },
  { what: 'não cobriu os juros de p3 e ficou devendo R$ 80', cue: 'loan-interest' }, // os dois kind de juros mapeiam pro mesmo cue
  { what: 'parou no espaço Bus Ticket e ganhou uma passagem', cue: 'busticket-gain' },
  { what: 'faliu', cue: 'bankruptcy' },
  { what: 'sacou Acaso', cue: 'card-draw' },
  { what: 'sacou Tesouro', cue: 'card-draw' },
  { what: 'rolou 3+4', cue: null }, // canal tipado (dice) — log não re-toca
  { what: 'pagou dívida $300', cue: null },
  { what: 'p1 ↔ p2: troca aceita', cue: null },
]
void PRE_040_ORACLE // referenciado só em comentário/histórico — ver PRE_040_KIND_CUE

// O mesmo oráculo, um par por `kind` real (T032) — a prova executável de SC-009.
const PRE_040_KIND_CUE: ReadonlyArray<{ entry: LogEntry; cue: SoundCue | null }> = [
  { entry: { kind: 'buy', who: 'p1', pos: 5, price: 200 }, cue: 'buy' },
  { entry: { kind: 'tax', who: 'p1', amount: 200 }, cue: 'tax-paid' },
  { entry: { kind: 'rent', who: 'p1', pos: 5, amount: 120, ownerId: 'p2' }, cue: 'rent-paid' },
  { entry: { kind: 'go', who: 'p1', amount: 200, landed: false }, cue: 'go-bonus' },
  { entry: { kind: 'go', who: 'p1', amount: 400, landed: true }, cue: 'go-bonus' },
  { entry: { kind: 'loan-interest', who: 'p1', amount: 50, creditorId: 'p3' }, cue: 'loan-interest' },
  { entry: { kind: 'loan-interest-short', who: 'p1', amount: 0, creditorId: 'p3', shortfall: 80 }, cue: 'loan-interest' },
  { entry: { kind: 'bus-ticket-gain', who: 'p1' }, cue: 'busticket-gain' },
  { entry: { kind: 'bankruptcy', who: 'p1' }, cue: 'bankruptcy' },
  { entry: { kind: 'card-draw', who: 'p1', deck: 'acaso' }, cue: 'card-draw' },
  { entry: { kind: 'card-draw', who: 'p1', deck: 'tesouro' }, cue: 'card-draw' },
  { entry: { kind: 'roll', who: 'p1', white: [3, 4], isDouble: false, special: null, speed: null, attempt: false }, cue: null },
  { entry: { kind: 'debt-paid', who: 'p1', amount: 300, creditorId: 'p2' }, cue: null },
  { entry: { kind: 'trade', who: 'p1', toId: 'p2', fromDelta: 0, toDelta: 0 }, cue: null },
]

describe('classifyLogEntry — oráculo pré-040 por kind (SC-009 — não-regressão)', () => {
  it('preserva cada par kind→cue equivalente à tabela vigente antes da tipagem', () => {
    for (const { entry, cue } of PRE_040_KIND_CUE) expect(classifyLogEntry(entry)).toBe(cue)
  })

  it('saque é GENÉRICO — não vaza o deck além do necessário nem a raridade (FR-016/SC-004)', () => {
    // O texto privado da carta na mão ("Acaso: Investidor Anjo") não soa — só o kind
    // `card-draw` (sem campo de carta) chega ao classificador.
    expect(classifyLogEntry({ kind: 'card-draw', who: 'p1', deck: 'acaso' })).toBe('card-draw')
  })
})

// Cue dos 12 `kind` novos (040/Fase 5) — decidido EXPLICITAMENTE nesta fatia, não por
// omissão (T031). `auction-won`/`auction-unsold` eram 100% silenciosos (`closeAuction`
// nunca eram logados) — ganham `auction-close`, sem conflito com o pregão de terrenos
// (que soa pelo Canal 1 do SoundLayer, por delta de estado, não pelo log). Os demais
// já soam por OUTRO canal tipado do SoundLayer — `null` aqui evita o disparo duplo.
const NEW_KIND_CUE: ReadonlyArray<{ entry: LogEntry; cue: SoundCue | null }> = [
  { entry: { kind: 'build', who: 'p1', pos: 1, level: 1, cost: 100 }, cue: null },
  { entry: { kind: 'build-hangar', who: 'p1', pos: 6, cost: 100 }, cue: null },
  { entry: { kind: 'sell-building', who: 'p1', pos: 1, level: 0, amount: 50 }, cue: null },
  { entry: { kind: 'sell-hangar', who: 'p1', pos: 6, amount: 50 }, cue: null },
  { entry: { kind: 'mortgage', who: 'p1', pos: 1, amount: 30 }, cue: null },
  { entry: { kind: 'unmortgage', who: 'p1', pos: 1, cost: 33 }, cue: null },
  { entry: { kind: 'auction-won', who: 'bank', pos: 1, amount: 60, winnerId: 'p1' }, cue: 'auction-close' },
  { entry: { kind: 'auction-unsold', who: 'bank', pos: 1 }, cue: 'auction-close' },
  { entry: { kind: 'lot-won', who: 'bank', pos: 1, amount: 60, winnerId: 'p1', origin: 'bankruptcy' }, cue: null },
  { entry: { kind: 'lot-unsold', who: 'bank', pos: 1, origin: 'scarcity' }, cue: null },
  { entry: { kind: 'free-parking', who: 'p1', amount: 500 }, cue: null },
  { entry: { kind: 'jail-fine', who: 'p1', amount: 50 }, cue: null },
]

describe('classifyLogEntry — os 12 kind novos (040, SC-002/SC-003)', () => {
  it('cada kind novo tem cue decidido, inclusive onde a decisão é null', () => {
    for (const { entry, cue } of NEW_KIND_CUE) expect(classifyLogEntry(entry)).toBe(cue)
  })

  it("'legacy' (dado velho, nunca emitido) também não soa", () => {
    expect(classifyLogEntry({ kind: 'legacy', who: 'p1', what: 'evento antigo' })).toBeNull()
  })
})

describe('countNewLogEntries (035 — diff do log POR VALOR)', () => {
  it('nada novo: mesmo conteúdo, mesmo com objetos recriados pelo clone do motor', () => {
    expect(countNewLogEntries(['p1|a', 'p2|b'], ['p1|a', 'p2|b'])).toBe(0)
  })

  it('append simples e append múltiplo', () => {
    expect(countNewLogEntries(['p1|a'], ['p1|a', 'p2|b'])).toBe(1)
    expect(countNewLogEntries(['p1|a'], ['p1|a', 'p2|b', 'p1|c'])).toBe(2)
  })

  it('shift no teto (front sai, novas entram no fim)', () => {
    expect(countNewLogEntries(['p1|a', 'p2|b', 'p1|c'], ['p2|b', 'p1|c', 'p2|d'])).toBe(1)
  })

  it('entradas de valor idêntico em sequência contam como novas', () => {
    expect(countNewLogEntries(['p1|pagou $50'], ['p1|pagou $50', 'p1|pagou $50'])).toBe(1)
  })

  it('log inicial (prev vazio) toca tudo; log irreconhecível (reset) não re-toca nada', () => {
    expect(countNewLogEntries([], ['p1|a', 'p2|b'])).toBe(2)
    expect(countNewLogEntries(['p1|x', 'p2|y'], ['p3|q', 'p4|w'])).toBe(0) // FR-011
  })
})

// T033 — logKey por campos em ordem fixa (D7 do plan), fim a fim com countNewLogEntries.
describe('logKey (040) — chave de valor por kind, alimenta countNewLogEntries', () => {
  it('duas entradas idênticas em VALOR contam como duas (FR-025)', () => {
    const a: LogEntry = { kind: 'tax', who: 'p1', amount: 200 }
    const keys = [logKey(a)]
    expect(countNewLogEntries(keys, [...keys, logKey(a)])).toBe(1) // uma repetição = uma nova
  })

  it('log irreconhecível (reset/reconexão) não re-toca histórico (FR-025)', () => {
    const before = [logKey({ kind: 'tax', who: 'p1', amount: 10 })]
    const after = [logKey({ kind: 'bankruptcy', who: 'p2' })]
    expect(countNewLogEntries(before, after)).toBe(0)
  })

  it('a chave depende de TODOS os campos do kind, não só who — 2 rolagens diferentes não colidem', () => {
    const a: LogEntry = { kind: 'roll', who: 'p1', white: [3, 4], isDouble: false, special: null, speed: null, attempt: false }
    const b: LogEntry = { kind: 'roll', who: 'p1', white: [5, 6], isDouble: false, special: null, speed: null, attempt: false }
    expect(logKey(a)).not.toBe(logKey(b))
  })
})

describe('cueForRoll (035 — variações de rolagem)', () => {
  it('ramifica Ônibus / dupla / Speed Die / base', () => {
    expect(cueForRoll(roll({ special: 'onibus' }))).toBe('dice-bus')
    expect(cueForRoll(roll({ isDouble: true }))).toBe('dice-double')
    expect(cueForRoll(roll({ speed: 2 }))).toBe('dice-speed')
    expect(cueForRoll(roll({}))).toBe('dice-roll')
  })

  it('Ônibus tem prioridade sobre dupla', () => {
    expect(cueForRoll(roll({ special: 'onibus', isDouble: true }))).toBe('dice-bus')
  })
})

describe('cueForResolution (035 — kinds de resolução)', () => {
  it('cobre os kinds com som e ignora os demais', () => {
    expect(cueForResolution('purchase')).toBeNull() // prompt de compra é silencioso
    expect(cueForResolution('auction')).toBe('auction-bid')
    expect(cueForResolution('card-reveal')).toBe('card-reveal')
    expect(cueForResolution('card-shortcut')).toBe('card-shortcut')
    expect(cueForResolution('card-discard')).toBe('card-discard')
    expect(cueForResolution('debt')).toBe('debt')
    expect(cueForResolution('reaction-diplomacia')).toBe('reaction')
    expect(cueForResolution('reaction-bunker')).toBe('reaction')
  })
})

describe('cueForNotice (035 — notices)', () => {
  it('Loteria (free-parking) e Aquisição Hostil', () => {
    expect(cueForNotice('free-parking')).toBe('free-parking')
    expect(cueForNotice('hostile-takeover')).toBe('hostile-takeover')
  })
})
