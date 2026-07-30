// @vitest-environment jsdom
import { act } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PlayersPanel } from '@/boards/shared'
import { createSeedState } from '@/game/setup'
import { useGameStore } from '@/game/store'
import { useRoomStore } from '@/net/roomStore'
import { createRoom, joinRoom, SEAT_COLORS } from '@/net/room'

afterEach(() => {
  cleanup()
  useRoomStore.getState().reset()
})

describe('painel de participantes', () => {
  it('expõe a lotação, segue a ordem de jogada e marca o turno sem numeração redundante', () => {
    const game = createSeedState(['p1', 'p2'])
    game.turnOrder = [1, 0]
    act(() => useGameStore.setState({ game }))

    const { container } = render(<PlayersPanel />)

    expect(screen.getByText('2 de 8 jogadores').classList.contains('sr-only')).toBe(true)
    const roster = screen.getByRole('list', { name: 'Participantes da partida' })
    const rows = within(roster).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('Jogador 2')).toBeTruthy()
    expect(within(rows[1]).getByText('Jogador 1')).toBeTruthy()
    expect(rows[0].dataset.active).toBe('true')
    expect(rows[0].hasAttribute('aria-current')).toBe(false)
    expect(within(rows[0]).getByText('Turno atual').classList.contains('sr-only')).toBe(true)
    expect(container.querySelector('.players-capacity__slots')).toBeNull()
    expect(container.querySelector('.player-row__seat')).toBeNull()
    expect(container.querySelector('.player-row__portrait .avatar-artwork')).toBeTruthy()
    expect(within(rows[0]).getByText('Caixa')).toBeTruthy()
    expect(within(rows[0]).queryByText('VEZ')).toBeNull()
  })

  it('trata o participante falido como um assento encerrado', () => {
    const game = createSeedState(['p1', 'p2'])
    game.players[1].eliminated = true
    act(() => useGameStore.setState({ game }))

    const { container } = render(<PlayersPanel />)
    const row = screen.getByText('Jogador 2').closest('.player-row')

    expect(row?.classList.contains('player-row--bankrupt')).toBe(true)
    expect(within(row as HTMLElement).getByText('Falido').classList.contains('player-row__state--bankrupt')).toBe(true)
    expect(container.querySelectorAll('.player-row--bankrupt')).toHaveLength(1)
  })
})

describe('desistir da partida (§9.6/D-057)', () => {
  // Sala de dois: 'host' é p1 (a vez), 'tok-2' é p2. Só o assento LOCAL ganha o botão.
  function sala() {
    const criada = createRoom('r1', { uid: 'host', name: 'Nikolas', color: SEAT_COLORS[0] })
    const entrou = joinRoom(criada, { uid: 'tok-2', name: 'Nikolas 2', color: SEAT_COLORS[1] })
    if (!entrou.ok) throw new Error(entrou.reason)
    return entrou.room
  }

  function monta(myUid: string) {
    act(() => {
      useGameStore.setState({ game: createSeedState(['p1', 'p2']) })
      useRoomStore.setState({ room: sala(), myUid })
    })
    return render(<PlayersPanel />)
  }

  it('o botão só existe na linha do assento local, e só clica na própria vez', () => {
    monta('tok-2') // sou p2; a vez é de p1
    const meu = screen.getByRole('button', { name: 'Desistir da partida' })

    expect(meu.closest('.player-row')).toBe(screen.getByText('Nikolas 2').closest('.player-row'))
    expect(screen.getAllByRole('button', { name: 'Desistir da partida' })).toHaveLength(1)
    expect((meu as HTMLButtonElement).disabled).toBe(true) // não é minha vez
  })

  it('confirmar despacha o comando; cancelar não muda nada', () => {
    monta('host') // sou p1, a vez é minha
    const botao = screen.getByRole('button', { name: 'Desistir da partida' })
    expect((botao as HTMLButtonElement).disabled).toBe(false)

    act(() => botao.click())
    expect(screen.getByRole('dialog')).toBeTruthy()
    act(() => screen.getByRole('button', { name: 'Continuar jogando' }).click())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useGameStore.getState().game.players[0].eliminated).toBe(false)

    act(() => screen.getByRole('button', { name: 'Desistir da partida' }).click())
    act(() => screen.getByRole('button', { name: 'Desistir' }).click())

    // Mesa de dois: sair encerra a partida (§9.5), e o assento sai da mesa.
    expect(useGameStore.getState().game.players[0].eliminated).toBe(true)
    expect(useGameStore.getState().game.phase).toBe('ended')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a confirmação diz para onde vai o patrimônio — banco sem empréstimo, credor com', () => {
    act(() => {
      const game = createSeedState(['p1', 'p2'])
      game.titles[1].ownerId = 'p1'
      game.titles[3].ownerId = 'p1'
      useGameStore.setState({ game })
      useRoomStore.setState({ room: sala(), myUid: 'host' })
    })
    const { rerender } = render(<PlayersPanel />)
    act(() => screen.getByRole('button', { name: 'Desistir da partida' }).click())

    const dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getByText('Propriedades').nextElementSibling?.textContent).toBe('2')
    expect(within(dialogo).getByText('Fica com').nextElementSibling?.textContent).toBe('Banco')

    act(() => {
      const game = structuredClone(useGameStore.getState().game)
      game.loans.push({ debtorId: 'p1', creditorId: 'p2', principal: 300, ratePct: 10, lapsElapsed: 0 })
      useGameStore.setState({ game })
    })
    rerender(<PlayersPanel />)
    expect(within(screen.getByRole('dialog')).getByText('Nikolas 2')).toBeTruthy()
  })

  it('quem já saiu não tem mais o botão', () => {
    act(() => {
      const game = createSeedState(['p1', 'p2', 'p3'])
      game.players[0].eliminated = true
      useGameStore.setState({ game })
      useRoomStore.setState({ room: sala(), myUid: 'host' })
    })
    render(<PlayersPanel />)

    expect(screen.queryByRole('button', { name: 'Desistir da partida' })).toBeNull()
  })
})
