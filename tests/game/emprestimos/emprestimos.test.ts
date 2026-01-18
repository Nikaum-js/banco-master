import { describe, it, expect } from 'vitest'
import { grantLoan, proposeLoan, respondLoan, payOffLoan, chargeLoanInterest, activeLoanFor } from '@/game/emprestimos/emprestimos'
import { payDebt, declareBankruptcy } from '@/game/falencia/falencia'
import { advance } from '@/game/turn/turnMachine'
import { createSeedState, defaultPorts } from '@/game/store'
import type { GameState } from '@/game/turn/types'
import type { Loan } from '@/game/economy/types'
import type { TurnCtx } from '@/game/turn/turnMachine'

const ctx: TurnCtx = { rng: () => 0, ports: defaultPorts }

// Estado com dívida pendente do jogador ativo (p1).
function withDebt(creditorId: string | null, amount: number): GameState {
  const g = createSeedState(['p1', 'p2', 'p3'])
  g.turn.state = 'casa-a-resolver'
  g.turn.pendingResolve = true
  g.resolution = { kind: 'debt', amount, creditorId }
  return g
}

function withLoan(loan: Loan): GameState {
  const g = createSeedState(['p1', 'p2', 'p3'])
  g.loans.push(loan)
  return g
}

describe('Empréstimos — conceder/validar (US1)', () => {
  it('SC-001: concede empréstimo válido (principal credor→devedor, registra)', () => {
    const g = withDebt('p2', 500)
    g.players[0].cash = 100 // déficit 400
    const after = grantLoan(g, 'p1', 'p2', 400, 20)
    expect(after.players[0].cash).toBe(500) // 100 + 400
    expect(after.players[1].cash).toBe(2000 - 400)
    expect(after.loans).toHaveLength(1)
    expect(after.loans[0]).toEqual({ debtorId: 'p1', creditorId: 'p2', principal: 400, ratePct: 20 })
  })

  it('SC-002: após conceder, payDebt (008) quita com o caixa emprestado', () => {
    let g = withDebt('p2', 500)
    g.players[0].cash = 100
    g = grantLoan(g, 'p1', 'p2', 400, 20) // → caixa 500
    g = payDebt(g)
    expect(g.resolution).toBeNull()
    expect(g.players[0].cash).toBe(0)
  })

  it('SC-001/SC-005: rejeições deixam o estado inalterado', () => {
    const base = withDebt('p2', 500)
    base.players[0].cash = 100 // déficit 400
    expect(grantLoan(base, 'p1', 'p2', 400, 5)).toBe(base) // taxa < 10
    expect(grantLoan(base, 'p1', 'p2', 400, 60)).toBe(base) // taxa > 50
    expect(grantLoan(base, 'p1', 'p2', 300, 20)).toBe(base) // principal < déficit
    expect(grantLoan(base, 'p1', 'p1', 400, 20)).toBe(base) // credor = devedor
    // credor sem caixa
    const semCaixa = withDebt('p2', 500)
    semCaixa.players[0].cash = 100
    semCaixa.players[1].cash = 100
    expect(grantLoan(semCaixa, 'p1', 'p2', 400, 20)).toBe(semCaixa)
    // devedor já com empréstimo ativo (limite 1, §15.3)
    const jaTem = withDebt('p2', 500)
    jaTem.players[0].cash = 100
    jaTem.loans.push({ debtorId: 'p1', creditorId: 'p3', principal: 50, ratePct: 10 })
    expect(grantLoan(jaTem, 'p1', 'p2', 400, 20)).toBe(jaTem)
    // fora da janela de dívida
    const semDebt = createSeedState(['p1', 'p2'])
    expect(grantLoan(semDebt, 'p1', 'p2', 400, 20)).toBe(semDebt)
    // pausado
    const pausado = { ...withDebt('p2', 500), paused: true }
    pausado.players[0].cash = 100
    expect(grantLoan(pausado, 'p1', 'p2', 400, 20)).toBe(pausado)
  })
})

