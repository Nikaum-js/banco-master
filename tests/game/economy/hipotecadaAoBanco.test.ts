/**
 * CARD 10 — vender propriedade hipotecada (§6.4, D-062).
 *
 * A investigação obrigatória do card ("negociar com outro jogador, devolver ao banco, ou ambas")
 * teve resposta medida, não escolhida: **negociar já funcionava**. `applyTrade` transfere o
 * título com `mortgaged` intacto e `mortgageFees` cobra do RECEBEDOR a taxa de 10% do §6.3 — os
 * dois primeiros testes abaixo travam esse comportamento preexistente, que não tinha teste
 * próprio. O que não existia era a **devolução ao banco**, e é ela que a D-062 acrescenta.
 */
import { describe, it, expect } from 'vitest'
import { createSeedState, buildPorts } from '@/game/setup'
import { canSellMortgagedToBank, sellMortgagedToBank, transferKeepFee, mortgageValue } from '@/game/economy/mortgage'
import { executeTrade } from '@/game/economy/trade'
import { liquidationValue } from '@/game/falencia/falencia'
import { freeLots } from '@/game/economy/landAuction'
import { applyCommand } from '@/game/commands'
import { canBuild } from '@/game/economy/construction'
import { BOARD } from '@/lib/boardData'
import { ctxWith } from '../turn/_helpers'
import type { GameState } from '@/game/turn/types'

const CIDADE = BOARD.find((sq) => sq.kind === 'property')!.pos
const AEROPORTO = BOARD.find((sq) => sq.kind === 'airport')!.pos

// `applyCommand` precisa de `ctx.now` (o gatilho de escassez calcula prazos de lote).
function ctxComRelogio() {
  return { ...ctxWith([3, 4], { ports: buildPorts() }), now: () => 0 }
}

function comHipotecada(pos = CIDADE): GameState {
  const g = createSeedState(['p1', 'p2'])
  g.titles[pos].ownerId = 'p1'
  g.titles[pos].mortgaged = true
  return g
}

describe('CARD 10 — negociar hipotecada (§6.3, comportamento preexistente)', () => {
  it('a hipoteca ACOMPANHA o título na troca — não desaparece', () => {
    const g = comHipotecada()
    const after = executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [CIDADE], fromCash: 0, toProps: [], toCash: 200 })

    expect(after.titles[CIDADE].ownerId).toBe('p2')
    expect(after.titles[CIDADE].mortgaged).toBe(true) // o ônus segue o título
  })

  it('quem RECEBE a hipotecada paga a taxa de transferência de 10% ao banco (§6.3)', () => {
    const g = comHipotecada()
    const taxa = transferKeepFee(BOARD[CIDADE])
    expect(taxa).toBeGreaterThan(0)

    const after = executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [CIDADE], fromCash: 0, toProps: [], toCash: 200 })

    expect(after.players[0].cash).toBe(g.players[0].cash + 200) // p1 recebeu o dinheiro oferecido
    expect(after.players[1].cash).toBe(g.players[1].cash - 200 - taxa) // p2 pagou oferta + ônus
  })
})

