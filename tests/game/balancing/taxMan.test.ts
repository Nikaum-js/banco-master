import { describe, it, expect } from 'vitest'
import { rollTaxMan } from '@/game/balancing/taxMan'
import { rollDice, resolvePending, finalizeTurn } from '@/game/turn/turnMachine'
import { createSeedState, defaultPorts } from '@/game/store'
import type { GameState } from '@/game/turn/types'
import type { TurnCtx } from '@/game/turn/turnMachine'
import type { RNG } from '@/game/turn/dice'
import { BOARD } from '@/lib/boardData'
import { rngFromDice } from '../turn/_helpers'

// Posiciona o Fiscal para que um movimento (d0+d1) o leve a `target`; devolve o rng do roll.
function fiscalTo(g: GameState, target: number, d0: number, d1: number): RNG {
  g.taxManPos = (target - (d0 + d1) + BOARD.length) % BOARD.length
  return rngFromDice([d0, d1])
}

const AIRPORT = BOARD.find((s) => s.kind === 'airport')!.pos
const UTILITY = BOARD.find((s) => s.kind === 'utility')!.pos

// ctx com o Fiscal ligado (no jogo real o store injeta; defaultPorts não tem).
function taxCtx(rng: RNG): TurnCtx {
  return { rng, ports: { ...defaultPorts, taxMan: (s, r) => rollTaxMan(s, r) } }
}

describe('Tax Man — rollTaxMan (US1)', () => {
  it('SC-001: para em cidade com dono → debita o aluguel; valor removido (ninguém creditado)', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[3].ownerId = 'p2' // Veneza (brown, rent 4); p2 possui 1 do grupo → base
    const potBefore = g.centerPot
    rollTaxMan(g, fiscalTo(g, 3, 1, 2)) // move 3 → cai na pos 3
    expect(g.taxManPos).toBe(3)
    expect(g.players[1].cash).toBe(2000 - 4) // dono debitado
    expect(g.players[0].cash).toBe(2000) // ninguém creditado
    expect(g.centerPot).toBe(potBefore) // não foi ao pote
  })

  it('SC-002: sem dono / hipotecada / não-propriedade → sem efeito', () => {
    const semDono = createSeedState(['p1', 'p2'])
    rollTaxMan(semDono, fiscalTo(semDono, 3, 1, 2)) // pos 3 livre
    expect(semDono.players[1].cash).toBe(2000)

    const hipo = createSeedState(['p1', 'p2'])
    hipo.titles[3].ownerId = 'p2'
    hipo.titles[3].mortgaged = true
    rollTaxMan(hipo, fiscalTo(hipo, 3, 1, 2))
    expect(hipo.players[1].cash).toBe(2000)

    const canto = createSeedState(['p1', 'p2'])
    rollTaxMan(canto, fiscalTo(canto, 12, 6, 6)) // cai na Prisão (canto) → sem efeito
    expect(canto.taxManPos).toBe(12)
    expect(canto.players[1].cash).toBe(2000)
  })

  it('SC-004: cobra mesmo a propriedade do dono (sem isenção)', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[3].ownerId = 'p1'
    rollTaxMan(g, fiscalTo(g, 3, 1, 2))
    expect(g.players[0].cash).toBe(2000 - 4)
  })

  it('dono sem caixa → debita o que houver (sem negativo)', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[3].ownerId = 'p2'
    g.players[1].cash = 3 // < aluguel 4
    rollTaxMan(g, fiscalTo(g, 3, 1, 2))
    expect(g.players[1].cash).toBe(0)
  })

  it('SC-001: aeroporto com Hangar cobra ×2; utilidade usa o valor dos dados do Fiscal', () => {
    const air = createSeedState(['p1', 'p2'])
    air.titles[AIRPORT].ownerId = 'p2'
    air.titles[AIRPORT].hangar = true
    rollTaxMan(air, fiscalTo(air, AIRPORT, 1, 1)) // 1 aeroporto: base 25 → ×2 Hangar = 50
    expect(air.players[1].cash).toBe(2000 - 50)

    const util = createSeedState(['p1', 'p2'])
    util.titles[UTILITY].ownerId = 'p2'
    rollTaxMan(util, fiscalTo(util, UTILITY, 3, 2)) // 1 utilidade: mult 4 × dados(5) = 20
    expect(util.players[1].cash).toBe(2000 - 20)
  })

  it('no-op com partida encerrada ou ≤1 jogador ativo', () => {
    const ended = createSeedState(['p1', 'p2'])
    ended.titles[3].ownerId = 'p2'
    ended.phase = 'ended'
    const pos = (ended.taxManPos = 10)
    rollTaxMan(ended, rngFromDice([1, 2]))
    expect(ended.taxManPos).toBe(pos) // não moveu
    expect(ended.players[1].cash).toBe(2000)

    const solo = createSeedState(['p1', 'p2'])
    solo.players[1].eliminated = true
    solo.titles[3].ownerId = 'p1'
    rollTaxMan(solo, fiscalTo(solo, 3, 1, 2))
    expect(solo.players[0].cash).toBe(2000) // ≤1 ativo → no-op
  })
})

describe('Tax Man — integração no turno (US1)', () => {
  it('SC-003: o Fiscal move 1× ao final do turno (advanceSeat)', () => {
    let g = createSeedState(['p1', 'p2'])
    const ctx = taxCtx(rngFromDice([3, 2])) // jogador rola 3+2; depois o Fiscal rola 3+2
    g = rollDice(g, ctx) // p1: 0→5, sem dupla
    g = resolvePending(g, ctx) // pos 5 livre → resolve (stub)
    expect(g.taxManPos).toBe(0) // ainda não disparou
    g = finalizeTurn(g, ctx) // → advanceSeat → Fiscal move 0→5
    expect(g.activeSeat).toBe(1)
    expect(g.taxManPos).toBe(5)
  })

  it('SC-003/FR-007: re-rolagem de dupla NÃO dispara o Fiscal', () => {
    const g = createSeedState(['p1', 'p2'])
    g.turn.state = 'aguardando-finalizacao'
    g.turn.mayRollAgain = true
    g.taxManPos = 0
    const out = finalizeTurn(g, taxCtx(rngFromDice([3, 2])))
    expect(out.turn.state).toBe('aguardando-rolagem') // mesmo jogador rola de novo
    expect(out.activeSeat).toBe(0)
    expect(out.taxManPos).toBe(0) // Fiscal não moveu (não passou por advanceSeat)
  })
})
