// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { RoomMatchHistoryEntry } from '@/net/roomHistory'
import { RoomHistoryPanel } from '@/net/ui/RoomHistoryPanel'

function entry(generation: number, players = 2): RoomMatchHistoryEntry {
  return {
    generation,
    endedAt: 1_753_881_600_000 + generation * 60_000,
    durationMs: 3_600_000 + generation * 1_000,
    rounds: 12 + generation,
    standings: Array.from({ length: players }, (_, index) => ({
      historyId: `hist-${index}`,
      playerId: `p${index + 1}`,
      name: `Jogador ${index + 1}`,
      color: ['#d9a650', '#3b8bd0', '#36dde7', '#00bca5', '#e77376', '#7b9d41', '#b665a2', '#b0a5ff'][index],
      avatar: 'classic-alive',
      skin: 'careca',
      rank: index + 1,
      netWorth: 5_000 - index * 500 + generation,
      properties: Math.max(0, 5 - index),
      eliminatedAtRound: index === 0 ? null : 10 + index,
    })),
  }
}

afterEach(cleanup)

describe('painel do histórico da sala', () => {
  it('mantém o estado vazio discreto dentro do disclosure', () => {
    render(<RoomHistoryPanel history={[]} />)

    expect(screen.getByText('Histórico da sala')).toBeTruthy()
    fireEvent.click(screen.getByText('Histórico da sala'))
    expect(screen.getByText(/a primeira partida finalizada aparecerá aqui/i)).toBeTruthy()
  })

  it('mostra estatísticas derivadas e classificação das partidas', () => {
    render(<RoomHistoryPanel history={[entry(0), entry(1)]} />)
    fireEvent.click(screen.getByText('Histórico da sala'))

    expect(screen.getByText('2 partidas')).toBeTruthy()
    expect(screen.getByText('Duração média')).toBeTruthy()
    expect(screen.getByText('Média de rodadas')).toBeTruthy()
    expect(screen.getAllByText('Jogador 1').length).toBeGreaterThan(0)
    expect(screen.getByText((_text, element) => element?.tagName === 'SMALL' && element.textContent?.startsWith('2 vitórias') === true)).toBeTruthy()
    expect(screen.getAllByRole('table')).toHaveLength(2)
  })

  it('permanece navegável com 8 jogadores e 10 partidas', () => {
    const history = Array.from({ length: 10 }, (_, generation) => entry(generation, 8))
    render(<RoomHistoryPanel history={history} />)
    const disclosure = screen.getByText('Histórico da sala')
    disclosure.focus()
    fireEvent.keyDown(disclosure, { key: 'Enter' })
    fireEvent.click(disclosure)

    expect(screen.getByText('10 partidas')).toBeTruthy()
    expect(screen.getAllByRole('table')).toHaveLength(10)
    expect(screen.getAllByText('Jogador 8').length).toBeGreaterThan(0)
  })
})
