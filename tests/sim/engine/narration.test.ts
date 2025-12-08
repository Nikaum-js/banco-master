/**
 * Os invariantes que o harness não tinha — e a prova de que eles PEGAM os bugs que passaram.
 *
 * Um invariante novo só vale se falhar no bug que motivou sua existência. Cada teste aqui
 * reconstrói o estado "antes/depois" que o bug produzia e mostra a violação sendo levantada;
 * o par de cada um mostra o comportamento corrigido passando. Sem isso, um invariante novo é
 * só código que nunca disse não.
 */
import { describe, it, expect } from 'vitest'
import { createSeedState, buildPorts, buildGameCtx } from '@/game/setup'
import { checkNarration, checkNoTruncation, namesIn } from './narration'
import { stepWithConvergence } from './convergence'
import { checkInvariants } from './invariants'
import { rollTaxMan } from '@/game/balancing/taxMan'
import { applyEffect } from '@/game/cards/effects'
import { ALL_LOG_KINDS, type LogEntry, type LogKind } from '@/game/economy/types'
import type { GameState } from '@/game/turn/types'

const codesOf = (vs: { code: string }[]): string[] => vs.map((v) => v.code)

describe('(n) narração — todo Δcaixa é nomeado por um fato do mesmo despacho', () => {
  it('PEGA o Fiscal mudo: caixa cai sem fato nenhum → violação', () => {
    const prev = createSeedState(['p1', 'p2'])
    const next = structuredClone(prev)
    next.players[1].cash -= 200 // exatamente o que `rollTaxMan` fazia, sem `logEvent`

    const vs = checkNarration(prev, next)

    expect(codesOf(vs)).toEqual(['n'])
    expect(vs[0].detail).toContain('Δcaixa(p2) = -200')
    expect(vs[0].detail).toContain('nenhum')
  })

  it('e ACEITA o Fiscal corrigido: o mesmo débito, agora com `tax-man` nomeando o dono', () => {
    const prev = createSeedState(['p1', 'p2'])
    const next = structuredClone(prev)
    next.players[1].cash -= 200
    next.log.push({ kind: 'tax-man', who: 'p2', pos: 5, amount: 200, due: 200 })

    expect(checkNarration(prev, next)).toEqual([])
  })

  it('não se satisfaz com um fato de OUTRO jogador — foi por isso que "existe log novo" não bastava', () => {
    const prev = createSeedState(['p1', 'p2', 'p3'])
    const next = structuredClone(prev)
    next.players[2].cash -= 50 // p3 pagou
    next.log.push({ kind: 'card-draw', who: 'p1', deck: 'tesouro' }) // mas o fato é sobre p1

    const vs = checkNarration(prev, next)

    expect(codesOf(vs)).toEqual(['n'])
    expect(vs[0].detail).toContain('p3')
  })

  it('cobre os DOIS lados de uma transferência — credor e devedor', () => {
    const prev = createSeedState(['p1', 'p2'])
    const next = structuredClone(prev)
    next.players[0].cash -= 120
    next.players[1].cash += 120
    next.log.push({ kind: 'rent', who: 'p1', pos: 1, amount: 120, ownerId: 'p2' })

    expect(checkNarration(prev, next)).toEqual([])
  })

  it('a troca sem valores no log deixaria os dois lados descobertos; com valores, cobre', () => {
    const prev = createSeedState(['p1', 'p2'])
    const next = structuredClone(prev)
    next.players[0].cash -= 300
    next.players[1].cash += 300
    next.log.push({ kind: 'trade', who: 'p1', toId: 'p2', fromDelta: -300, toDelta: 300 })

    expect(checkNarration(prev, next)).toEqual([])
  })

  it('funciona com o log CHEIO (anel de 50) — o prefixo desliza e o sufixo novo é reconhecido', () => {
    const prev = createSeedState(['p1', 'p2'])
    for (let i = 0; i < 50; i++) prev.log.push({ kind: 'bus-ticket-gain', who: 'p1' })
    expect(prev.log).toHaveLength(50)

    const next = structuredClone(prev)
    next.players[1].cash -= 200
    next.log.shift()
    next.log.push({ kind: 'tax-man', who: 'p2', pos: 5, amount: 200, due: 200 })

    expect(next.log).toHaveLength(50) // comprimento IGUAL: `slice(prev.length)` não veria nada
    expect(checkNarration(prev, next)).toEqual([])
  })

  it('eliminação é isenta: o caixa do eliminado é zerado por regra (§9.4)', () => {
    const prev = createSeedState(['p1', 'p2'])
    const next = structuredClone(prev)
    next.players[1].cash = 0
    next.players[1].eliminated = true
    next.players[0].cash += prev.players[1].cash // herança
    next.log.push({ kind: 'bankruptcy', who: 'p2' })

    expect(checkNarration(prev, next)).toEqual([])
  })

  it('todo LogKind é classificável por `namesIn` — exaustividade, não amostra', () => {
    // Guarda estrutural: um `LogKind` novo que mova caixa e não apareça em `namesIn` deixaria de
    // cobrir o jogador afetado. O `switch` sem `default` faz o TS recusar; isto trava em runtime.
    for (const kind of ALL_LOG_KINDS as readonly LogKind[]) {
      const amostra = { kind, who: 'p1' } as unknown as LogEntry
      expect(() => namesIn(amostra)).not.toThrow()
    }
  })
})

