/**
 * Gatilho do Pregão de escassez com o limiar em SEIS (§7.5, D-078).
 *
 * A D-078 muda um número, e um número que a folha de estilo não vê e o motor lê em cinco
 * lugares. O que estes testes fixam não é o `6`: é o CONTORNO dele. Onde o pregão passa a
 * abrir (7 não, 6 sim), onde continua não abrindo (0 livre, 1 vivo, pregão já em curso,
 * episódio gasto), e o que se preserva do desenho anterior (o re-arme, as três procedências,
 * o cronômetro por lote, a solvência por soma).
 *
 * `THEME.LAND_AUCTION_THRESHOLD` aparece nas asserções onde a regra é "o limiar", e o
 * literal 6 aparece onde o relato pediu um número explícito ("7 não abre, 6 abre"). Escrever
 * tudo em função da constante deixaria a suíte passar se alguém a mudasse de volta para 3.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createSeedState } from '@/game/setup'
import {
  freeLots,
  lotsUntilScarcityAuction,
  maybeOpenLandAuction,
  openEstateAuction,
  placeLandBid,
  closeExpiredLandLots,
  committedCash,
  LAND_AUCTION_WINDOW,
} from '@/game/economy/landAuction'
import { applyCommand } from '@/game/commands'
import { THEME } from '@/game/theme'
import { isRentableKind } from '@/game/economy/titles'
import { setActiveBoard, ATLAS_BOARD, BOARD } from '@/lib/boardData'
import { catalogOf, setActiveRules, DEFAULT_RULES } from '@/lib/mapCatalog'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'

const NOW = 10_000

function useMap(id: 'atlas' | 'fuligem'): void {
  const catalog = catalogOf(id)
  setActiveBoard(catalog.board)
  setActiveRules(catalog.rules)
}

afterEach(() => {
  setActiveBoard(ATLAS_BOARD)
  setActiveRules(DEFAULT_RULES)
})

function compraveis(): number[] {
  return BOARD.filter((sq) => isRentableKind(sq.kind)).map((sq) => sq.pos)
}

/** Estado com exatamente `livres` terrenos sem dono; o resto é de p1. */
function comLivres(livres: number, players: string[] = ['p1', 'p2']): GameState {
  const g = createSeedState(players)
  for (const pos of compraveis().slice(livres)) g.titles[pos].ownerId = 'p1'
  return g
}

describe('limiar do pregão de escassez (§7.5, D-078)', () => {
  it('o tema declara SEIS — o número da decisão, não o herdado da D-023', () => {
    expect(THEME.LAND_AUCTION_THRESHOLD).toBe(6)
  })

  it('com 7 terrenos livres o pregão NÃO abre', () => {
    const g = comLivres(7)
    expect(freeLots(g)).toHaveLength(7)
    expect(maybeOpenLandAuction(g, NOW).landAuction).toBeNull()
  })

  it('a descida de 7 para 6 abre o pregão, e leva os SEIS lotes', () => {
    const sete = comLivres(7)
    expect(maybeOpenLandAuction(sete, NOW).landAuction).toBeNull()

    // A sétima compra é o que cruza o limiar.
    const seis = structuredClone(sete)
    seis.titles[freeLots(seis)[0]].ownerId = 'p2'

    const aberto = maybeOpenLandAuction(seis, NOW)
    expect(aberto.landAuction).not.toBeNull()
    expect(aberto.landAuction!.lots).toHaveLength(6)
    expect(aberto.landAuction!.origin).toBe('scarcity')
  })

  it.each([1, 2, 3, 4, 5, 6])('com %i terrenos livres, TODOS entram de uma vez', (n) => {
    const aberto = maybeOpenLandAuction(comLivres(n), NOW)
    expect(aberto.landAuction!.lots.map((l) => l.pos)).toEqual(freeLots(comLivres(n)))
    expect(aberto.landAuction!.lots).toHaveLength(n)
  })

  it('com 0 terrenos livres não existe pregão a abrir (guarda U1)', () => {
    const g = comLivres(0)
    expect(freeLots(g)).toHaveLength(0)
    expect(maybeOpenLandAuction(g, NOW)).toBe(g) // no-op referencial
  })

  it('com um só jogador vivo não abre: pregão sem disputa não é pregão', () => {
    const g = comLivres(4, ['p1', 'p2'])
    g.players[1].eliminated = true
    expect(maybeOpenLandAuction(g, NOW)).toBe(g)
  })

  it('pregão já aberto não duplica nem repõe lotes', () => {
    const aberto = maybeOpenLandAuction(comLivres(6), NOW)
    expect(maybeOpenLandAuction(aberto, NOW + 500)).toBe(aberto)
  })

  it('episódio consumido não abre de novo na mesma descida', () => {
    const aberto = maybeOpenLandAuction(comLivres(6), NOW)
    expect(aberto.landAuctionArmed).toBe(false)

    // O pregão fecha sem lance: os seis voltam a ser terreno livre, ainda ≤ 6.
    const fechado = closeExpiredLandLots(aberto, NOW + LAND_AUCTION_WINDOW)
    expect(fechado.landAuction).toBeNull()
    expect(freeLots(fechado)).toHaveLength(6)

    expect(maybeOpenLandAuction(fechado, NOW + LAND_AUCTION_WINDOW + 1).landAuction).toBeNull()
  })

  it('re-arma quando a contagem volta a SUPERAR seis, e dispara na descida seguinte', () => {
    const gasto = comLivres(6)
    gasto.landAuctionArmed = false

    // Sete livres (uma devolução ao banco, §6.4/§9.6) — acima do limiar, re-arma.
    const subiu = structuredClone(gasto)
    subiu.titles[compraveis()[6]].ownerId = null
    expect(freeLots(subiu)).toHaveLength(7)
    const rearmado = maybeOpenLandAuction(subiu, NOW)
    expect(rearmado.landAuctionArmed).toBe(true)
    expect(rearmado.landAuction).toBeNull() // re-armar não é abrir

    // E a próxima descida a 6 abre de novo.
    const desceu = structuredClone(rearmado)
    desceu.titles[freeLots(desceu)[0]].ownerId = 'p2'
    expect(maybeOpenLandAuction(desceu, NOW + 1).landAuction).not.toBeNull()
  })

  it('exatamente SEIS livres re-arma e não abre quando o episódio está gasto', () => {
    const g = comLivres(6)
    g.landAuctionArmed = false
    expect(maybeOpenLandAuction(g, NOW)).toBe(g) // seis não é "acima do limiar"
  })
})

