import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { logEvent, normalizeLog } from '@/game/log'
import { ALL_LOG_KINDS, type LogEntry, type LogKind } from '@/game/economy/types'
import { createSeedState } from '@/game/setup'
import { buildHouse, sellBuilding, buildHangar, sellHangar } from '@/game/economy/construction'
import { mortgageProperty, unmortgageProperty } from '@/game/economy/mortgage'
import { placeBid, closeAuction } from '@/game/economy/auction'
import { declineProperty } from '@/game/economy/purchase'
import { closeLandAuction } from '@/game/economy/landAuction'
import { collectCenter } from '@/game/balancing/balancing'
import { jailDecision } from '@/game/turn/turnMachine'
import { rngFromDice, mockPorts } from '../turn/_helpers'
import type { GameState } from '@/game/turn/types'

function sampleFor(kind: LogKind): LogEntry {
  switch (kind) {
    case 'roll': return { kind, who: 'p1', white: [3, 4], isDouble: false, special: null, speed: null, attempt: false }
    case 'go': return { kind, who: 'p1', amount: 200, landed: false }
    case 'buy': return { kind, who: 'p1', pos: 1, price: 60 }
    case 'rent': return { kind, who: 'p1', pos: 1, amount: 2, ownerId: 'p2' }
    case 'tax': return { kind, who: 'p1', amount: 200 }
    case 'bus-ticket-gain': return { kind, who: 'p1' }
    case 'card-draw': return { kind, who: 'p1', deck: 'acaso' }
    case 'card-immediate': return { kind, who: 'p1', deck: 'tesouro', name: 'Investidor Anjo', delta: 0 }
    case 'build': return { kind, who: 'p1', pos: 1, level: 1, cost: 100 }
    case 'build-hangar': return { kind, who: 'p1', pos: 9, cost: 100 }
    case 'sell-building': return { kind, who: 'p1', pos: 1, level: 0, amount: 50 }
    case 'sell-hangar': return { kind, who: 'p1', pos: 9, amount: 50 }
    case 'mortgage': return { kind, who: 'p1', pos: 1, amount: 30 }
    case 'unmortgage': return { kind, who: 'p1', pos: 1, cost: 33 }
    case 'auction-won': return { kind, who: 'bank', pos: 1, amount: 60, winnerId: 'p1' }
    case 'auction-unsold': return { kind, who: 'bank', pos: 1 }
    case 'lot-won': return { kind, who: 'bank', pos: 1, amount: 60, winnerId: 'p1', origin: 'scarcity' }
    case 'lot-unsold': return { kind, who: 'bank', pos: 1, origin: 'scarcity' }
    case 'free-parking': return { kind, who: 'p1', amount: 500 }
    case 'jail-fine': return { kind, who: 'p1', amount: 50 }
    case 'debt-paid': return { kind, who: 'p1', amount: 50 }
    case 'bankruptcy': return { kind, who: 'p1' }
    case 'trade': return { kind, who: 'p1', toId: 'p2' }
    case 'loan-interest': return { kind, who: 'p1', amount: 10, creditorId: 'p2' }
    case 'loan-interest-short': return { kind, who: 'p1', amount: 5, creditorId: 'p2', shortfall: 5 }
    case 'legacy': return { kind, who: 'p1', what: 'evento antigo' }
  }
}

