/**
 * CARD 08 — quantos terrenos faltam para o pregão de escassez (§7.5, D-060).
 *
 * O relato pede "quantas VOLTAS faltam". O gatilho do §7.5 nunca foi por voltas: é a contagem de
 * terrenos compráveis **sem dono** caindo a ≤`THEME.LAND_AUCTION_THRESHOLD`. Voltas não existem
 * como medida aqui, e inventar
 * uma conversão ("nesse ritmo, ~2 voltas") seria a interface adivinhando — o contador teria de
 * mudar sozinho sem nada acontecer no tabuleiro, e erraria a cada compra fora do ritmo médio.
 *
 * O que o motor pode afirmar com precisão é **quantos terrenos livres ainda faltam**, e é isso
 * que o contador expõe. Atende aos critérios do card do jeito que dá para ser verdade:
 * corresponde ao estado real, nunca fica negativo, e sobrevive a snapshot/reconexão porque é
 * derivado do estado (não é campo persistido que pode divergir).
 */
import { describe, it, expect } from 'vitest'
import { createSeedState } from '@/game/setup'
import { lotsUntilScarcityAuction, freeLots } from '@/game/economy/landAuction'
import { normalizeGame } from '@/game/log'
import { THEME } from '@/game/theme'
import { BOARD } from '@/lib/boardData'
import type { GameState } from '@/game/turn/types'

const COMPRAVEIS = BOARD.filter((sq) => 'price' in sq).map((sq) => sq.pos)

// Deixa exatamente `livres` terrenos sem dono; todo o resto vai para p2.
function comTerrenosLivres(livres: number): GameState {
  const g = createSeedState(['p1', 'p2'])
  for (const pos of COMPRAVEIS.slice(livres)) g.titles[pos].ownerId = 'p2'
  return g
}

describe('CARD 08 — contador de terrenos até o pregão de escassez (§7.5)', () => {
  it('corresponde ao estado real: livres − limiar', () => {
    const g = comTerrenosLivres(10)
    expect(freeLots(g)).toHaveLength(10)
    expect(lotsUntilScarcityAuction(g)).toBe(10 - THEME.LAND_AUCTION_THRESHOLD)
  })

  it('atualiza quando a posse muda — a fonte é o motor, não um contador paralelo', () => {
    const g = comTerrenosLivres(THEME.LAND_AUCTION_THRESHOLD + 3)
    expect(lotsUntilScarcityAuction(g)).toBe(3)

    g.titles[freeLots(g)[0]].ownerId = 'p1' // alguém comprou

    expect(lotsUntilScarcityAuction(g)).toBe(2)
  })

  it('NUNCA fica negativo: no limiar ou abaixo dele, é 0 ("a próxima compra abre")', () => {
    expect(lotsUntilScarcityAuction(comTerrenosLivres(THEME.LAND_AUCTION_THRESHOLD))).toBe(0)
    expect(lotsUntilScarcityAuction(comTerrenosLivres(2))).toBe(0)
    expect(lotsUntilScarcityAuction(comTerrenosLivres(1))).toBe(0)
  })

  it('com o pregão ABERTO, o contador dá lugar ao estado do leilão (null)', () => {
    const g = comTerrenosLivres(3)
    g.landAuction = { lots: [{ pos: COMPRAVEIS[0], currentBid: 0, highBidder: null, deadline: 0 }], bidders: ['p1', 'p2'], origin: 'scarcity', bankruptId: null }

    expect(lotsUntilScarcityAuction(g)).toBeNull()
  })

  it('episódio gasto → null, não 0: "faltam 0" e "não vai acontecer" são coisas diferentes', () => {
    const g = comTerrenosLivres(3)
    g.landAuctionArmed = false

    // Mentir "faltam 0" aqui deixaria o jogador esperando um evento que não vem mais nesta
    // descida. `null` é a interface dizendo que não há contagem a fazer.
    expect(lotsUntilScarcityAuction(g)).toBeNull()
  })

  it('tabuleiro sem terreno livre → null (guarda U1: nunca pregão vazio)', () => {
    expect(lotsUntilScarcityAuction(comTerrenosLivres(0))).toBeNull()
  })

  it('mesa sem disputa possível (1 vivo) → null', () => {
    const g = comTerrenosLivres(3)
    g.players[1].eliminated = true

    expect(lotsUntilScarcityAuction(g)).toBeNull()
  })

  it('sobrevive a snapshot/reconexão: é DERIVADO, e a trava ausente lê-se como armada', () => {
    const g = comTerrenosLivres(5)
    // Snapshot gravado entre a D-059 e a D-060 não tem `landAuctionArmed`. `normalizeGame` lê
    // ausente como `true` — o valor conservador: no pior caso o pregão dispara uma vez a mais.
    const cru = structuredClone(g) as Partial<GameState>
    delete cru.landAuctionArmed
    const normalizado: GameState = { ...(cru as GameState), ...normalizeGame(cru) }

    expect(normalizado.landAuctionArmed).toBe(true)
    expect(lotsUntilScarcityAuction(normalizado)).toBe(lotsUntilScarcityAuction(g))
  })

  it('serializa e desserializa sem perder o valor — round-trip de snapshot', () => {
    const g = comTerrenosLivres(7)
    const voltou: GameState = JSON.parse(JSON.stringify(g))

    expect(lotsUntilScarcityAuction(voltou)).toBe(lotsUntilScarcityAuction(g))
  })
})