describe('contador de terrenos até o pregão acompanha o limiar novo', () => {
  it('mede a distância até SEIS, não até três', () => {
    expect(lotsUntilScarcityAuction(comLivres(10))).toBe(4)
    expect(lotsUntilScarcityAuction(comLivres(7))).toBe(1)
  })

  it('de 6 para baixo é 0 ("a próxima compra abre"), nunca negativo', () => {
    for (const n of [6, 5, 4, 3, 2, 1]) expect(lotsUntilScarcityAuction(comLivres(n))).toBe(0)
  })
})

describe('o que a D-078 preserva do pregão', () => {
  it('seis lotes nascem com cronômetros INDEPENDENTES, e lance reinicia só um', () => {
    const g = maybeOpenLandAuction(comLivres(6), NOW)
    const lotes = g.landAuction!.lots.map((l) => l.pos)
    expect(g.landAuction!.lots.every((l) => l.deadline === NOW + LAND_AUCTION_WINDOW)).toBe(true)

    const out = placeLandBid(g, 'p2', lotes[3], 50, NOW + 4_000)

    expect(out.landAuction!.lots.find((l) => l.pos === lotes[3])!.deadline).toBe(NOW + 4_000 + LAND_AUCTION_WINDOW)
    for (const pos of lotes.filter((p) => p !== lotes[3])) {
      expect(out.landAuction!.lots.find((l) => l.pos === pos)!.deadline).toBe(NOW + LAND_AUCTION_WINDOW)
    }
  })

  it('a janela continua sendo 24s por lote', () => {
    expect(THEME.LAND_AUCTION_SECONDS).toBe(24)
    expect(LAND_AUCTION_WINDOW).toBe(24_000)
  })

  it('cada um dos seis lotes fecha SOZINHO, na ordem do próprio prazo', () => {
    let g = maybeOpenLandAuction(comLivres(6), NOW)
    const [a, b] = g.landAuction!.lots.map((l) => l.pos)
    g = placeLandBid(g, 'p2', b, 40, NOW + 5_000) // empurra só B

    const parcial = closeExpiredLandLots(g, NOW + LAND_AUCTION_WINDOW)
    expect(parcial.landAuction!.lots.map((l) => l.pos)).toEqual([b]) // os outros cinco fecharam
    expect(parcial.titles[a].ownerId).toBeNull() // sem lance: fica livre

    const fim = closeExpiredLandLots(parcial, NOW + 5_000 + LAND_AUCTION_WINDOW)
    expect(fim.landAuction).toBeNull()
    expect(fim.titles[b].ownerId).toBe('p2')
  })

  it('solvência por SOMA vale nos seis: o que se lidera fica comprometido', () => {
    let g = maybeOpenLandAuction(comLivres(6, ['p1', 'p2', 'p3']), NOW)
    const lotes = g.landAuction!.lots.map((l) => l.pos)
    g.players[1].cash = 300

    g = placeLandBid(g, 'p2', lotes[0], 100, NOW)
    g = placeLandBid(g, 'p2', lotes[1], 100, NOW)
    expect(committedCash(g, 'p2', lotes[2])).toBe(200)

    // 200 comprometidos + 150 estouraria os 300.
    expect(placeLandBid(g, 'p2', lotes[2], 150, NOW)).toBe(g)
    g = placeLandBid(g, 'p2', lotes[2], 100, NOW) // 300 exatos passam
    expect(g.landAuction!.lots.find((l) => l.pos === lotes[2])!.highBidder).toBe('p2')

    const fim = closeExpiredLandLots(g, NOW + LAND_AUCTION_WINDOW)
    expect(fim.players[1].cash).toBe(0)
    expect(fim.players[1].cash).toBeGreaterThanOrEqual(0)
  })

  it('lances concorrentes no mesmo lote: o último válido lidera e o anterior é liberado', () => {
    let g = maybeOpenLandAuction(comLivres(6, ['p1', 'p2', 'p3']), NOW)
    const pos = g.landAuction!.lots[0].pos

    g = placeLandBid(g, 'p2', pos, 100, NOW)
    g = placeLandBid(g, 'p3', pos, 150, NOW + 100)
    expect(g.landAuction!.lots[0].highBidder).toBe('p3')
    expect(committedCash(g, 'p2', g.landAuction!.lots[1].pos)).toBe(0) // p2 foi coberto

    expect(placeLandBid(g, 'p2', pos, 150, NOW + 200)).toBe(g) // empatar não cobre
  })

  it('as TRÊS procedências continuam existindo: escassez, espólio e mista', () => {
    const escassez = maybeOpenLandAuction(comLivres(6, ['p1', 'p2', 'p3']), NOW)
    expect(escassez.landAuction!.origin).toBe('scarcity')

    // Espólio puro: nenhum pregão aberto.
    const semPregao = comLivres(0, ['p1', 'p2', 'p3'])
    semPregao.players[2].eliminated = true
    const espolio = openEstateAuction(semPregao, compraveis().slice(0, 2), NOW, 'p3')
    expect(espolio.landAuction!.origin).toBe('bankruptcy')

    // Misto: espólio injetado num pregão de escassez em curso.
    const comEscassez = structuredClone(escassez)
    comEscassez.players[2].eliminated = true
    const misto = openEstateAuction(comEscassez, compraveis().slice(-2), NOW + 500, 'p3')
    expect(misto.landAuction!.origin).toBe('mixed')
    expect(misto.landAuction!.lots).toHaveLength(8)
    // FR-018: o espólio NÃO devolve o episódio de escassez já consumido.
    expect(misto.landAuctionArmed).toBe(false)
  })

  it('reconexão: o pregão de seis lotes sobrevive ao round-trip de snapshot', () => {
    const g = maybeOpenLandAuction(comLivres(6, ['p1', 'p2', 'p3']), NOW)
    const comLance = placeLandBid(g, 'p2', g.landAuction!.lots[2].pos, 70, NOW + 900)

    const voltou: GameState = JSON.parse(JSON.stringify(comLance))

    expect(voltou).toEqual(comLance)
    expect(voltou.landAuction!.lots).toHaveLength(6)
    // O prazo é AUTORITATIVO e absoluto: quem reconecta lê o mesmo instante de fecho, e o
    // fecho depois do snapshot dá o mesmo resultado que daria sem a queda.
    expect(closeExpiredLandLots(voltou, NOW + 900 + LAND_AUCTION_WINDOW).titles[voltou.landAuction!.lots[2].pos].ownerId)
      .toBe('p2')
  })
})