describe('Empréstimos — solicitação e aceite do credor (§15.2/§15.3)', () => {
  it('proposeLoan abre a proposta (déficit) sem mover dinheiro', () => {
    const g = withDebt('p2', 500)
    g.players[0].cash = 100 // déficit 400
    const after = proposeLoan(g, 'p1', 'p2')
    expect(after.pendingLoan).toEqual({ debtorId: 'p1', creditorId: 'p2', principal: 400 })
    expect(after.players[0].cash).toBe(100) // nada movido ainda
    expect(after.players[1].cash).toBe(2000)
    expect(after.loans).toHaveLength(0)
  })

  it('proposeLoan no-op: fora da dívida, auto-pedido, credor sem caixa, já com empréstimo', () => {
    const semDebt = createSeedState(['p1', 'p2'])
    expect(proposeLoan(semDebt, 'p1', 'p2')).toBe(semDebt)

    const base = withDebt('p2', 500)
    base.players[0].cash = 100
    expect(proposeLoan(base, 'p1', 'p1')).toBe(base) // credor = devedor

    const semCaixa = withDebt('p2', 500)
    semCaixa.players[0].cash = 100
    semCaixa.players[1].cash = 100 // credor não cobre o déficit 400
    expect(proposeLoan(semCaixa, 'p1', 'p2')).toBe(semCaixa)

    const jaTem = withDebt('p2', 500)
    jaTem.players[0].cash = 100
    jaTem.loans.push({ debtorId: 'p1', creditorId: 'p3', principal: 50, ratePct: 10 })
    expect(proposeLoan(jaTem, 'p1', 'p2')).toBe(jaTem)
  })

  it('respondLoan(aceita) concede à taxa do credor e fecha a proposta', () => {
    let g = withDebt('p2', 500)
    g.players[0].cash = 100
    g = proposeLoan(g, 'p1', 'p2')
    const after = respondLoan(g, true, 30) // credor define 30%
    expect(after.pendingLoan).toBeNull()
    expect(after.players[0].cash).toBe(500) // 100 + 400
    expect(after.players[1].cash).toBe(2000 - 400)
    expect(after.loans[0]).toEqual({ debtorId: 'p1', creditorId: 'p2', principal: 400, ratePct: 30 })
  })

  it('respondLoan(recusa) fecha a proposta sem mover dinheiro', () => {
    let g = withDebt('p2', 500)
    g.players[0].cash = 100
    g = proposeLoan(g, 'p1', 'p2')
    const after = respondLoan(g, false, 20)
    expect(after.pendingLoan).toBeNull()
    expect(after.players[0].cash).toBe(100)
    expect(after.players[1].cash).toBe(2000)
    expect(after.loans).toHaveLength(0)
  })

  it('respondLoan com taxa inválida mantém a proposta aberta', () => {
    let g = withDebt('p2', 500)
    g.players[0].cash = 100
    g = proposeLoan(g, 'p1', 'p2')
    expect(respondLoan(g, true, 5)).toBe(g) // < 10
    expect(respondLoan(g, true, 60)).toBe(g) // > 50
  })
})

describe('Empréstimos — juros no GO e quitação (US2)', () => {
  it('SC-002: chargeLoanInterest cobra juros simples (devedor−/credor+)', () => {
    const g = withLoan({ debtorId: 'p1', creditorId: 'p2', principal: 500, ratePct: 20 })
    g.players[0].cash = 300
    g.players[1].cash = 1000
    chargeLoanInterest(g, 'p1') // 20% de 500 = 100
    expect(g.players[0].cash).toBe(200)
    expect(g.players[1].cash).toBe(1100)
    expect(g.log.some((e) => e.who === 'p1' && /juros/.test(e.what))).toBe(true) // feedback do débito (021)
  })

  it('SC-002: juros sem caixa pós-bônus → abre dívida ao credor', () => {
    const g = withLoan({ debtorId: 'p1', creditorId: 'p2', principal: 500, ratePct: 20 })
    g.players[0].cash = 40
    g.players[1].cash = 1000
    chargeLoanInterest(g, 'p1') // interest 100 > 40
    expect(g.players[0].cash).toBe(0)
    expect(g.players[1].cash).toBe(1040) // recebeu o parcial
    expect(g.resolution).toEqual({ kind: 'debt', amount: 60, creditorId: 'p2' })
  })

  it('SC-002: advance cruzando o GO dispara a cobrança via porta afterPassGo', () => {
    const g = withLoan({ debtorId: 'p1', creditorId: 'p2', principal: 500, ratePct: 20 })
    g.players[0].pos = 45
    g.players[0].cash = 1000
    const credorAntes = g.players[1].cash
    advance(g, g.players[0], 5, defaultPorts) // 45 + 5 = 50 % 48 = 2 → cruzou o GO
    expect(g.players[0].pos).toBe(2)
    expect(g.players[1].cash).toBe(credorAntes + 100) // juros creditados ao credor
  })

  it('SC-003: payOffLoan paga só o principal e remove o empréstimo', () => {
    const g = withLoan({ debtorId: 'p1', creditorId: 'p2', principal: 500, ratePct: 20 })
    g.players[0].cash = 600
    g.players[1].cash = 1000
    const after = payOffLoan(g, 'p1')
    expect(after.players[0].cash).toBe(100) // só o principal
    expect(after.players[1].cash).toBe(1500)
    expect(after.loans).toHaveLength(0)
    expect(activeLoanFor(after, 'p1')).toBeUndefined()
  })

  it('SC-003: payOffLoan sem caixa para o principal é no-op', () => {
    const g = withLoan({ debtorId: 'p1', creditorId: 'p2', principal: 500, ratePct: 20 })
    g.players[0].cash = 400
    expect(payOffLoan(g, 'p1')).toBe(g)
  })
})

