import { describe, it, expect } from 'vitest'
import { grantLoan, proposeLoan, respondLoan, payOffLoan, chargeLoanInterest, activeLoanFor, lapsRemainingOf, LOAN_TERM_LAPS } from '@/game/emprestimos/emprestimos'
import { payDebt, declareBankruptcy } from '@/game/falencia/falencia'
import { advance, resolvePending, finishIfEnded, rollDice } from '@/game/turn/turnMachine'
import { economyResolve } from '@/game/economy/resolveRentable'
import { buildGameCtx, createSeedState, defaultPorts } from '@/game/setup'
import type { GameState } from '@/game/turn/types'
import type { Loan } from '@/game/economy/types'
import type { TurnCtx } from '@/game/turn/turnMachine'
import { pausedBy } from '../../net/harness'
import { rngFromDice } from '../turn/_helpers'
import { THEME } from '@/game/theme'

// Caixa inicial vem do THEME: um literal aqui trava o balanceamento no teste (D-076).
const CASH0 = THEME.INITIAL_CASH

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
    expect(after.players[1].cash).toBe(CASH0 - 400)
    expect(after.loans).toHaveLength(1)
    expect(after.loans[0]).toEqual({ debtorId: 'p1', creditorId: 'p2', principal: 400, ratePct: 20, lapsElapsed: 0 })
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
    const pausado = { ...withDebt('p2', 500), paused: pausedBy('disconnect') }
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
    expect(after.players[1].cash).toBe(CASH0)
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
    expect(after.players[1].cash).toBe(CASH0 - 400)
    expect(after.loans[0]).toEqual({ debtorId: 'p1', creditorId: 'p2', principal: 400, ratePct: 30, lapsElapsed: 0 })
  })

  it('respondLoan(recusa) fecha a proposta sem mover dinheiro', () => {
    let g = withDebt('p2', 500)
    g.players[0].cash = 100
    g = proposeLoan(g, 'p1', 'p2')
    const after = respondLoan(g, false, 20)
    expect(after.pendingLoan).toBeNull()
    expect(after.players[0].cash).toBe(100)
    expect(after.players[1].cash).toBe(CASH0)
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
    expect(g.log.some((e) => e.kind === 'loan-interest' && e.who === 'p1' && e.amount === 100 && e.creditorId === 'p2')).toBe(true) // feedback do débito (021/040)
  })

  it('SC-002: juros sem caixa pós-bônus → abre dívida ao credor', () => {
    const g = withLoan({ debtorId: 'p1', creditorId: 'p2', principal: 500, ratePct: 20 })
    g.players[0].cash = 40
    g.players[1].cash = 1000
    chargeLoanInterest(g, 'p1') // interest 100 > 40
    expect(g.players[0].cash).toBe(0)
    expect(g.players[1].cash).toBe(1040) // recebeu o parcial
    expect(g.resolution).toEqual({ kind: 'debt', amount: 60, creditorId: 'p2', debtorId: 'p1', cause: 'loan-interest', origin: 'loan-interest' })
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

  it('SC-002: rolagem real cobra juros no GO sem aumentar o principal', () => {
    const g = withLoan({ debtorId: 'p1', creditorId: 'p2', principal: 26, ratePct: 50 })
    g.players[0].pos = 45
    g.players[0].cash = 1000
    g.players[1].cash = 1000

    const after = rollDice(g, buildGameCtx(rngFromDice([1, 2]), () => 0))

    expect(after.players[0].pos).toBe(0)
    expect(after.players[0].cash).toBe(1000 + THEME.GO_PASS * 2 - 13) // caiu NO GO: bônus em dobro
    expect(after.players[1].cash).toBe(1000 + 13)
    expect(after.loans[0].principal).toBe(26)
    expect(after.log.some((entry) => (
      entry.kind === 'loan-interest'
      && entry.who === 'p1'
      && entry.creditorId === 'p2'
      && entry.amount === 13
    ))).toBe(true)
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

describe('Empréstimos — prazo de 3 voltas e vencimento (§15.6, D-054)', () => {
  // Empréstimo de $500 a 20% → juros de $100 por volta.
  function loan(lapsElapsed: number): GameState {
    const g = withLoan({ debtorId: 'p1', creditorId: 'p2', principal: 500, ratePct: 20, lapsElapsed })
    g.players[0].cash = CASH0
    g.players[1].cash = 1000
    return g
  }

  it('FR-001: empréstimo concedido nasce com o prazo cheio', () => {
    const g = withDebt('p2', 500)
    g.players[0].cash = 100
    const after = grantLoan(g, 'p1', 'p2', 400, 20)
    expect(lapsRemainingOf(after.loans[0])).toBe(LOAN_TERM_LAPS)
  })

  it('FR-003: 1ª e 2ª voltas cobram só os juros e consomem o prazo', () => {
    const g = loan(0)
    chargeLoanInterest(g, 'p1')
    expect(g.players[0].cash).toBe(CASH0 - 100)
    expect(g.players[1].cash).toBe(1100)
    expect(g.loans).toHaveLength(1)
    expect(lapsRemainingOf(g.loans[0])).toBe(2)

    chargeLoanInterest(g, 'p1')
    expect(g.players[0].cash).toBe(CASH0 - 200)
    expect(g.loans).toHaveLength(1)
    expect(lapsRemainingOf(g.loans[0])).toBe(1)
  })

  it('FR-004/FR-006: a 3ª volta cobra juros + principal e encerra o contrato', () => {
    const g = loan(2)
    chargeLoanInterest(g, 'p1')
    expect(g.players[0].cash).toBe(CASH0 - 600) // 100 de juros + 500 de principal
    expect(g.players[1].cash).toBe(1600)
    expect(g.loans).toHaveLength(0)
    expect(g.resolution).toBeNull()
    expect(g.log.some((e) => e.kind === 'loan-due' && e.amount === 600 && e.principal === 500 && e.interest === 100)).toBe(true)
  })

  it('SC-001: desembolso total do contrato levado ao fim = 3 juros + principal', () => {
    const g = loan(0)
    chargeLoanInterest(g, 'p1')
    chargeLoanInterest(g, 'p1')
    chargeLoanInterest(g, 'p1')
    expect(g.players[0].cash).toBe(CASH0 - 800) // 3 × 100 + 500
    expect(g.players[1].cash).toBe(1000 + 800)
    expect(g.loans).toHaveLength(0)
  })

  it('SC-002/FR-009: quitar antes do 1º GO paga só o principal, sem juros', () => {
    const g = loan(0)
    const after = payOffLoan(g, 'p1')
    expect(after.players[0].cash).toBe(CASH0 - 500) // só o principal
    expect(after.players[1].cash).toBe(1500)
    expect(after.loans).toHaveLength(0)
  })

  it('FR-005: o vencimento cobra DEPOIS do bônus de GO', () => {
    const g = loan(2)
    g.players[0].pos = 45
    // Sozinho não cobre os 600; COM o bônus do GO, cobre — e é essa ordem que o teste trava.
    g.players[0].cash = 600 - THEME.GO_PASS
    advance(g, g.players[0], 5, defaultPorts) // cruza o GO
    expect(g.players[0].cash).toBe(0)
    expect(g.resolution).toBeNull() // nada ficou devendo
    expect(g.loans).toHaveLength(0)
  })

  it('FR-010: encerrado o contrato, o devedor pode tomar outro empréstimo', () => {
    const g = loan(2)
    chargeLoanInterest(g, 'p1') // vence e encerra
    g.turn.state = 'casa-a-resolver'
    g.turn.pendingResolve = true
    g.players[0].cash = 100
    g.resolution = { kind: 'debt', amount: 500, creditorId: 'p3' }
    const after = proposeLoan(g, 'p1', 'p2')
    expect(after.pendingLoan).toEqual({ debtorId: 'p1', creditorId: 'p2', principal: 400 })
  })

  it('FR-005/FR-012: o prazo é do DEVEDOR — GO de outro jogador não consome volta', () => {
    const g = loan(0)
    chargeLoanInterest(g, 'p2') // p2 não é devedor de nada
    expect(lapsRemainingOf(g.loans[0])).toBe(LOAN_TERM_LAPS)
    expect(g.players[0].cash).toBe(CASH0)
  })

  it('R1: empréstimo de snapshot anterior à D-054 conta como recém-concedido', () => {
    const legado: Loan = { debtorId: 'p1', creditorId: 'p2', principal: 500, ratePct: 20 } // sem lapsElapsed
    expect(lapsRemainingOf(legado)).toBe(LOAN_TERM_LAPS)
    const g = withLoan(legado)
    g.players[0].cash = CASH0
    chargeLoanInterest(g, 'p1')
    expect(g.loans).toHaveLength(1) // não venceu de surpresa
    expect(lapsRemainingOf(g.loans[0])).toBe(2)
  })
})

describe('Empréstimos — vencimento sem caixa (US2, §15.6)', () => {
  function maturingWithCash(cash: number): GameState {
    const g = withLoan({ debtorId: 'p1', creditorId: 'p2', principal: 500, ratePct: 20, lapsElapsed: 2 })
    g.players[0].cash = cash
    g.players[1].cash = 1000
    return g
  }

  it('FR-007: caixa insuficiente → tudo ao credor e o resto vira dívida a ele', () => {
    const g = maturingWithCash(250)
    chargeLoanInterest(g, 'p1') // devido 600
    expect(g.players[0].cash).toBe(0)
    expect(g.players[1].cash).toBe(1250)
    expect(g.resolution).toEqual({ kind: 'debt', amount: 350, creditorId: 'p2', debtorId: 'p1', cause: 'loan-due', origin: 'loan-due' })
    expect(g.log.some((e) => e.kind === 'loan-due-short' && e.amount === 250 && e.shortfall === 350)).toBe(true)
  })

  it('FR-006: o contrato encerra mesmo sem caixa — o principal não é cobrado duas vezes', () => {
    const g = maturingWithCash(250)
    chargeLoanInterest(g, 'p1')
    expect(g.loans).toHaveLength(0)
    expect(activeLoanFor(g, 'p1')).toBeUndefined()
    chargeLoanInterest(g, 'p1') // GO seguinte: nada a cobrar
    expect(g.resolution).toEqual({ kind: 'debt', amount: 350, creditorId: 'p2', debtorId: 'p1', cause: 'loan-due', origin: 'loan-due' })
  })

  it('FR-008: a dívida do vencimento é pagável depois de levantar caixa', () => {
    const g = maturingWithCash(250)
    chargeLoanInterest(g, 'p1')
    g.players[0].cash = 350 // hipotecou/vendeu
    const paid = payDebt(g)
    expect(paid.resolution).toBeNull()
    expect(paid.players[1].cash).toBe(1250 + 350) // credor recebeu tudo
  })

  it('FR-008: insolvente no vencimento pode declarar falência, e o credor herda', () => {
    const g = maturingWithCash(0)
    g.titles[1].ownerId = 'p1'
    chargeLoanInterest(g, 'p1') // devido 600, caixa 0 → dívida de 600 a p2
    g.turn.state = 'casa-a-resolver'
    g.turn.pendingResolve = true
    const after = declareBankruptcy(g, ctx)
    expect(after.players[0].eliminated).toBe(true)
    expect(after.titles[1].ownerId).toBe('p2') // credor da dívida (§9.2) = credor do empréstimo
  })

  it('FR-008: a casa onde o jogador pousou ainda resolve depois de quitar o vencimento', () => {
    const g = withLoan({ debtorId: 'p1', creditorId: 'p2', principal: 1000, ratePct: 30, lapsElapsed: 2 })
    g.players[0].pos = 45
    g.players[0].cash = 40
    advance(g, g.players[0], 4, defaultPorts) // cruza o GO (+200) e pousa em Roma (pos 1)
    g.turn.state = 'casa-a-resolver'
    g.turn.pendingResolve = true
    expect(g.resolution?.kind).toBe('debt')
    expect(g.resolution).toMatchObject({ origin: 'loan-due' })

    const ctxE: TurnCtx = { rng: () => 0, ports: defaultPorts, resolve: economyResolve }
    g.players[0].cash = (g.resolution as { amount: number }).amount
    const paid = payDebt(g)
    expect(paid.resolution).toBeNull()
    expect(paid.turn.pendingResolve).toBe(true) // a casa não foi pulada
    expect(resolvePending(paid, ctxE).resolution).toEqual({ kind: 'purchase', pos: 1 })
  })
})

describe('Empréstimos — dívida de juros × resolução da casa (colisão do slot único)', () => {
  // p1 devedor (juros 300), pos 45, caixa 40: cruza o GO (+200 → 240 parciais ao credor),
  const CAIXA_MAGRO = 40 // menos que os 300 de juros, mesmo somado ao bônus do GO
  // fica devendo a diferença e pousa em Roma (pos 1, sem dono) — a casa NÃO pode engolir a dívida.
  function interestDebtOnLanding(): GameState {
    const g = createSeedState(['p1', 'p2'])
    g.loans.push({ debtorId: 'p1', creditorId: 'p2', principal: 1000, ratePct: 30 }) // juros 300
    g.players[0].pos = 45
    g.players[0].cash = CAIXA_MAGRO
    advance(g, g.players[0], 4, defaultPorts) // 45+4 = 49 % 48 = 1 (Roma) — cruza o GO
    g.turn.state = 'casa-a-resolver' // o que land() faria no fluxo do rollDice
    g.turn.pendingResolve = true
    return g
  }

  it('resolvePending NÃO sobrescreve a dívida de juros em voo; a casa resolve após quitar', () => {
    const g = interestDebtOnLanding()
    // Os juros são 300; o devedor cobre `CAIXA_MAGRO + bônus do GO` e fica devendo o resto.
    const parcial = CAIXA_MAGRO + THEME.GO_PASS
    const falta = 300 - parcial
    expect(g.resolution).toEqual({ kind: 'debt', amount: falta, creditorId: 'p2', debtorId: 'p1', cause: 'loan-interest', origin: 'loan-interest' })
    expect(g.players[1].cash).toBe(CASH0 + parcial) // credor recebeu o parcial

    const ctxE: TurnCtx = { rng: () => 0, ports: defaultPorts, resolve: economyResolve }
    expect(resolvePending(g, ctxE)).toBe(g) // bloqueado — a dívida precede a casa

    g.players[0].cash = falta // levantou caixa (hipoteca/venda/empréstimo)
    const paid = payDebt(g)
    expect(paid.resolution).toBeNull()
    expect(paid.players[1].cash).toBe(CASH0 + 300) // credor recebeu os juros COMPLETOS
    expect(paid.turn.state).toBe('casa-a-resolver') // a casa segue pendente (não foi pulada)
    expect(paid.turn.pendingResolve).toBe(true)

    const resolved = resolvePending(paid, ctxE)
    expect(resolved.resolution).toEqual({ kind: 'purchase', pos: 1 }) // Roma abre normalmente
  })

  it('dívida em voo segura a passagem de vez em turno encerrado (GO → Vá para a Prisão)', () => {
    const g = createSeedState(['p1', 'p2'])
    g.turn.state = 'encerrado'
    g.resolution = { kind: 'debt', amount: 60, creditorId: 'p2', origin: 'loan-interest' }
    const after = finishIfEnded(g, ctx)
    expect(after.activeSeat).toBe(0) // vez NÃO passou com dívida aberta
    expect(after.turn.state).toBe('encerrado')

    g.players[0].cash = 60
    const paid = payDebt(g)
    expect(paid.resolution).toBeNull()
    expect(paid.turn.state).toBe('aguardando-finalizacao') // sem casa pendente → concluir e finalizar
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
    expect(after.players[1].cash).toBe(CASH0 + 100) // caixa restante ao credor do empréstimo
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
