// @vitest-environment jsdom
// 058/US8 — cue de abertura da negociação.
//
// As três propriedades que a spec exige (FR-044/FR-045) não são de pintura: uma vez por
// abertura, zero em re-render, zero em reconexão/replay. Elas caem naturalmente de o
// gatilho ser um booleano de UI LOCAL, e não o `GameState` — e é isso que o teste fixa,
// para que ninguém "melhore" o disparo movendo-o para o estado da partida.
import { act } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const played: string[] = []
vi.mock('@/game/ui/sound/engine', () => ({
  play: (cue: string) => { played.push(cue) },
  setMasterGain: () => {},
  ensureUnlockListener: () => {},
}))

const { TradeLayer } = await import('@/game/ui/trade/TradeLayer')
const { useTradeUI } = await import('@/game/ui/trade/tradeUI')
const { useGameStore } = await import('@/game/store')
const { createSeedState } = await import('@/game/setup')
const { CUE_SRC } = await import('@/game/ui/sound/cues')

beforeEach(() => {
  played.length = 0
  useTradeUI.setState({ open: false, selectedProposalId: null })
  act(() => useGameStore.setState({ game: createSeedState(['p1', 'p2']) }))
})

afterEach(() => {
  cleanup()
  useTradeUI.setState({ open: false, selectedProposalId: null })
})

describe('cue de abertura da negociação (058/US8)', () => {
  it('o asset está mapeado no catálogo de cues', () => {
    // O auto-mapa de `cues.ts` resolve `trade-open.<ext>` sozinho; se o arquivo sumir do
    // diretório de assets, o cue fica silencioso e este teste avisa.
    expect(CUE_SRC['trade-open']).toBeTruthy()
  })

  it('toca UMA vez ao abrir', () => {
    const { rerender } = render(<TradeLayer />)
    expect(played).toEqual([])

    act(() => useTradeUI.setState({ open: true }))
    rerender(<TradeLayer />)
    expect(played.filter((c) => c === 'trade-open')).toHaveLength(1)
  })

  it('NÃO toca de novo em re-render com a negociação já aberta', () => {
    const { rerender } = render(<TradeLayer />)
    act(() => useTradeUI.setState({ open: true }))
    rerender(<TradeLayer />)
    rerender(<TradeLayer />)
    act(() => useGameStore.setState({ game: createSeedState(['p1', 'p2', 'p3']) })) // difusão nova
    rerender(<TradeLayer />)
    expect(played.filter((c) => c === 'trade-open')).toHaveLength(1)
  })

  it('NÃO toca quando o estado da partida chega sem abertura (reconexão/replay)', () => {
    render(<TradeLayer />)
    for (let i = 0; i < 5; i++) {
      act(() => useGameStore.setState({ game: createSeedState(['p1', 'p2']) }))
    }
    expect(played).toEqual([])
  })

  it('toca de novo numa abertura POSTERIOR — é por abertura, não por sessão', () => {
    const { rerender } = render(<TradeLayer />)
    act(() => useTradeUI.setState({ open: true }))
    rerender(<TradeLayer />)
    act(() => useTradeUI.setState({ open: false }))
    rerender(<TradeLayer />)
    act(() => useTradeUI.setState({ open: true }))
    rerender(<TradeLayer />)
    expect(played.filter((c) => c === 'trade-open')).toHaveLength(2)
  })

  it('abrir uma PROPOSTA RECEBIDA não dispara o cue de abertura de compositor', () => {
    const game = createSeedState(['p1', 'p2'])
    game.tradeProposals = [{ id: 1, trade: { fromId: 'p1', toId: 'p2', fromProps: [], fromCash: 0, toProps: [], toCash: 0 } }]
    act(() => useGameStore.setState({ game }))
    const { rerender } = render(<TradeLayer />)
    act(() => useTradeUI.setState({ open: false, selectedProposalId: 1 }))
    rerender(<TradeLayer />)
    expect(played).toEqual([])
  })
})