describe('LogEntry — forma do evento (040, FR-001..006)', () => {
  it('logEvent empilha a entrada tipada no fim do log', () => {
    const g = createSeedState(['p1', 'p2'])
    logEvent(g, { kind: 'tax', who: 'p1', amount: 200 })
    expect(g.log).toEqual([{ kind: 'tax', who: 'p1', amount: 200 }])
  })

  it('teto de 50 é preservado — descarta a mais antiga', () => {
    const g = createSeedState(['p1', 'p2'])
    for (let i = 0; i < 60; i++) logEvent(g, { kind: 'tax', who: 'p1', amount: i })
    expect(g.log).toHaveLength(50)
    expect((g.log[0] as { amount: number }).amount).toBe(10)
    expect((g.log[49] as { amount: number }).amount).toBe(59)
  })

  it('ALL_LOG_KINDS cobre a união sem sobra nem falta — cada kind tem uma amostra válida', () => {
    for (const kind of ALL_LOG_KINDS) {
      const sample = sampleFor(kind)
      expect(sample.kind).toBe(kind)
    }
    expect(ALL_LOG_KINDS.length).toBe(26)
  })

  it('round-trip JSON é idêntico — nenhum campo perde tipo/valor (invariante 4)', () => {
    for (const kind of ALL_LOG_KINDS) {
      const sample = sampleFor(kind)
      const roundTripped = JSON.parse(JSON.stringify(sample))
      expect(roundTripped).toEqual(sample)
    }
  })

  it("'legacy' nunca é emitida por nenhum reducer do motor (invariante 9)", () => {
    const gameDir = join(__dirname, '../../../src/game')
    const offenders: string[] = []
    function scan(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) { scan(full); continue }
        if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue
        if (full.endsWith('economy/types.ts')) continue // é onde a variante é DECLARADA, não emitida
        if (full.endsWith('game/log.ts')) continue // normalização de snapshot velho — não é reducer
        const src = readFileSync(full, 'utf-8')
        if (/kind:\s*'legacy'/.test(src)) offenders.push(full)
      }
    }
    scan(gameDir)
    expect(offenders).toEqual([])
  })

  it('normalizeLog converte entrada sem kind (snapshot velho) para legacy', () => {
    const legacyRaw = [{ who: 'p1', what: 'comprou Roma por $60' }]
    expect(normalizeLog(legacyRaw)).toEqual([{ kind: 'legacy', who: 'p1', what: 'comprou Roma por $60' }])
  })

  it('normalizeLog preserva entrada já tipada intacta', () => {
    const typed: LogEntry[] = [{ kind: 'tax', who: 'p1', amount: 200 }]
    expect(normalizeLog(typed)).toEqual(typed)
  })
})