describe('(t) não-truncagem — obrigação a jogador não pode desaparecer', () => {
  it('PEGA o bug do CARD 02: pagou todo o caixa a um jogador e nada ficou devido', () => {
    const prev = createSeedState(['p1', 'p2'])
    prev.players[1].cash = 43
    const next = structuredClone(prev)
    next.players[1].cash = 0
    next.players[0].cash += 43
    next.log.push({ kind: 'card-collect', who: 'p2', name: 'Aniversario', delta: -43, counterpartId: 'p1' })
    // e NADA em `obligations` — é exatamente o estado que o motor produzia antes da D-061

    const vs = checkNoTruncation(prev, next)

    expect(codesOf(vs)).toEqual(['t'])
    expect(vs[0].detail).toContain('o restante da cobrança desapareceu')
  })

  it('e ACEITA o comportamento corrigido: o restante existe como obrigação', () => {
    const prev = createSeedState(['p1', 'p2'])
    prev.players[1].cash = 43
    const next = structuredClone(prev)
    next.players[1].cash = 0
    next.players[0].cash += 43
    next.obligations = [{ debtorId: 'p2', creditorId: 'p1', amount: 7, cause: 'obligation' }]
    next.log.push({ kind: 'card-collect', who: 'p2', name: 'Aniversario', delta: -43, counterpartId: 'p1' })

    expect(checkNoTruncation(prev, next)).toEqual([])
  })

  it('cobrança ao BANCO que trunca é permitida (§9.1/D-061) — não é a mesma coisa', () => {
    const prev = createSeedState(['p1', 'p2'])
    prev.players[0].cash = 20
    const next = structuredClone(prev)
    next.players[0].cash = 0
    next.centerPot += 20
    next.log.push({ kind: 'card-collect', who: 'p1', name: 'Honorarios', delta: -20, counterpartId: 'bank' })

    expect(checkNoTruncation(prev, next)).toEqual([]) // pote não é parte lesada
  })

  it('roda de verdade sobre o reducer: Aniversário com adversário curto passa nos dois invariantes', () => {
    const prev = createSeedState(['p1', 'p2'])
    prev.players[0].cash = 1_000
    prev.players[1].cash = 43
    const next = structuredClone(prev)
    applyEffect('aniversario', next, 'p1', buildPorts())

    expect(checkNarration(prev, next)).toEqual([])
    expect(checkNoTruncation(prev, next)).toEqual([])
    expect(next.obligations).toHaveLength(1)
  })

  it('roda de verdade sobre o Fiscal: o débito fora da vez passa na narração', () => {
    const prev = createSeedState(['p1', 'p2'])
    for (const sq of Object.keys(prev.titles)) prev.titles[Number(sq)].ownerId = 'p2'
    const next = structuredClone(prev)
    rollTaxMan(next, () => 0.5)

    expect(checkNarration(prev, next)).toEqual([])
  })
})

describe('(h) fila de obrigações bem-formada', () => {
  it('valor zero, devedor inexistente e duplicata do mesmo par são violações', () => {
    const s = createSeedState(['p1', 'p2'])
    s.obligations = [
      { debtorId: 'p2', creditorId: 'p1', amount: 0, cause: 'obligation' },
      { debtorId: 'p9', creditorId: 'p1', amount: 5, cause: 'obligation' },
      { debtorId: 'p2', creditorId: 'p1', amount: 5, cause: 'obligation' },
      { debtorId: 'p2', creditorId: 'p1', amount: 5, cause: 'obligation' },
    ]

    const codes = codesOf(checkInvariants(s, s))

    // Quatro, não três: valor zero (1ª), devedor inexistente (2ª) e DUAS duplicatas — a 3ª e a
    // 4ª repetem a chave `p2→p1:obligation` que a 1ª já ocupou. A entrada malformada conta nos
    // dois eixos de propósito: um invariante que para no primeiro problema esconde o segundo.
    expect(codes.filter((c) => c === 'h')).toHaveLength(4)
  })

  it('fila legítima não gera violação', () => {
    const s = createSeedState(['p1', 'p2', 'p3'])
    s.obligations = [
      { debtorId: 'p2', creditorId: 'p1', amount: 7, cause: 'obligation' },
      { debtorId: 'p3', creditorId: 'p1', amount: 50, cause: 'obligation' },
    ]

    expect(codesOf(checkInvariants(s, s)).filter((c) => c === 'h')).toEqual([])
  })
})

describe('(v) convergência host × cliente — o caminho de produção dentro da simulação', () => {
  function ctx() {
    let clock = 0
    return buildGameCtx(() => 0.5, () => (clock += 1))
  }

  it('um comando com não-determinismo (rolagem) converge byte a byte', () => {
    const g: GameState = createSeedState(['p1', 'p2'])
    const step = stepWithConvergence(g, { kind: 'roll' }, ctx())

    expect(step.violations).toEqual([])
    expect(step.host.turn.lastRoll).not.toBeNull()
  })

  it('o saque de carta converge — o deck do cliente é oculto e o valor vem do replay', () => {
    const g: GameState = createSeedState(['p1', 'p2'])
    g.players[0].pos = 1
    let s = stepWithConvergence(g, { kind: 'roll' }, ctx())
    expect(s.violations).toEqual([])
    s = stepWithConvergence(s.host, { kind: 'resolve-pending' }, ctx())
    expect(s.violations).toEqual([])
  })

  it('a passagem de turno converge — e é ela que roda o Fiscal, cujo dado é gravado', () => {
    const g: GameState = createSeedState(['p1', 'p2'])
    for (const pos of Object.keys(g.titles)) g.titles[Number(pos)].ownerId = 'p1'
    g.turn.state = 'aguardando-finalizacao'

    const step = stepWithConvergence(g, { kind: 'finalize' }, ctx())

    // Se o Fiscal consumisse RNG fora do recorder, o cliente levantaria underflow aqui — e é
    // por isso que este caso específico existe: é o único débito que nasce na virada de turno.
    expect(step.violations).toEqual([])
    expect(step.host.activeSeat).toBe(1)
  })
})
