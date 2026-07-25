// Card 4 do review de arquitetura: a precedência das cinco telas do HUD era a ORDEM DOS
// `return` no corpo de `GameHUD` — regra de apresentação codificada como ordem de
// statement, invisível para quem for adicionar a sexta e impossível de testar.
import { describe, expect, it } from 'vitest'
import { activeHudView, hudWaitingFor, HUD_ACTION } from '@/game/ui/panels/activeHudView'
import { createSeedState } from '@/game/setup'
import type { GameState } from '@/game/turn/types'

const base = (): GameState => createSeedState(['p1', 'p2', 'p3'])

const debt = (amount = 300): GameState['resolution'] =>
  ({ kind: 'debt', amount, creditorId: 'p2' }) as GameState['resolution']

const diplomacia = (): GameState['resolution'] =>
  ({ kind: 'reaction-diplomacia', reactorId: 'p2', attackerId: 'p1', effect: 'Aquisição Hostil', cardId: 'c1', deck: 'acaso', targetPos: 5 }) as GameState['resolution']

const bunker = (): GameState['resolution'] =>
  ({ kind: 'reaction-bunker', reactorId: 'p2', amount: 200 }) as GameState['resolution']

describe('activeHudView — nenhuma tela', () => {
  it('partida limpa não abre HUD algum', () => {
    expect(activeHudView(base())).toBeNull()
  })

  it('resolução de compra é do ModalLayer, não do HUD', () => {
    const g = base()
    g.resolution = { kind: 'purchase', pos: 1 } as GameState['resolution']
    expect(activeHudView(g)).toBeNull()
  })
})

describe('activeHudView — precedência', () => {
  it('fim de jogo vence TUDO', () => {
    const g = base()
    g.phase = 'ended'
    g.players[1].eliminated = true
    g.players[2].eliminated = true
    g.pendingLoan = { debtorId: 'p1', creditorId: 'p2', principal: 100 }
    g.resolution = debt()
    const v = activeHudView(g)
    expect(v?.kind).toBe('winner')
    expect(v).toMatchObject({ winnerId: 'p1' })
  })

  it('pedido de empréstimo vence reação e dívida', () => {
    const g = base()
    g.pendingLoan = { debtorId: 'p1', creditorId: 'p2', principal: 100 }
    g.resolution = diplomacia()
    expect(activeHudView(g)?.kind).toBe('loan-request')
  })

  it('reação vence dívida — a carta pode cancelar o que geraria a cobrança (D-013)', () => {
    const g = base()
    g.resolution = diplomacia()
    expect(activeHudView(g)?.kind).toBe('reaction-diplomacia')
  })

  it('dívida é a última', () => {
    const g = base()
    g.resolution = debt()
    expect(activeHudView(g)).toMatchObject({ kind: 'debt', debtorId: 'p1', amount: 300, creditorId: 'p2' })
  })
})

describe('activeHudView — carga de cada tela', () => {
  it('diplomacia carrega reator, atacante e efeito', () => {
    const g = base()
    g.resolution = diplomacia()
    expect(activeHudView(g)).toMatchObject({ reactorId: 'p2', attackerId: 'p1', effect: 'Aquisição Hostil' })
  })

  it('bunker carrega reator e valor', () => {
    const g = base()
    g.resolution = bunker()
    expect(activeHudView(g)).toMatchObject({ kind: 'reaction-bunker', reactorId: 'p2', amount: 200 })
  })

  it('vencedor é null se, por algum motivo, não sobrou ninguém', () => {
    const g = base()
    g.phase = 'ended'
    for (const p of g.players) p.eliminated = true
    expect(activeHudView(g)).toMatchObject({ kind: 'winner', winnerId: null })
  })
})

describe('hudWaitingFor — de quem o HUD espera', () => {
  it('empréstimo espera o CREDOR', () => {
    const g = base()
    g.pendingLoan = { debtorId: 'p1', creditorId: 'p3', principal: 100 }
    expect(hudWaitingFor(activeHudView(g)!, g)).toBe('p3')
  })

  it('reação espera o REATOR', () => {
    const g = base()
    g.resolution = bunker()
    expect(hudWaitingFor(activeHudView(g)!, g)).toBe('p2')
  })

  it('dívida espera o DEVEDOR', () => {
    const g = base()
    g.resolution = debt()
    expect(hudWaitingFor(activeHudView(g)!, g)).toBe('p1')
  })

  it('vitória não espera ninguém', () => {
    const g = base()
    g.phase = 'ended'
    expect(hudWaitingFor(activeHudView(g)!, g)).toBeNull()
  })
})

describe('HUD_ACTION', () => {
  it('cada tela declara o comando que pede — exaustivo por tipo', () => {
    expect(HUD_ACTION['loan-request']).toBe('respond-loan')
    expect(HUD_ACTION['reaction-diplomacia']).toBe('respond-reaction')
    expect(HUD_ACTION['reaction-bunker']).toBe('respond-reaction')
    expect(HUD_ACTION.debt).toBe('pay-debt')
  })
})
