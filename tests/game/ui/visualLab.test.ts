import { afterEach, describe, expect, it } from 'vitest'
import { useGameStore } from '@/game/store'
import { useBusTicketUI } from '@/game/ui/busTicketUI'
import { useHandCardUI } from '@/game/ui/cards/handCardUI'
import { useTradeUI } from '@/game/ui/trade/tradeUI'
import {
  prepareVisualLabCase,
  VISUAL_LAB_CASES,
  type VisualLabCaseId,
} from '@/game/ui/lab/cases'

const originalGame = useGameStore.getState().game

afterEach(() => {
  useGameStore.setState({ game: originalGame })
  useBusTicketUI.setState({ armed: false, boarding: false })
  useHandCardUI.setState({ cardId: null })
  useTradeUI.setState({ open: false, selectedProposalId: null })
})

describe('VisualLab', () => {
  it('mantém ids únicos e cobre os casos visuais críticos', () => {
    const ids = VISUAL_LAB_CASES.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining([
      'bus-ticket',
      'trade-compose',
      'estate-auction',
      'debt-short',
      'property-houses',
      'endgame',
    ] satisfies VisualLabCaseId[]))
  })

  it('arma o seletor real de Bus Ticket', () => {
    prepareVisualLabCase('bus-ticket')

    expect(useBusTicketUI.getState().armed).toBe(true)
    expect(useGameStore.getState().game.players[0].busTickets).toBeGreaterThan(0)
  })

  it('monta a variação vendável com duas casas', () => {
    prepareVisualLabCase('property-houses')

    const title = useGameStore.getState().game.titles[1]
    expect(title.ownerId).toBe('p1')
    expect(title.houses).toBe(2)
    expect(title.mortgaged).toBe(false)
  })

  it('expõe propostas recebidas válidas e inválidas', () => {
    prepareVisualLabCase('trade-received')
    expect(useGameStore.getState().game.tradeProposals[0]?.trade.fromProps).toEqual([1, 3])

    prepareVisualLabCase('trade-invalid')
    expect(useGameStore.getState().game.tradeProposals[0]?.trade.fromProps).toEqual([13])
  })
})
