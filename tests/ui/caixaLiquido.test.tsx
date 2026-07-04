// @vitest-environment jsdom
/**
 * CARD 06 — caixa líquido durante dívida (§12.3, D-061).
 *
 * O modelo econômico NÃO muda: `player.cash` continua nunca ficando negativo no estado (§9.1, e
 * o invariante (a) da simulação passou a exigir isso incondicionalmente). O negativo é uma
 * LEITURA — caixa menos obrigação — e por isso vive no view-model, não no motor.
 */
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createSeedState } from '@/game/setup'
import { playersView } from '@/game/ui/panels/playersView'
import { PlayersPanel } from '@/boards/shared'
import { useGameStore } from '@/game/store'
import type { GameState } from '@/game/turn/types'

function comDivida(amount: number, cash: number, devedor = 'p2'): GameState {
  const g = createSeedState(['p1', 'p2'])
  g.players[1].cash = cash
  g.resolution = { kind: 'debt', amount, creditorId: 'p1', debtorId: devedor, cause: 'obligation' }
  return g
}

describe('CARD 06 — view-model do caixa líquido', () => {
  it('sem dívida, líquido é o caixa e nada é devido', () => {
    const view = playersView(createSeedState(['p1', 'p2']))
    expect(view.map((p) => ({ owed: p.owed, net: p.net, money: p.money }))).toEqual([
      { owed: 0, net: 2_000, money: 2_000 },
      { owed: 0, net: 2_000, money: 2_000 },
    ])
  })

  it('com dívida maior que o caixa, o líquido fica NEGATIVO — e o caixa no estado, não', () => {
    const g = comDivida(900, 300)
    const view = playersView(g)

    expect(view[1]).toMatchObject({ money: 300, owed: 900, net: -600 })
    expect(g.players[1].cash).toBe(300) // o estado nunca fica negativo
  })

  it('soma o slot de dívida E a fila de obrigações — o total é um número só', () => {
    const g = comDivida(100, 50)
    g.obligations = [{ debtorId: 'p2', creditorId: 'p1', amount: 25, cause: 'obligation' }]

    expect(playersView(g)[1]).toMatchObject({ owed: 125, net: -75 })
  })

  it('a dívida é atribuída ao DEVEDOR nomeado, não ao jogador da vez (D-061)', () => {
    const g = comDivida(900, 300, 'p2')
    const view = playersView(g)

    expect(view[0].owed).toBe(0) // p1 é o da vez, e não deve nada
    expect(view[1].owed).toBe(900)
  })

  it('dívida sem `debtorId` (snapshot antigo) cai no jogador da vez — a semântica implícita', () => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].cash = 100
    g.resolution = { kind: 'debt', amount: 400, creditorId: 'p2' } // sem debtorId

    expect(playersView(g)[0]).toMatchObject({ owed: 400, net: -300 })
  })
})

describe('CARD 06 — apresentação: negativo em vermelho E em texto (§12.6)', () => {
  afterEach(cleanup)

  function montar(g: GameState) {
    useGameStore.setState({ game: g })
    return render(<PlayersPanel />)
  }

  it('mostra o líquido negativo e diz quanto FALTA — nunca só a cor', () => {
    montar(comDivida(900, 300))

    // O líquido, e não o caixa bruto.
    expect(screen.getByText('-600')).toBeTruthy()
    // O rótulo muda para não deixar dúvida sobre qual número é aquele.
    expect(screen.getAllByText('Caixa líquido').length).toBeGreaterThan(0)
    // E o texto diz o que falta: acessível sem depender de percepção de cor.
    expect(screen.getByText(/falta/i)).toBeTruthy()
  })

  it('ADVERSÁRIOS também veem que há dívida em resolução, e de quem', () => {
    const g = comDivida(900, 300)
    montar(g)

    // A linha de p2 carrega a marca de dívida; a de p1 não. É isso que permite à mesa entender
    // que alguém está em cobrança sem depender da faixa, que é só do devedor.
    const linhas = document.querySelectorAll('.player-row')
    const comDebito = document.querySelectorAll('.player-row__money--debt')
    expect(linhas.length).toBe(2)
    expect(comDebito.length).toBe(1)
  })

  it('devendo menos do que tem: líquido positivo, mas a pendência continua visível', () => {
    montar(comDivida(200, 900))

    expect(screen.getByText('700')).toBeTruthy()
    expect(screen.getByText(/deve/i)).toBeTruthy()
    expect(document.querySelectorAll('.player-row__money--negative').length).toBe(0)
  })

  it('sem dívida, a apresentação não muda em nada (rótulo "Caixa", sem linha extra)', () => {
    montar(createSeedState(['p1', 'p2']))

    expect(screen.getAllByText('Caixa').length).toBe(2)
    expect(document.querySelectorAll('.player-row__owed').length).toBe(0)
    expect(document.querySelectorAll('.player-row__money--negative').length).toBe(0)
  })
})
