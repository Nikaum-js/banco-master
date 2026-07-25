// Card 3 do review de arquitetura: o motor expunha o COMANDO mas não a PERGUNTA que ele
// responde, então a UI reescrevia a cadeia de guardas para saber se podia oferecer o
// controle — e errava. Estes testes travam a equivalência "o predicado diz sim ⟺ o
// comando aceita", que é a única coisa que impede affordance e regra de divergirem.
import { describe, expect, it } from 'vitest'
import { createSeedState } from '@/game/setup'
import { canUseBusTicket, useBusTicket } from '@/game/turn/turnMachine'
import { purchasePrice, buyProperty } from '@/game/economy/purchase'
import { interestOf, eligibleLenders, loanShortfall, proposeLoan } from '@/game/emprestimos/emprestimos'
import { ctxWith } from '../turn/_helpers'
import type { GameState } from '@/game/turn/types'

describe('canUseBusTicket ⟺ useBusTicket', () => {
  const comTicket = (over: Partial<GameState> = {}): GameState => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].busTickets = 1
    g.players[0].pos = 3 // meio de um lado, não canto
    return { ...g, ...over }
  }

  it('diz sim quando o comando aceita', () => {
    const g = comTicket()
    expect(canUseBusTicket(g)).toBe(true)
    expect(useBusTicket(g, 5, ctxWith([1]))).not.toBe(g)
  })

  it('PAUSADO diz não — era exatamente a guarda que a cópia do ModalLayer não tinha', () => {
    const g = comTicket({ paused: true })
    expect(canUseBusTicket(g)).toBe(false)
    expect(useBusTicket(g, 5, ctxWith([1]))).toBe(g)
  })

  it('sem ticket, diz não (FR-002)', () => {
    const g = comTicket()
    g.players[0].busTickets = 0
    expect(canUseBusTicket(g)).toBe(false)
    expect(useBusTicket(g, 5, ctxWith([1]))).toBe(g)
  })

  it('sobre um canto, diz não (FR-003a)', () => {
    const g = comTicket()
    g.players[0].pos = 0 // GO é canto
    expect(canUseBusTicket(g)).toBe(false)
    expect(useBusTicket(g, 5, ctxWith([1]))).toBe(g)
  })

  it('fora das duas janelas de turno, diz não (034/D-027)', () => {
    const g = comTicket()
    g.turn.state = 'casa-a-resolver'
    expect(canUseBusTicket(g)).toBe(false)
    expect(useBusTicket(g, 5, ctxWith([1]))).toBe(g)
  })

  it('partida encerrada diz não', () => {
    expect(canUseBusTicket(comTicket({ phase: 'ended' }))).toBe(false)
  })
})

describe('purchasePrice espelha o que buyProperty cobra', () => {
  const emCompra = (discount = 0): GameState => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].nextPurchaseDiscount = discount
    g.turn.state = 'casa-a-resolver'
    g.resolution = { kind: 'purchase', pos: 1, playerId: 'p1' } as GameState['resolution']
    return g
  }

  it('sem desconto, é o preço de tabela', () => {
    const g = emCompra()
    const price = purchasePrice(g, 1)!
    const caixaAntes = g.players[0].cash
    expect(buyProperty(g).players[0].cash).toBe(caixaAntes - price)
  })

  it('com Investidor Anjo (006), o cobrado é o do predicado', () => {
    const g = emCompra(0.5)
    const price = purchasePrice(g, 1)!
    expect(price).toBeLessThan(purchasePrice(emCompra(), 1)!)
    const caixaAntes = g.players[0].cash
    expect(buyProperty(g).players[0].cash).toBe(caixaAntes - price)
  })

  it('casa sem preço devolve null', () => {
    expect(purchasePrice(emCompra(), 0)).toBeNull() // GO
  })
})

describe('interestOf', () => {
  it('juros simples arredondados (§15.4)', () => {
    expect(interestOf(300, 20)).toBe(60)
    expect(interestOf(305, 10)).toBe(31) // 30.5 → round, não floor
  })
})

describe('eligibleLenders ⟺ proposeLoan', () => {
  const emDivida = (over: Partial<GameState> = {}): GameState => {
    const g = createSeedState(['p1', 'p2', 'p3'])
    g.players[0].cash = 100
    g.resolution = { kind: 'debt', amount: 400, creditorId: null } as GameState['resolution']
    return { ...g, ...over }
  }

  it('lista exatamente quem o comando aceitaria', () => {
    const g = emDivida()
    const lenders = eligibleLenders(g)
    expect(lenders).toEqual(['p2', 'p3'])
    for (const id of lenders) expect(proposeLoan(g, 'p1', id)).not.toBe(g)
  })

  it('nunca inclui o próprio devedor', () => {
    expect(eligibleLenders(emDivida())).not.toContain('p1')
  })

  it('exclui quem não cobre o déficit', () => {
    const g = emDivida()
    g.players[1].cash = 10 // p2 não cobre os 300 faltantes
    expect(eligibleLenders(g)).toEqual(['p3'])
  })

  it('exclui eliminados', () => {
    const g = emDivida()
    g.players[2].eliminated = true
    expect(eligibleLenders(g)).toEqual(['p2'])
  })

  it('PAUSADO, ninguém é elegível — guarda que o HUD não tinha', () => {
    expect(eligibleLenders(emDivida({ paused: true }))).toEqual([])
  })

  it('fora da janela de dívida, ninguém é elegível', () => {
    const g = emDivida()
    g.resolution = null
    expect(eligibleLenders(g)).toEqual([])
  })

  it('com empréstimo ativo, ninguém é elegível (máx. 1 por devedor, §15.3)', () => {
    const g = emDivida()
    g.loans.push({ debtorId: 'p1', creditorId: 'p2', principal: 100, ratePct: 20 })
    expect(eligibleLenders(g)).toEqual([])
  })

  it('loanShortfall é o déficit, e 0 fora da janela', () => {
    expect(loanShortfall(emDivida())).toBe(300)
    const g = emDivida()
    g.resolution = null
    expect(loanShortfall(g)).toBe(0)
  })
})
