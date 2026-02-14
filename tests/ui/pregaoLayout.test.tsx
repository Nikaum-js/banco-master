// @vitest-environment jsdom
/**
 * Pregão simultâneo com até SEIS lotes (D-078) — os dois layouts e o que eles prometem.
 *
 * O relato pede duas garantias que nenhum teste anterior cobria, porque até a D-078 três
 * lotes cabiam em qualquer lugar:
 *
 *   1. Em desktop/tablet, os seis lotes aparecem TODOS de uma vez, em grade.
 *   2. Em paisagem baixa, os seis NÃO viram seis cartões empilhados: viram uma faixa de
 *      seleção (com nome, cronômetro e estado de cada um, sempre visíveis) mais o painel
 *      completo de um só.
 *
 * E o que o leitor de tela e o teclado precisam disso: papel de `tablist`/`tab`/`tabpanel`,
 * navegação por setas, estado por texto e não só por cor, encerramento anunciado uma vez, e
 * a contagem regressiva FORA de qualquer região viva.
 *
 * jsdom não implementa `window.matchMedia` — o mock abaixo é o mesmo do
 * `orientationGate.test.tsx`, e respeita a query pedida para não confundir a do layout com
 * a de `prefers-reduced-motion`, que o `Overlay`/`useMotion` também consultam.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createSeedState } from '@/game/setup'
import { useGameStore } from '@/game/store'
import { useRoomStore } from '@/net/roomStore'
import { LandAuctionLayer } from '@/game/ui/landAuction/LandAuctionLayer'
import { maybeOpenLandAuction, placeLandBid, LAND_AUCTION_WINDOW } from '@/game/economy/landAuction'
import { isRentableKind } from '@/game/economy/titles'
import { BOARD } from '@/lib/boardData'
import { useBoardTheme } from '@/game/ui/theme/boardTheme'
import type { GameState } from '@/game/turn/types'

const COMPACT_QUERY = '(orientation: landscape) and (max-height: 560px)'

type Listener = (e: MediaQueryListEvent) => void

function installMatchMedia(compactInicial: boolean) {
  let compact = compactInicial
  const listeners = new Set<Listener>()
  const cache = new Map<string, MediaQueryList>()

  function mqlFor(query: string): MediaQueryList {
    const cached = cache.get(query)
    if (cached) return cached
    const isCompact = query === COMPACT_QUERY
    const mql = {
      get matches() { return isCompact ? compact : false },
      media: query,
      onchange: null,
      addEventListener: (_t: 'change', cb: Listener) => { if (isCompact) listeners.add(cb) },
      removeEventListener: (_t: 'change', cb: Listener) => { if (isCompact) listeners.delete(cb) },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    } as unknown as MediaQueryList
    cache.set(query, mql)
    return mql
  }

  vi.stubGlobal('matchMedia', vi.fn((query: string) => mqlFor(query)))

  return {
    setCompact(next: boolean) {
      compact = next
      act(() => { listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent)) })
    },
  }
}

function compraveis(): number[] {
  return BOARD.filter((sq) => isRentableKind(sq.kind)).map((sq) => sq.pos)
}

/** Pregão de escassez ABERTO com `n` lotes, montado pelo reducer de produção. */
function montarPregao(n: number, agora = Date.now()): GameState {
  const g = createSeedState(['p1', 'p2', 'p3'])
  for (const pos of compraveis().slice(n)) g.titles[pos].ownerId = 'p1'
  const aberto = maybeOpenLandAuction(g, agora)
  if (!aberto.landAuction) throw new Error('fixture não abriu o pregão')
  return aberto
}

function usar(game: GameState): void {
  useGameStore.setState({ game })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  useRoomStore.getState().reset()
  useBoardTheme.getState().setTheme('atlas')
})

