// @vitest-environment jsdom
// EndGameScreen (044, T012/T014) — consome `matchSummary(game)` puro e nunca inventa o que
// o estado não registrou. Estilo de teste segue o padrão de componente da 042
// (tests/ui/errorBoundaries): pragma jsdom na 1ª linha, @testing-library/react.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { EndGameScreen } from '@/game/ui/EndGameScreen'
import { createSeedState } from '@/game/setup'
import type { GameState } from '@/game/turn/types'

function seed(playerCount: number): GameState {
  const ids = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`)
  return createSeedState(ids)
}

// Sem sala registrada, `PlayerName` cai no rótulo padrão `Jogador N` (net/identity.ts) —
// nunca o id técnico `p1..pN`. É o texto estável que os testes abaixo procuram.
function playerLabel(id: string): string {
  const n = Number.parseInt(id.replace(/^p/, ''), 10)
  return `Jogador ${n}`
}

function tbodyRows(): HTMLTableRowElement[] {
  const table = screen.getByRole('table')
  return within(table).getAllByRole('row').slice(1) as HTMLTableRowElement[] // pula o cabeçalho
}

afterEach(() => {
  cleanup()
})

describe('EndGameScreen (T014)', () => {
  it('mesa de 3 com duas falências: três linhas, na ordem inversa de eliminação', () => {
    const g = seed(3)
    g.players[0].eliminated = true // p1
    g.players[2].eliminated = true // p3
    g.eliminationOrder = [
      { playerId: 'p3', round: 2 }, // caiu primeiro
      { playerId: 'p1', round: 5 }, // caiu depois
    ]
    g.phase = 'ended'

    render(<EndGameScreen game={g} online={false} onExit={() => {}} />)

    const rows = tbodyRows()
    expect(rows).toHaveLength(3)
    // p2 (vencedor) em 1º, p1 (caiu por último) em 2º, p3 (caiu primeiro) em 3º.
    expect(within(rows[0]).getByText(playerLabel('p2'))).toBeTruthy()
    expect(within(rows[1]).getByText(playerLabel('p1'))).toBeTruthy()
    expect(within(rows[2]).getByText(playerLabel('p3'))).toBeTruthy()
  })

  it('vencedor aparece em 1º, no cabeçalho e na primeira linha da tabela', () => {
    const g = seed(2)
    g.players[0].eliminated = true
    g.eliminationOrder = [{ playerId: 'p1', round: 3 }]
    g.phase = 'ended'

    render(<EndGameScreen game={g} online={false} onExit={() => {}} />)

    expect(screen.getByText('VENCEDOR')).toBeTruthy()
    const rows = tbodyRows()
    expect(within(rows[0]).getByText(playerLabel('p2'))).toBeTruthy()
    expect(within(rows[0]).getByText('1º')).toBeTruthy()
  })

  it('apresenta o vencedor como foco e identifica a classificação final', () => {
    const g = seed(2)
    g.players[0].eliminated = true
    g.eliminationOrder = [{ playerId: 'p1', round: 3 }]
    g.phase = 'ended'

    render(<EndGameScreen game={g} online={false} onExit={() => {}} />)

    expect(screen.getByText('PARTIDA ENCERRADA')).toBeTruthy()
    expect(screen.getByRole('heading', { name: playerLabel('p2') })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Classificação final' })).toBeTruthy()
  })

  it('em sala online oferece voltar à própria sala, não ao início do app', () => {
    const g = seed(2)
    g.players[0].eliminated = true
    g.eliminationOrder = [{ playerId: 'p1', round: 3 }]
    g.phase = 'ended'
    const onExit = vi.fn()

    render(<EndGameScreen game={g} online onExit={onExit} />)

    fireEvent.click(screen.getByRole('button', { name: 'Voltar à sala' }))
    expect(onExit).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Voltar ao início' })).toBeNull()
  })

  it('eliminado mostra a rodada em que caiu', () => {
    const g = seed(3)
    g.players[0].eliminated = true
    g.players[2].eliminated = true
    g.eliminationOrder = [
      { playerId: 'p3', round: 2 },
      { playerId: 'p1', round: 7 },
    ]
    g.phase = 'ended'

    render(<EndGameScreen game={g} online={false} onExit={() => {}} />)

    const rows = tbodyRows()
    const p1Row = rows.find((r) => within(r).queryByText(playerLabel('p1')))!
    const p3Row = rows.find((r) => within(r).queryByText(playerLabel('p3')))!
    expect(within(p1Row).getByText('7')).toBeTruthy()
    expect(within(p3Row).getByText('2')).toBeTruthy()
  })

  it('partial: mostra o aviso e agrupa quem não tem registro, sem inventar posição', () => {
    const g = seed(3)
    g.players[0].eliminated = true // p1 — SEM registro (snapshot legado)
    g.players[2].eliminated = true // p3 — COM registro
    g.eliminationOrder = [{ playerId: 'p3', round: 2 }]
    g.phase = 'ended'

    render(<EndGameScreen game={g} online={false} onExit={() => {}} />)

    // O aviso de classificação parcial aparece.
    expect(screen.getByText(/gravação anterior a este recurso/i)).toBeTruthy()
    expect(screen.getByText('Sem posição confirmada')).toBeTruthy()

    // p1 (sem registro) fica fora da tabela principal, sem "Nº" de posição — só
    // aparece na lista "sem posição confirmada".
    const rows = tbodyRows()
    expect(rows.find((r) => within(r).queryByText(playerLabel('p1')))).toBeUndefined()

    // p3 (com registro) segue confirmado na tabela, com a rodada da queda.
    const p3Row = rows.find((r) => within(r).queryByText(playerLabel('p3')))!
    expect(within(p3Row).getByText('2')).toBeTruthy()

    // p1 aparece agrupado, mas nenhum número de posição (Nº) é atribuído a ele.
    const unconfirmedItem = screen.getByText(playerLabel('p1')).closest('li')!
    expect(within(unconfirmedItem).queryByText(/^\d+º$/)).toBeNull()
  })

  it('duração ausente aparece como indisponível — nunca "0ms" nem "0 min"', () => {
    const g = seed(2)
    g.players[0].eliminated = true
    g.eliminationOrder = [{ playerId: 'p1', round: 1 }]
    g.phase = 'ended'
    g.round = 4
    g.startedAt = 0 // sem relógio → durationMs null (data-model §1)
    g.endedAt = 999_999

    render(<EndGameScreen game={g} online={false} onExit={() => {}} />)

    expect(screen.getByText(/duração indisponível/i)).toBeTruthy()
    expect(screen.queryByText(/0\s*ms/i)).toBeNull()
    expect(screen.queryByText(/0\s*min/i)).toBeNull()
  })
})