describe('Empréstimos — falência §9.3 (US3)', () => {
  it('SC-004: falir com empréstimo ativo → credor do EMPRÉSTIMO herda (precede §9.2)', () => {
    const g = withDebt('p3', 800) // dívida-gatilho é a um TERCEIRO (p3)
    g.players[0].cash = 100
    g.titles[1].ownerId = 'p1'
    g.titles[3].ownerId = 'p1'
    g.loans.push({ debtorId: 'p1', creditorId: 'p2', principal: 300, ratePct: 20 }) // credor = p2
    const after = declareBankruptcy(g, ctx)
    expect(after.titles[1].ownerId).toBe('p2') // p2 herda, não p3
    expect(after.titles[3].ownerId).toBe('p2')
    expect(after.players[1].cash).toBe(2000 + 100) // caixa restante ao credor do empréstimo
    expect(after.players[0].eliminated).toBe(true)
    expect(after.loans).toHaveLength(0) // empréstimo liquidado
  })

  it('SC-004: hipoteca preservada sob o credor herdeiro', () => {
    const g = withDebt('p3', 800)
    g.players[0].cash = 0
    g.titles[1].ownerId = 'p1'
    g.titles[1].mortgaged = true
    g.loans.push({ debtorId: 'p1', creditorId: 'p2', principal: 300, ratePct: 20 })
    const after = declareBankruptcy(g, ctx)
    expect(after.titles[1].ownerId).toBe('p2')
    expect(after.titles[1].mortgaged).toBe(true)
  })

  it('SC-004: sem empréstimo ativo → §9.2 inalterado (credor da dívida herda)', () => {
    const g = withDebt('p2', 500)
    g.players[0].cash = 100
    g.titles[1].ownerId = 'p1'
    const after = declareBankruptcy(g, ctx)
    expect(after.titles[1].ownerId).toBe('p2') // credor da dívida (§9.2)
    expect(after.loans).toHaveLength(0)
  })

  it('§9.1: declarar falência é no-op enquanto solvente; elimina quando insolvente', () => {
    // Solvente: caixa já cobre a dívida (liquidationValue ≥ dívida) → no-op.
    const solvente = withDebt('p2', 100)
    solvente.players[0].cash = 200
    expect(declareBankruptcy(solvente, ctx)).toBe(solvente)

    // Insolvente: sem ativos e caixa < dívida (liquidationValue < dívida) → elimina.
    const insolvente = withDebt('p2', 100)
    insolvente.players[0].cash = 40
    expect(declareBankruptcy(insolvente, ctx).players[0].eliminated).toBe(true)
  })

  it('R8: empréstimo some quando o CREDOR é eliminado', () => {
    const g = withDebt(null, 500) // p1 deve ao banco e vai falir
    g.players[0].cash = 0
    g.loans.push({ debtorId: 'p2', creditorId: 'p1', principal: 200, ratePct: 30 }) // p1 é CREDOR aqui
    const after = declareBankruptcy(g, ctx)
    expect(after.loans).toHaveLength(0) // empréstimo perdoado (credor eliminado)
  })
})
