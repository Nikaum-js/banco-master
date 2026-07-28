import { describe, expect, it } from 'vitest'
import { createSeedState } from '@/game/setup'
import {
  createTradeDraft,
  projectTradeDraft,
  updateTradeDraft,
  type TradeDraft,
  type TradeDraftAction,
} from '@/game/ui/trade/draft'

function fixture() {
  const game = createSeedState(['p1', 'p2', 'p3'])
  game.titles[1].ownerId = 'p1'
  game.titles[3].ownerId = 'p2'
  game.titles[6].ownerId = 'p3'
  game.players[0].busTickets = 2
  game.players[1].busTickets = 1
  game.immunities.push({ beneficiaryId: 'p1', pos: 3, lapsRemaining: 2, granterId: 'p2' })
  return game
}

function apply(game: ReturnType<typeof fixture>, draft: TradeDraft, action: TradeDraftAction) {
  return updateTradeDraft(game, draft, action)
}

describe('trade draft', () => {
  it('compõe uma proposta válida por transições e projeta a elegibilidade', () => {
    const game = fixture()
    let draft = createTradeDraft(game, 'p1')

    draft = apply(game, draft, { kind: 'toggle-property', party: 'from', pos: 1 })
    draft = apply(game, draft, { kind: 'set-cash', party: 'to', amount: 120 })
    draft = apply(game, draft, { kind: 'set-tickets', party: 'from', amount: 1 })

    expect(projectTradeDraft(game, draft)).toMatchObject({
      recipient: { id: 'p2' },
      canPropose: true,
      trade: {
        fromId: 'p1',
        toId: 'p2',
        fromProps: [1],
        toCash: 120,
        fromBusTickets: 1,
      },
    })
  })

  it('limita valores aos recursos do jogador dentro do módulo', () => {
    const game = fixture()
    let draft = createTradeDraft(game, 'p1')

    draft = apply(game, draft, { kind: 'set-cash', party: 'from', amount: game.players[0].cash + 999 })
    draft = apply(game, draft, { kind: 'set-tickets', party: 'from', amount: 99 })

    expect(draft.from.cash).toBe(game.players[0].cash)
    expect(draft.from.tickets).toBe(2)
  })

  it('reseta todos os termos do destinatário quando ele muda', () => {
    const game = fixture()
    let draft = createTradeDraft(game, 'p1')

    draft = apply(game, draft, { kind: 'toggle-property', party: 'to', pos: 3 })
    draft = apply(game, draft, { kind: 'set-cash', party: 'to', amount: 80 })
    draft = apply(game, draft, { kind: 'set-tickets', party: 'to', amount: 1 })
    draft = apply(game, draft, { kind: 'pick-recipient', toId: 'p3' })

    expect(draft.toId).toBe('p3')
    expect(draft.to).toEqual({ props: new Set(), cash: 0, tickets: 0, grants: {}, transfers: new Set() })
  })

  it('mantém concessão de imunidade incompatível fora do draft ao ceder o título', () => {
    const game = fixture()
    let draft = createTradeDraft(game, 'p1')

    draft = apply(game, draft, { kind: 'toggle-grant', party: 'from', pos: 1 })
    expect(draft.from.grants[1]).toBe(2)
    draft = apply(game, draft, { kind: 'toggle-property', party: 'from', pos: 1 })

    expect(draft.from.grants).toEqual({})
    expect(projectTradeDraft(game, draft).trade.fromImmunities).toEqual([])
  })

  it('aceita apenas transferências de imunidade realmente possuídas', () => {
    const game = fixture()
    let draft = createTradeDraft(game, 'p1')

    draft = apply(game, draft, { kind: 'toggle-transfer', party: 'from', pos: 1 })
    expect(draft.from.transfers).toEqual(new Set())
    draft = apply(game, draft, { kind: 'toggle-transfer', party: 'from', pos: 3 })

    expect(draft.from.transfers).toEqual(new Set([3]))
    expect(projectTradeDraft(game, draft).canPropose).toBe(true)
  })
})
