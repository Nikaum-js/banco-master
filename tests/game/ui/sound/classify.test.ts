import { describe, it, expect } from 'vitest'
import { classifyLogEntry, countNewLogEntries, cueForRoll, cueForResolution, cueForNotice } from '@/game/ui/sound/classify'
import type { LogEntry } from '@/game/economy/types'
import type { Roll } from '@/game/turn/types'

const log = (what: string): LogEntry => ({ who: 'p1', what })
const roll = (over: Partial<Roll>): Roll => ({ white: [3, 4], speed: null, isDouble: false, move: 7, special: null, ...over })

describe('classifyLogEntry (035 — tail do log → cue)', () => {
  it('mapeia eventos só-logados pelos prefixos reais do motor (021)', () => {
    expect(classifyLogEntry(log('pagou $200 de imposto'))).toBe('tax-paid')
    expect(classifyLogEntry(log('pagou $120 de aluguel a p2'))).toBe('rent-paid')
    expect(classifyLogEntry(log('passou pelo GO (+$300)'))).toBe('go-bonus')
    expect(classifyLogEntry(log('parou no GO (+$400)'))).toBe('go-bonus')
    expect(classifyLogEntry(log('pagou R$ 50 de juros a p3 (GO)'))).toBe('loan-interest')
    expect(classifyLogEntry(log('não cobriu os juros de p3 — dívida de R$ 80'))).toBe('loan-interest')
    expect(classifyLogEntry(log('parou no espaço Bus Ticket — ganhou 1 Bus Ticket'))).toBe('busticket-gain')
    expect(classifyLogEntry(log('faliu'))).toBe('bankruptcy')
  })

  it('saque é GENÉRICO — não vaza a raridade da carta privada (FR-016/SC-004)', () => {
    expect(classifyLogEntry(log('sacou Acaso'))).toBe('card-draw')
    expect(classifyLogEntry(log('sacou Tesouro'))).toBe('card-draw')
    // O texto privado da carta na mão ("Acaso: Investidor Anjo") não deve soar pelo log.
  })

  it('compra CONFIRMADA toca o buy — cair na casa (prompt) é silencioso', () => {
    expect(classifyLogEntry(log('comprou Paris por $200'))).toBe('buy')
  })

  it('eventos já cobertos por canais tipados → null (evita disparo duplo, FR-007)', () => {
    expect(classifyLogEntry(log('rolou 3+4'))).toBeNull()
    expect(classifyLogEntry(log('pagou dívida $300'))).toBeNull()
    expect(classifyLogEntry(log('p1 ↔ p2: troca aceita'))).toBeNull() // C1: trade fora desta fatia
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
