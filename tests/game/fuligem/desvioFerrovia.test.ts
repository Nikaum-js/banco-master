// D-073 — o Desvio pela Ferrovia embarca UMA vez por turno.
//
// Este arquivo nasce de um exploit em partida real: o jogador embarcava de estação em estação
// infinitamente, no mesmo turno, sem pagar nada. Não era bug de implementação — era a regra sem
// terminador. `canRailHop` exige "estou numa ferrovia minha" + "tenho outra" + "turno aguardando
// finalização", e depois de embarcar as TRÊS voltam a ser verdade: você pousa noutra ferrovia sua
// e o turno retorna ao mesmo estado. Regra cuja pós-condição recria a própria pré-condição é um
// laço, e laço sem contador não termina.
import { describe, expect, it, afterEach } from 'vitest'
import { buildGameCtx, createSeedState } from '@/game/setup'
import { canRailHop, railHop, railHopTargets, startTurn } from '@/game/turn/turnMachine'
import { setActiveBoard, ATLAS_BOARD } from '@/lib/boardData'
import { catalogOf, setActiveRules, DEFAULT_RULES } from '@/lib/mapCatalog'
import type { GameState } from '@/game/turn/types'

const RAILS = [5, 16, 25, 36]
const ctx = buildGameCtx(() => 0, () => 0)

function comFuligem() {
  const c = catalogOf('fuligem')
  setActiveBoard(c.board)
  setActiveRules(c.rules)
}

afterEach(() => {
  setActiveBoard(ATLAS_BOARD)
  setActiveRules(DEFAULT_RULES)
})

/** Jogador com as quatro ferrovias, parado na primeira, turno pronto para embarcar. */
function pronto(): GameState {
  comFuligem()
  const g = createSeedState(['p1', 'p2'])
  for (const pos of RAILS) g.titles[pos].ownerId = g.players[0].id
  g.players[0].pos = RAILS[0]
  g.turn.state = 'aguardando-finalizacao'
  return g
}

describe('Desvio pela Ferrovia — uma vez por turno', () => {
  it('o primeiro embarque é permitido', () => {
    const g = pronto()
    expect(canRailHop(g)).toBe(true)
    expect(railHopTargets(g)).toEqual([16, 25, 36])
  })

  it('depois de embarcar, NÃO pode embarcar de novo no mesmo turno', () => {
    const depois = railHop(pronto(), RAILS[1], ctx)
    expect(depois.players[0].pos).toBe(RAILS[1]) // moveu
    expect(depois.turn.railHopUsed).toBe(true)
    expect(canRailHop(depois)).toBe(false) // a guarda
    expect(railHopTargets(depois)).toEqual([]) // e a UI não oferece botão
  })

  it('o ping-pong infinito do relato não acontece mais', () => {
    // O gesto exato: embarcar, e tentar embarcar de volta. Antes alternava para sempre.
    let g = pronto()
    const visitados: number[] = [g.players[0].pos]
    for (let i = 0; i < 6; i++) {
      const alvo = railHopTargets(g)[0]
      if (alvo === undefined) break
      g = railHop(g, alvo, ctx)
      visitados.push(g.players[0].pos)
    }
    expect(visitados).toHaveLength(2) // partida + UM embarque, e para
  })

  it('embarcar consome a vez ANTES de resolver o destino', () => {
    // A ordem importa: se o consumo viesse depois de `land()`, uma resolução que reentrasse na
    // máquina de turno encontraria a flag ainda falsa e reabriria o laço.
    const depois = railHop(pronto(), RAILS[2], ctx)
    expect(depois.turn.railHopUsed).toBe(true)
  })

  it('turno novo devolve o direito de embarcar', () => {
    const depois = railHop(pronto(), RAILS[1], ctx)
    startTurn(depois)
    expect(depois.turn.railHopUsed).toBe(false)
    depois.turn.state = 'aguardando-finalizacao'
    expect(canRailHop(depois)).toBe(true)
  })

  it('snapshot anterior sem a flag é tratado como ainda não usado', () => {
    const legado = pronto()
    delete (legado.turn as Partial<typeof legado.turn>).railHopUsed
    expect(canRailHop(legado)).toBe(true)
  })

  it('o Atlas não tem a regra: nunca embarca', () => {
    const g = pronto()
    setActiveBoard(ATLAS_BOARD)
    setActiveRules(DEFAULT_RULES)
    expect(canRailHop({ ...g, turn: { ...g.turn, railHopUsed: false } })).toBe(false)
  })
})
