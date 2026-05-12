// @vitest-environment jsdom
import { act } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BuildingMark, HangarMark, PropertyPopover } from '@/boards/shared'
import Board01Classic from '@/boards/Board01Classic'
import { GameHUD } from '@/game/ui/GameHUD'
import { createSeedState } from '@/game/setup'
import { useGameStore } from '@/game/store'
import { BOARD, type PropertySquare } from '@/lib/boardData'
import { createRoom, joinRoom, SEAT_COLORS } from '@/net/room'
import { useRoomStore } from '@/net/roomStore'

afterEach(() => {
  cleanup()
  useGameStore.getState().resetGame()
  useRoomStore.getState().reset()
})

describe('popover de propriedade', () => {
  it('eleva a gestão da propriedade acima da cobrança de dívida', () => {
    const game = createSeedState(['p1', 'p2'])
    game.players[0].cash = 0
    game.titles[1].ownerId = 'p1'
    game.resolution = { kind: 'debt', amount: 50, creditorId: 'p2' }
    act(() => useGameStore.setState({ game }))

    render(
      <>
        <Board01Classic />
        <GameHUD />
      </>,
    )

    act(() => {
      screen.getByRole('button', { name: 'Roma: ver detalhes' }).click()
    })

    const layer = document.body.querySelector(':scope > [data-deed-popover-layer]')
    expect(layer).toBeTruthy()
    expect(layer?.getAttribute('style')).toContain('z-index: 65')
    expect(screen.getByRole('button', { name: 'Hipotecar' })).toBeTruthy()
  })

  it('não oferece gestão de um título alheio a quem não é o jogador da vez', () => {
    // O bug: `ownedByActive` responde "é do jogador da VEZ?", não "é MEU?". Numa sala, abrir
    // o título do adversário enquanto ele joga mostrava Construir/Vender/Hipotecar a quem o
    // host ia descartar de qualquer jeito.
    const game = createSeedState(['p1', 'p2'])
    game.titles[1].ownerId = 'p1' // Roma é do jogador da vez (p1)
    const criada = createRoom('r1', { uid: 'host', name: 'Nikolas', color: SEAT_COLORS[0] })
    const entrou = joinRoom(criada, { uid: 'tok-2', name: 'Nikolas 2', color: SEAT_COLORS[1] })
    if (!entrou.ok) throw new Error(entrou.reason)

    act(() => {
      useGameStore.setState({ game })
      useRoomStore.setState({ room: entrou.room, myUid: 'tok-2' }) // sou p2, é a vez de p1
    })

    render(<PropertyPopover square={BOARD[1] as PropertySquare} side="top" onClose={() => undefined} />)

    expect(screen.getByText('Nikolas')).toBeTruthy() // o dono continua visível
    expect(screen.queryByRole('button', { name: 'Construir' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Vender' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hipotecar' })).toBeNull()
  })

  it('apresenta a progressão completa e resolve o dono para sua identidade pública', () => {
    const game = createSeedState(['p1', 'p2'])
    game.titles[1].ownerId = 'p1'
    game.titles[1].houses = 2
    const room = createRoom('r1', {
      uid: 'host',
      name: 'Nikolas',
      color: SEAT_COLORS[0],
      avatar: 'prism-face',
      skin: 'astronauta',
    })

    act(() => {
      useGameStore.setState({ game })
      useRoomStore.setState({ room, myUid: 'host' })
    })

    const { container } = render(
      <PropertyPopover
        square={BOARD[1] as PropertySquare}
        side="top"
        onClose={() => undefined}
      />,
    )

    expect(screen.getByText('Nikolas')).toBeTruthy()
    expect(screen.queryByText(/^p1$/i)).toBeNull()
    expect(container.querySelector('.property-deed__owner-avatar.avatar-face')).toBeTruthy()

    const tiers = container.querySelectorAll('.property-rent-tier')
    expect(tiers).toHaveLength(8)
    expect(container.querySelectorAll('.property-rent-tier__mark svg')).toHaveLength(15)
    expect(container.querySelector('[data-tier="house"][data-active]')?.textContent).toContain('2 casas')
    expect(container.querySelector('svg animate')).toBeNull()
  })

  it('reaproveita a mesma família de glifos na marca de construção do tabuleiro', () => {
    const game = createSeedState(['p1', 'p2'])
    game.titles[1].ownerId = 'p1'
    game.titles[1].houses = 4
    act(() => useGameStore.setState({ game }))

    const { container } = render(<BuildingMark pos={1} />)

    const mark = container.querySelector('[data-building-layout="grid-2x2"]')
    expect(mark).toBeTruthy()
    expect(mark?.querySelectorAll('svg')).toHaveLength(4)
    expect(mark?.querySelector('svg')?.getAttribute('width')).toBe('13')
    expect(container.querySelector('svg animate')).toBeNull()
  })

  it('mostra os dois hotéis e o hangar correto também nos marcadores do tabuleiro', () => {
    const game = createSeedState(['p1', 'p2'])
    game.titles[1].ownerId = 'p1'
    game.titles[1].hotel = true
    game.titles[1].hotel2 = true
    game.titles[6].ownerId = 'p1'
    game.titles[6].hangar = true
    act(() => useGameStore.setState({ game }))

    const hotel = render(<BuildingMark pos={1} />)
    expect(hotel.container.querySelector('[data-building-kind="hotel"]')?.querySelectorAll('svg')).toHaveLength(2)
    hotel.unmount()

    const hangar = render(<HangarMark pos={6} />)
    expect(hangar.container.querySelector('[data-building-kind="hangar"] [data-glyph="hangar"]')).toBeTruthy()
  })

  it('bloqueia o arranha-céu no botão e no dispatch quando o grupo está incompleto', () => {
    const game = createSeedState(['p1', 'p2'])
    const title = game.titles[1]
    title.ownerId = 'p1'
    title.hotel = true
    title.hotel2 = true
    game.players[0].cash = 10_000
    act(() => useGameStore.setState({ game }))

    render(
      <PropertyPopover
        square={BOARD[1] as PropertySquare}
        side="top"
        onClose={() => undefined}
      />,
    )

    expect((screen.getByRole('button', { name: 'Construir' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Tenha todas as cidades do país para construir o arranha-céu.')).toBeTruthy()

    const before = useGameStore.getState().game
    act(() => useGameStore.getState().dispatch({ kind: 'build-house', pos: 1 }))
    expect(useGameStore.getState().game).toBe(before)
    expect(useGameStore.getState().game.titles[1].skyscraper).toBe(false)
  })
})