describe('CARD 10 — devolver hipotecada ao banco (§6.4, D-062)', () => {
  it('o dono devolve e NÃO recebe nada; o valor zero é um fato registrado, não um silêncio', () => {
    const g = comHipotecada()
    const antes = g.players[0].cash

    const after = sellMortgagedToBank(g, CIDADE)

    expect(after.players[0].cash).toBe(antes) // zero: a metade do preço já foi paga na hipoteca
    expect(after.log.at(-1)).toEqual({ kind: 'sell-to-bank', who: 'p1', pos: CIDADE, amount: 0 })
  })

  it('a propriedade volta a ser TERRENO LIVRE — sem dono, sem hipoteca, sem Hangar', () => {
    const g = comHipotecada(AEROPORTO)
    g.titles[AEROPORTO].hangar = true

    const after = sellMortgagedToBank(g, AEROPORTO)

    expect(after.titles[AEROPORTO]).toMatchObject({ ownerId: null, mortgaged: false, hangar: false, houses: 0, hotel: false })
    expect(freeLots(after)).toContain(AEROPORTO) // conta de novo para a escassez (§7.5)
  })

  it('só a HIPOTECADA: propriedade sem hipoteca não tem venda ao banco (hipotecar já é isso)', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[CIDADE].ownerId = 'p1'

    expect(canSellMortgagedToBank(g, CIDADE)).toBe(false)
    expect(sellMortgagedToBank(g, CIDADE)).toBe(g) // no-op por identidade
  })

  it('não se devolve propriedade alheia, nem fora da própria vez', () => {
    const g = comHipotecada()
    g.activeSeat = 1 // vez de p2; a hipotecada é de p1

    expect(canSellMortgagedToBank(g, CIDADE)).toBe(false)
    expect(sellMortgagedToBank(g, CIDADE)).toBe(g)
  })

  it('destrava a construção do país — o ganho real da regra (§6.1)', () => {
    const g = createSeedState(['p1', 'p2'])
    const cidadeSq = BOARD[CIDADE]
    if (cidadeSq.kind !== 'property') throw new Error('CIDADE precisa ser uma propriedade de cidade')
    const grupo = BOARD.filter((sq) => sq.kind === 'property' && sq.group === cidadeSq.group)
    for (const sq of grupo) g.titles[sq.pos].ownerId = 'p1'
    g.titles[CIDADE].mortgaged = true
    const outra = grupo.find((sq) => sq.pos !== CIDADE)!.pos
    g.players[0].cash = 5_000

    // §6.1: uma hipotecada congela a construção do grupo inteiro, inclusive nas quitadas.
    expect(canBuild(g, outra)).toBe(false)

    const after = sellMortgagedToBank(g, CIDADE)

    expect(canBuild(after, outra)).toBe(true)
  })

  it('BLOQUEADA com dívida do próprio jogador: é o que impede a porta dos fundos da falência', () => {
    const g = comHipotecada()
    g.resolution = { kind: 'debt', amount: 900, creditorId: 'p2', debtorId: 'p1', cause: 'rent' }
    const capacidadeAntes = liquidationValue(g, 'p1')

    expect(canSellMortgagedToBank(g, CIDADE)).toBe(false)
    expect(sellMortgagedToBank(g, CIDADE)).toBe(g)
    expect(liquidationValue(g, 'p1')).toBe(capacidadeAntes) // o credor não é lesado
  })

  it('dívida de OUTRO jogador não trava quem não deve nada', () => {
    const g = comHipotecada()
    g.resolution = { kind: 'debt', amount: 900, creditorId: 'p2', debtorId: 'p2', cause: 'obligation' }

    expect(canSellMortgagedToBank(g, CIDADE)).toBe(true)
  })

  it('pausa e fim de partida bloqueiam, como toda ação de jogo', () => {
    const pausado = comHipotecada()
    pausado.paused = { causes: ['disconnect'], since: 0 } as GameState['paused']
    expect(canSellMortgagedToBank(pausado, CIDADE)).toBe(false)

    const encerrado = comHipotecada()
    encerrado.phase = 'ended'
    expect(canSellMortgagedToBank(encerrado, CIDADE)).toBe(false)
  })

  it('conservação: devolver ao banco não cria nem destrói dinheiro na mesa', () => {
    const g = comHipotecada()
    const totalAntes = g.players.reduce((s, p) => s + p.cash, 0) + g.centerPot

    const after = sellMortgagedToBank(g, CIDADE)

    expect(after.players.reduce((s, p) => s + p.cash, 0) + after.centerPot).toBe(totalAntes)
  })

  it('reduz o valor de liquidação exatamente pelo que o título valia hipotecado — e nada mais', () => {
    const g = comHipotecada()
    // Título hipotecado NÃO entra em `liquidationValue` (já não pode ser hipotecado de novo),
    // então devolvê-lo não muda a capacidade de pagamento. É por isso que a trava de dívida é
    // sobre a INTENÇÃO (evitar a manobra) e não sobre um delta aritmético.
    const antes = liquidationValue(g, 'p1')
    const after = sellMortgagedToBank(g, CIDADE)
    expect(liquidationValue(after, 'p1')).toBe(antes)
    expect(mortgageValue(BOARD[CIDADE])).toBeGreaterThan(0)
  })

  it('o comando `sell-to-bank` reavalia a escassez de terrenos (§7.5) e pode ABRIR o pregão', () => {
    const g = comHipotecada()
    // Tabuleiro inteiro com dono: zero terrenos livres, nada a leiloar. A devolução cria o
    // primeiro terreno livre — e com 1 ≤ 3 e o episódio armado, o gatilho do §7.5 dispara.
    for (const sq of BOARD) if ('price' in sq && sq.pos !== CIDADE) g.titles[sq.pos].ownerId = 'p2'
    expect(freeLots(g)).toHaveLength(0)
    expect(g.landAuctionArmed).toBe(true)

    const after = applyCommand(g, { kind: 'sell-to-bank', pos: CIDADE }, ctxComRelogio())

    expect(after.titles[CIDADE].ownerId).toBe(null)
    expect(after.landAuction?.lots.map((l) => l.pos)).toEqual([CIDADE])
    expect(after.landAuction?.origin).toBe('scarcity')
    expect(after.landAuctionArmed).toBe(false) // dispara 1×/episódio
  })

  it('com o episódio já gasto, a devolução não reabre o pregão — só volta a contar', () => {
    const g = comHipotecada()
    for (const sq of BOARD) if ('price' in sq && sq.pos !== CIDADE) g.titles[sq.pos].ownerId = 'p2'
    g.landAuctionArmed = false // já disparou nesta descida

    const after = applyCommand(g, { kind: 'sell-to-bank', pos: CIDADE }, ctxComRelogio())

    expect(freeLots(after)).toEqual([CIDADE])
    expect(after.landAuction).toBeNull()
  })
})