describe('grade (desktop e tablet)', () => {
  it.each([1, 3, 6])('renderiza os %i lotes de uma vez, cada um com sua ação principal', (n) => {
    installMatchMedia(false)
    usar(montarPregao(n))

    render(<LandAuctionLayer />)

    expect(screen.getAllByRole('button', { name: /^Cobrir · / })).toHaveLength(n)
    // Sem faixa de seleção: na grade não há lote escondido para selecionar.
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('a grade declara quantos lotes tem, e é o CSS que limita as colunas', () => {
    installMatchMedia(false)
    usar(montarPregao(6))

    const { container } = render(<LandAuctionLayer />)

    const grid = container.querySelector('.lot-grid') as HTMLElement
    expect(grid.style.getPropertyValue('--lot-count')).toBe('6')
  })

  it('cada lote traz a hierarquia inteira: identidade, tempo, lance, caixa e ação', () => {
    installMatchMedia(false)
    const g = montarPregao(3)
    const alvo = g.landAuction!.lots[0].pos
    usar(placeLandBid(g, 'p2', alvo, 150, Date.now()))

    const { container } = render(<LandAuctionLayer />)
    const card = container.querySelector('.lot-card') as HTMLElement

    expect(within(card).getByText(/lance de/)).toBeTruthy()
    expect(within(card).getByText('preço de tabela')).toBeTruthy()
    expect(within(card).getAllByText('disponível').length).toBeGreaterThan(0)
    expect(within(card).getByRole('progressbar', { name: /Tempo restante do lote/ })).toBeTruthy()
    expect(within(card).getByText('Escritura')).toBeTruthy()
  })
})

describe('paisagem baixa (667×375 e 740×360): seleção mais painel', () => {
  it('os seis lotes viram faixa de seleção, e só UM painel completo aparece', () => {
    installMatchMedia(true)
    usar(montarPregao(6))

    render(<LandAuctionLayer />)

    expect(screen.getAllByRole('tab')).toHaveLength(6)
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    // Uma ação principal por vez: seis cartões completos é exatamente o que não pode existir.
    expect(screen.getAllByRole('button', { name: /^Cobrir · / })).toHaveLength(1)
  })

  it('a faixa mantém nome, cronômetro e estado de TODOS os lotes visíveis', () => {
    installMatchMedia(true)
    const g = montarPregao(6)
    const [a, b] = g.landAuction!.lots.map((l) => l.pos)
    let comLances = placeLandBid(g, 'p2', a, 120, Date.now())
    comLances = placeLandBid(comLances, 'p1', b, 90, Date.now())
    usar(comLances)

    const { container } = render(<LandAuctionLayer />)

    const chips = container.querySelectorAll('.lot-chip')
    expect(chips).toHaveLength(6)
    for (const chip of Array.from(chips)) {
      expect(chip.querySelector('.lot-chip__name')?.textContent).toBeTruthy()
      expect(chip.querySelector('.lot-chip__secs')?.textContent).toMatch(/\d+s|fim/)
      // Estado sempre no NOME ACESSÍVEL, nunca só na cor da borda.
      expect(chip.getAttribute('aria-label')).toMatch(/Sem lance|Lance de rival|Você lidera|Arrematado|fica livre/)
    }
  })

  it('com um lote só não há faixa: não existe seleção a fazer', () => {
    installMatchMedia(true)
    usar(montarPregao(1))

    render(<LandAuctionLayer />)

    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
  })

  it('selecionar troca o painel, e o painel diz de qual lote ele é', () => {
    installMatchMedia(true)
    const g = montarPregao(6)
    usar(g)

    render(<LandAuctionLayer />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')

    fireEvent.click(tabs[3])

    expect(screen.getAllByRole('tab')[3].getAttribute('aria-selected')).toBe('true')
    const painel = screen.getByRole('tabpanel')
    expect(painel.getAttribute('aria-labelledby')).toBe(tabs[3].id)
  })

  it('o teclado navega a faixa por setas, Home e End', () => {
    installMatchMedia(true)
    usar(montarPregao(6))

    render(<LandAuctionLayer />)
    const tabs = () => screen.getAllByRole('tab')

    fireEvent.keyDown(tabs()[0], { key: 'ArrowRight' })
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(tabs()[1], { key: 'End' })
    expect(tabs()[5].getAttribute('aria-selected')).toBe('true')

    // Circular: da última, seta à direita volta à primeira.
    fireEvent.keyDown(tabs()[5], { key: 'ArrowRight' })
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(tabs()[0], { key: 'ArrowLeft' })
    expect(tabs()[5].getAttribute('aria-selected')).toBe('true')
  })

  it('foco rovente: só o lote selecionado é parada de tabulação', () => {
    installMatchMedia(true)
    usar(montarPregao(6))

    render(<LandAuctionLayer />)
    const tabs = screen.getAllByRole('tab')

    expect(tabs.filter((t) => t.getAttribute('tabindex') === '0')).toHaveLength(1)
    expect(tabs[0].getAttribute('tabindex')).toBe('0')
    expect(tabs.slice(1).every((t) => t.getAttribute('tabindex') === '-1')).toBe(true)
  })

  it('quando o lote selecionado SAI do pregão, a seleção cai no próximo ainda aberto', () => {
    installMatchMedia(true)
    const agora = 1_000_000
    vi.useFakeTimers()
    vi.setSystemTime(agora)
    const g = montarPregao(6, agora)
    usar(g)

    render(<LandAuctionLayer />)
    const primeiro = g.landAuction!.lots[0].pos
    expect(screen.getAllByRole('tab')[0].getAttribute('aria-selected')).toBe('true')

    // O lote selecionado é removido (fechou e foi liquidado).
    act(() => {
      const semPrimeiro = structuredClone(g)
      semPrimeiro.landAuction!.lots = semPrimeiro.landAuction!.lots.filter((l) => l.pos !== primeiro)
      usar(semPrimeiro)
    })

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(5)
    expect(tabs[0].getAttribute('aria-selected')).toBe('true') // o próximo ainda aberto
  })

  it('lote que apenas ENCERROU continua selecionado: o jogador vê o desfecho', () => {
    installMatchMedia(true)
    const agora = 2_000_000
    vi.useFakeTimers()
    vi.setSystemTime(agora)
    const g = montarPregao(6, agora)
    usar(g)

    render(<LandAuctionLayer />)
    const tabs0 = screen.getAllByRole('tab')
    fireEvent.click(tabs0[2])

    // O relógio passa do prazo, mas o lote ainda está na lista (fecho ainda não despachado).
    act(() => { vi.advanceTimersByTime(LAND_AUCTION_WINDOW + 1_000) })

    const tabs = screen.getAllByRole('tab')
    expect(tabs[2].getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(tabs[2].id)
  })
})

describe('acessibilidade do pregão', () => {
  it('a contagem regressiva NÃO é anunciada: fica fora de região viva', () => {
    installMatchMedia(false)
    usar(montarPregao(3))

    const { container } = render(<LandAuctionLayer />)

    for (const secs of Array.from(container.querySelectorAll('.lot-clock__secs'))) {
      expect(secs.getAttribute('aria-live')).toBe('off')
    }
    // O prazo continua alcançável sob demanda, pelo `progressbar` de cada lote.
    expect(screen.getAllByRole('progressbar', { name: /Tempo restante do lote/ })).toHaveLength(3)
  })

  it('o encerramento de um lote é anunciado uma vez, em região polida', () => {
    installMatchMedia(false)
    const agora = 3_000_000
    vi.useFakeTimers()
    vi.setSystemTime(agora)
    usar(montarPregao(2, agora))

    render(<LandAuctionLayer />)
    const aviso = screen.getByRole('status')
    expect(aviso.getAttribute('aria-live')).toBe('polite')
    expect(aviso.textContent).toBe('')

    act(() => { vi.advanceTimersByTime(LAND_AUCTION_WINDOW + 1_000) })

    expect(screen.getByRole('status').textContent).toMatch(/Sem lance, fica livre/)
  })

  it('o modal do pregão é diálogo modal, com o título como nome acessível', () => {
    installMatchMedia(false)
    usar(montarPregao(3))

    render(<LandAuctionLayer />)

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Leilão de Escassez' })).toBeTruthy()
  })

  it('nenhum lance vira informação só de cor: estado e valor sempre têm texto', () => {
    installMatchMedia(false)
    const g = montarPregao(3)
    usar(placeLandBid(g, 'p2', g.landAuction!.lots[0].pos, 200, Date.now()))

    const { container } = render(<LandAuctionLayer />)

    expect(container.textContent).toContain('sem lance')
    expect(container.textContent).toContain('lance de')
  })

  it('cada botão de incremento se nomeia pelo valor e pelo lote', () => {
    installMatchMedia(false)
    usar(montarPregao(1))

    render(<LandAuctionLayer />)

    expect(screen.getAllByRole('button', { name: /^Lance de R\$ \d+ em / })).toHaveLength(2)
  })
})

describe('o layout acompanha o giro do aparelho, sem perder o pregão', () => {
  it('de grade para faixa e de volta, sem desmontar o leilão', () => {
    const mm = installMatchMedia(false)
    usar(montarPregao(6))

    render(<LandAuctionLayer />)
    expect(screen.getAllByRole('button', { name: /^Cobrir · / })).toHaveLength(6)

    mm.setCompact(true)
    expect(screen.getAllByRole('tab')).toHaveLength(6)
    expect(screen.getAllByRole('button', { name: /^Cobrir · / })).toHaveLength(1)

    mm.setCompact(false)
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Cobrir · / })).toHaveLength(6)
  })
})

describe('os dois mapas publicados', () => {
  // Aqui o mapa é trocado pelo caminho de PRODUÇÃO (`setTheme`), não por `setActiveBoard`
  // direto: a camada de UI resolve a casa por `activeBoard()`, que lê o store do tema, e o
  // motor lê o `BOARD` ativo. Trocar só um dos dois é exatamente a divergência que o teste
  // precisa não ter — com ela, o pregão da Fuligem renderizava quatro lotes com nome do Atlas.
  it.each(['atlas', 'fuligem'] as const)('%s: seis lotes com nome próprio do mapa', (mapa) => {
    useBoardTheme.getState().setTheme(mapa)
    installMatchMedia(false)
    usar(montarPregao(6))

    const { container } = render(<LandAuctionLayer />)

    const nomes = Array.from(container.querySelectorAll('.lot-card__name')).map((e) => e.textContent)
    expect(nomes).toHaveLength(6)
    expect(nomes.every((n) => (n ?? '').length > 0)).toBe(true)
  })
})
