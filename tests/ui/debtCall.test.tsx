// @vitest-environment jsdom
// Faixa de cobrança (050, US4 / D-056). O que estes casos protegem não é aparência: é a
// promessa de que a cobrança deixou de esconder o tabuleiro e passou a dizer, na tela, se
// ainda existe saída.
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GameHUD } from '@/game/ui/GameHUD'
import { createSeedState } from '@/game/setup'
import { useGameStore } from '@/game/store'
import { useRoomStore } from '@/net/roomStore'
import type { GameState } from '@/game/turn/types'

afterEach(() => {
  cleanup()
  useRoomStore.getState().reset()
})

// p1 (jogador ativo) deve `amount` a p2, com o caixa e os títulos que o caso pedir.
function withDebt(amount: number, cash: number, ownedByDebtor: number[] = []): GameState {
  const game = createSeedState(['p1', 'p2', 'p3'])
  game.turn.state = 'casa-a-resolver'
  game.turn.pendingResolve = true
  game.resolution = { kind: 'debt', amount, creditorId: 'p2' }
  game.players[0].cash = cash
  for (const pos of ownedByDebtor) game.titles[pos].ownerId = 'p1'
  return game
}

function renderDebt(game: GameState) {
  useGameStore.setState({ game })
  return render(<GameHUD />)
}

describe('Faixa de cobrança — forma (FR-019/FR-020/FR-024)', () => {
  it('renderiza a faixa, e não um cartão modal', () => {
    const { container } = renderDebt(withDebt(500, 200))
    expect(container.querySelector('.debt-dock')).not.toBeNull()
    // Nenhum diálogo: sem backdrop bloqueante, sem captura de foco — o tabuleiro
    // precisa continuar alcançável para hipotecar e vender.
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(container.querySelector('[aria-modal="true"]')).toBeNull()
  })

  it('FR-025: Esc não fecha a cobrança', () => {
    const { container } = renderDebt(withDebt(500, 200))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(container.querySelector('.debt-dock')).not.toBeNull()
  })

  it('FR-026: a faixa é uma região nomeada', () => {
    renderDebt(withDebt(500, 200))
    expect(screen.getByRole('region', { name: /cobrança de dívida/i })).toBeTruthy()
  })
})

describe('Faixa de cobrança — os cinco números (FR-021/FR-022)', () => {
  it('mostra credor, valor, caixa, quanto falta e quanto ainda dá para levantar', () => {
    // p1 deve 500, tem 200 em caixa e Roma ($60, hipoteca $30) → levanta até 230.
    const { container } = renderDebt(withDebt(500, 200, [1]))
    const dock = container.querySelector('.debt-dock')!
    expect(dock.textContent).toContain('Você deve a')
    expect(dock.textContent).toContain('500')
    expect(dock.textContent).toContain('Caixa')
    expect(dock.textContent).toContain('200')
    expect(dock.textContent).toContain('Falta')
    expect(dock.textContent).toContain('300')
    expect(dock.textContent).toContain('Levanta até')
    expect(dock.textContent).toContain('230')
  })

  it('FR-022: a capacidade exibida é a mesma que autoriza a falência', () => {
    // Insolvente: levanta 230 < 500 devidos → falência habilitada.
    const insolvente = renderDebt(withDebt(500, 200, [1]))
    expect(screen.getByRole('button', { name: /declarar falência/i }).hasAttribute('disabled')).toBe(false)
    expect(insolvente.container.querySelector('.debt-dock')!.textContent).toContain('230')
    cleanup()

    // Solvente: caixa 200 + Roma + Veneza ($80 → 40) + Pisa ($100 → 50) = 320 ≥ 300.
    renderDebt(withDebt(300, 200, [1, 3, 5]))
    expect(screen.getByRole('button', { name: /declarar falência/i }).hasAttribute('disabled')).toBe(true)
  })

  it('paga quando o caixa cobre, e o botão fica travado quando não cobre', () => {
    renderDebt(withDebt(500, 200))
    expect(screen.getByRole('button', { name: /pagar/i }).hasAttribute('disabled')).toBe(true)
    cleanup()

    renderDebt(withDebt(500, 900))
    const pay = screen.getByRole('button', { name: /pagar/i })
    expect(pay.hasAttribute('disabled')).toBe(false)
    fireEvent.click(pay)
    expect(useGameStore.getState().game.resolution).toBeNull()
    expect(useGameStore.getState().game.players[0].cash).toBe(400)
  })
})

describe('Faixa de cobrança — escolha de credor (FR-023)', () => {
  it('não empilha um botão por adversário: a lista abre a partir de um único controle', () => {
    renderDebt(withDebt(500, 200))
    // Um controle só, mesmo com dois credores possíveis (p2 e p3).
    const trigger = screen.getByRole('button', { name: /pedir/i })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('menu')).toBeNull()

    fireEvent.click(trigger)
    const menu = screen.getByRole('menu', { name: /escolher credor/i })
    expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(2)
  })

  it('escolher um credor abre a solicitação de empréstimo', () => {
    renderDebt(withDebt(500, 200))
    fireEvent.click(screen.getByRole('button', { name: /pedir/i }))
    fireEvent.click(screen.getAllByRole('menuitem')[0])
    expect(useGameStore.getState().game.pendingLoan).toMatchObject({ debtorId: 'p1', principal: 300 })
  })
})