describe('o gatilho vale nos dois mapas publicados', () => {
  it.each(['atlas', 'fuligem'] as const)('%s: 7 não abre, 6 abre com todos os lotes', (mapa) => {
    useMap(mapa)
    expect(compraveis().length).toBeGreaterThan(7) // o mapa tem inventário pra escassez existir

    expect(maybeOpenLandAuction(comLivres(7), NOW).landAuction).toBeNull()

    const aberto = maybeOpenLandAuction(comLivres(6), NOW)
    expect(aberto.landAuction!.lots).toHaveLength(6)
    expect(aberto.landAuction!.origin).toBe('scarcity')
  })
})

describe('o dispatcher reavalia o limiar nos comandos que mudam posse', () => {
  const ctx = { rng: () => 0.5, now: () => NOW, ports: { onPassGo: () => 250 } } as unknown as TurnCtx

  it('a compra que cruza de 7 para 6 abre o pregão pelo caminho de produção', () => {
    const g = comLivres(7, ['p1', 'p2'])
    const alvo = freeLots(g)[0]
    // Estado legal de compra: o jogador da vez parou no terreno livre.
    g.players[0].pos = alvo
    g.turn = { ...g.turn, state: 'casa-a-resolver' }
    g.resolution = { kind: 'purchase', pos: alvo }
    g.players[0].cash = 5_000

    const depois = applyCommand(g, { kind: 'buy-property' }, ctx)

    expect(depois.titles[alvo].ownerId).toBe('p1')
    expect(depois.landAuction).not.toBeNull()
    expect(depois.landAuction!.lots).toHaveLength(6)
  })
})
