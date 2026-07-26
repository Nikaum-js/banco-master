// Card 4 do review de arquitetura: o `DiceArena` tinha 17 assinaturas do store numa
// função — cinco delas cópias da mesma expressão com um campo final diferente — e cinco
// booleanos de decisão de turno, incluindo uma cópia à mão da fórmula de preço do motor.
// `HANDOVER.md:59` registra que esse bloco JÁ enviou um bug de multiplayer para produção
// (o botão "Rolar dados" sem gate de perspectiva). Zero testes. Estes são os primeiros.
import { describe, expect, it } from 'vitest'
import { diceArenaView } from '@/game/ui/panels/diceArenaView'
import { createSeedState } from '@/game/setup'
import { localView } from '@/net/localView'
import type { GameState } from '@/game/turn/types'
import type { LocalView } from '@/net/localView'
import { pausedBy } from '../../net/harness'

// Sem sala: cliente único, todos os assentos são deste dispositivo (FR-029).
const soloView = (g: GameState): LocalView => localView(g, null, null)

// Com sala: `uid` decide de quem é a perspectiva.
function seatedView(g: GameState, playerId: string): LocalView {
  const room = {
    id: 'r', status: 'playing' as const,
    seats: g.players.map((p, i) => ({
      uid: `tok-${p.id}`, playerId: p.id, name: `P${i + 1}`, color: '#fff', connected: true, isHost: i === 0, reentryCode: '',
    })),
  }
  return localView(g, room, `tok-${playerId}`)
}

const base = (): GameState => createSeedState(['p1', 'p2'])

describe('diceArenaView — rolar', () => {
  it('o ator pode rolar no início do turno', () => {
    const g = base()
    const v = diceArenaView(g, soloView(g))
    expect(v.canRoll).toBe(true)
    expect(v.status).toBe('Sua vez')
  })

  it('a animação do dado bloqueia o clique duplo', () => {
    const g = base()
    expect(diceArenaView(g, soloView(g), { rolling: true }).canRoll).toBe(false)
  })

  it('PAUSADO ninguém rola (FR-011)', () => {
    const g = { ...base(), paused: pausedBy('disconnect') }
    expect(diceArenaView(g, soloView(g)).canRoll).toBe(false)
  })

  it('quem não é o ator não vê o botão — o bug de perspectiva que a 038 corrigiu', () => {
    const g = base()
    const outro = g.players[g.turnOrder[g.activeSeat]].id === 'p1' ? 'p2' : 'p1'
    const v = diceArenaView(g, seatedView(g, outro), { activeName: 'Ana' })
    expect(v.canRoll).toBe(false)
    expect(v.status).toBe('Vez de Ana')
  })

  it('fim de jogo encerra a arena', () => {
    const g = { ...base(), phase: 'ended' as const }
    const v = diceArenaView(g, soloView(g))
    expect(v.canRoll).toBe(false)
    expect(v.status).toBe('Fim de jogo')
  })
})

describe('diceArenaView — dados e dupla', () => {
  it('sem rolagem, mostra 1 e 1', () => {
    const g = base()
    expect(diceArenaView(g, soloView(g)).dice).toEqual([1, 1])
    expect(diceArenaView(g, soloView(g)).speed).toBeNull()
  })

  it('reflete a última rolagem', () => {
    const g = base()
    g.turn.lastRoll = { white: [4, 6], speed: null, isDouble: false, move: 10, special: null }
    expect(diceArenaView(g, soloView(g)).dice).toEqual([4, 6])
  })

  it('dupla pendente destaca o rótulo', () => {
    const g = base()
    g.turn.consecutiveDoubles = 1
    const v = diceArenaView(g, soloView(g))
    expect(v.isDoubleReroll).toBe(true)
    expect(v.status).toBe('Dupla! Role de novo')
  })
})

describe('diceArenaView — compra inline', () => {
  const emCompra = (discount = 0): GameState => {
    const g = base()
    g.players[0].nextPurchaseDiscount = discount
    g.turn.state = 'casa-a-resolver'
    g.resolution = { kind: 'purchase', pos: 1 } as GameState['resolution']
    return g
  }

  it('sem compra pendente, não há bloco de compra', () => {
    const g = base()
    expect(diceArenaView(g, soloView(g)).purchase).toBeNull()
  })

  it('o preço vem do MOTOR — não é um espelho da fórmula', () => {
    const g = emCompra()
    const p = diceArenaView(g, soloView(g)).purchase!
    expect(p.price).toBe(p.listPrice)
    expect(p.discounted).toBe(false)
  })

  it('Investidor Anjo (006) baixa o preço e marca o desconto', () => {
    const g = emCompra(0.5)
    const p = diceArenaView(g, soloView(g)).purchase!
    expect(p.price).toBeLessThan(p.listPrice)
    expect(p.discounted).toBe(true)
  })

  it('sem caixa, o botão fica desabilitado (FR-004)', () => {
    const g = emCompra()
    g.players[0].cash = 0
    expect(diceArenaView(g, soloView(g)).purchase!.affordable).toBe(false)
  })
})

describe('diceArenaView — prisão', () => {
  it('mostra a tentativa e o valor do TEMA, não um literal', () => {
    const g = base()
    g.turn.state = 'prisao-decisao'
    g.players[0].jail = { inJail: true, attempts: 1 }
    const v = diceArenaView(g, soloView(g))
    expect(v.status).toBe('Preso · tentativa 2/3')
    expect(v.canJailDecide).toBe(true)
    expect(v.jailFine).toBe(50)
    expect(v.canPayJailFine).toBe(true)
  })

  it('sem caixa para a fiança, o botão de pagar cai', () => {
    const g = base()
    g.turn.state = 'prisao-decisao'
    g.players[0].cash = 10
    expect(diceArenaView(g, soloView(g)).canPayJailFine).toBe(false)
  })
})

describe('diceArenaView — finalizar e Bus Ticket', () => {
  it('finaliza no fim do turno', () => {
    const g = base()
    g.turn.state = 'aguardando-finalizacao'
    expect(diceArenaView(g, soloView(g)).canFinalize).toBe(true)
  })

  it('sem ticket, não oferece o ônibus', () => {
    expect(diceArenaView(base(), soloView(base())).canBus).toBe(false)
  })

  it('com ticket e fora do canto, oferece — e a animação segura', () => {
    const g = base()
    g.players[0].busTickets = 1
    g.players[0].pos = 3
    expect(diceArenaView(g, soloView(g)).canBus).toBe(true)
    expect(diceArenaView(g, soloView(g), { rolling: true }).canBus).toBe(false)
  })
})