// T020 (040/Fase 4) — as 8 famílias antes silenciosas (construir, vender construção,
// hangar, hipoteca, deshipoteca, leilão comum, pregão, pote, fiança) via reducer REAL,
// não amostra sintética — prova que o `kind` sai do motor, não só que o tipo aceita.
describe('LogEntry — famílias antes silenciosas (040, FR-007..013, SC-008)', () => {
  it('build: uma entrada por nível construído, level = resultante', () => {
    let g = createSeedState(['p1', 'p2'])
    for (const pos of [1, 3, 5]) g.titles[pos].ownerId = 'p1'
    g = buildHouse(g, 1)
    expect(g.log.at(-1)).toMatchObject({ kind: 'build', who: 'p1', pos: 1, level: 1 })
    g = buildHouse(g, 3)
    g = buildHouse(g, 5)
    for (let level = 2; level <= 4; level++) {
      g = buildHouse(g, 1)
      g = buildHouse(g, 3)
      g = buildHouse(g, 5)
    }
    g = buildHouse(g, 1) // 5ª chamada: 4 casas viram 1 hotel (level 5)
    expect(g.log.at(-1)).toMatchObject({ kind: 'build', who: 'p1', pos: 1, level: 5 })
  })

  it('sell-building: level resultante após a venda', () => {
    let g = createSeedState(['p1', 'p2'])
    g.titles[1].ownerId = 'p1'
    g.titles[3].ownerId = 'p1'
    g = buildHouse(g, 1)
    g = buildHouse(g, 3)
    g = buildHouse(g, 1)
    g = sellBuilding(g, 1)
    expect(g.log.at(-1)).toMatchObject({ kind: 'sell-building', who: 'p1', pos: 1, level: 1 })
  })

  it('build-hangar / sell-hangar', () => {
    let g = createSeedState(['p1', 'p2'])
    g.titles[6].ownerId = 'p1' // JFK (aeroporto)
    g = buildHangar(g, 6)
    expect(g.log.at(-1)).toMatchObject({ kind: 'build-hangar', who: 'p1', pos: 6 })
    g = sellHangar(g, 6)
    expect(g.log.at(-1)).toMatchObject({ kind: 'sell-hangar', who: 'p1', pos: 6 })
  })

  it('mortgage / unmortgage', () => {
    let g: GameState = createSeedState(['p1', 'p2'])
    g.titles[1].ownerId = 'p1'
    g = mortgageProperty(g, 1)
    expect(g.log.at(-1)).toMatchObject({ kind: 'mortgage', who: 'p1', pos: 1, amount: 30 })
    g = unmortgageProperty(g, 1)
    expect(g.log.at(-1)).toMatchObject({ kind: 'unmortgage', who: 'p1', pos: 1, cost: 33 })
  })

  it('auction-won: fecho com lance vencedor, who = "bank"', () => {
    let g = createSeedState(['p1', 'p2', 'p3'])
    g.players[0].pos = 1
    g.turn.state = 'casa-a-resolver'
    g.turn.pendingResolve = true
    g.resolution = { kind: 'purchase', pos: 1 }
    g = declineProperty(g, 0)
    g = placeBid(g, 'p2', 50, 1000)
    g = closeAuction(g)
    expect(g.log.at(-1)).toMatchObject({ kind: 'auction-won', who: 'bank', pos: 1, amount: 50, winnerId: 'p2' })
  })

  it('auction-unsold: fecho sem lance, who = "bank"', () => {
    let g = createSeedState(['p1', 'p2'])
    g.players[0].pos = 1
    g.turn.state = 'casa-a-resolver'
    g.turn.pendingResolve = true
    g.resolution = { kind: 'purchase', pos: 1 }
    g = declineProperty(g, 0)
    g = closeAuction(g)
    expect(g.log.at(-1)).toMatchObject({ kind: 'auction-unsold', who: 'bank', pos: 1 })
  })

  it('lot-won / lot-unsold: `origin` sobrevive mesmo com `landAuction` esvaziado no fecho', () => {
    let g = createSeedState(['p1', 'p2'])
    g.landAuction = {
      lots: [
        { pos: 3, currentBid: 40, highBidder: 'p2', deadline: 0 },
        { pos: 5, currentBid: 0, highBidder: null, deadline: 0 },
      ],
      bidders: ['p1', 'p2'],
      origin: 'scarcity',
      bankruptId: null,
    }
    g = closeLandAuction(g)
    expect(g.landAuction).toBeNull() // esvaziado — e o evento já tinha capturado `origin`
    expect(g.log.some((e) => e.kind === 'lot-won' && e.who === 'bank' && e.pos === 3 && e.amount === 40 && e.winnerId === 'p2' && e.origin === 'scarcity')).toBe(true)
    expect(g.log.some((e) => e.kind === 'lot-unsold' && e.who === 'bank' && e.pos === 5 && e.origin === 'scarcity')).toBe(true)
  })

  it('free-parking: coleta do pote', () => {
    const g = createSeedState(['p1', 'p2'])
    g.centerPot = 500
    collectCenter(g, 'p1')
    expect(g.log.at(-1)).toMatchObject({ kind: 'free-parking', who: 'p1', amount: 500 })
  })

  it('jail-fine: pagamento voluntário e multa forçada na 3ª tentativa', () => {
    let g = createSeedState(['p1'])
    g.players[0].pos = 12
    g.players[0].jail = { inJail: true, attempts: 0 }
    g.turn.state = 'prisao-decisao'
    g = jailDecision(g, 'pay', { rng: rngFromDice([1, 1]), ports: mockPorts() })
    expect(g.log.at(-1)).toMatchObject({ kind: 'jail-fine', who: 'p1', amount: 50 })

    let g2 = createSeedState(['p1'])
    g2.players[0].pos = 12
    g2.players[0].jail = { inJail: true, attempts: 0 }
    g2.turn.state = 'prisao-decisao'
    const ctx = { rng: rngFromDice([3, 2]), ports: mockPorts() } // nunca dupla
    g2 = jailDecision(g2, 'try', ctx)
    g2 = jailDecision(g2, 'try', ctx)
    g2 = jailDecision(g2, 'try', ctx) // 3ª → forçada
    expect(g2.log.at(-1)).toMatchObject({ kind: 'jail-fine', who: 'p1', amount: 50 })
  })
})
