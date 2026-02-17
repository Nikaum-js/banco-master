// Tax Man / Fiscal (012, SRS §13.8) — puro (MUTA o state, que é clone do turno).
// Token do banco: move 1×/turno (chamado em advanceSeat via porta) e, se parar em
// propriedade com dono não hipotecada, debita do dono o aluguel daquela propriedade.
// O valor é REMOVIDO da economia (banco), não vai ao pote (clarify). Catch-up discreto (IV).
import { BOARD } from '@/lib/boardData'
import type { GameState } from '../turn/types'
import { roll, type RNG } from '../turn/dice'
import { ownerOf, isMortgaged, groupOwnedCount, groupSize, countOwned, groupHasSkyscraper } from '../economy/titles'
import { rentCity, rentAirport, rentUtility, diceValue } from '../economy/rent'
import { apagaoActive, greveActive, isBoycotted } from '../economy/tempEffects'

export function rollTaxMan(state: GameState, rng: RNG): void {
  if (state.phase !== 'playing') return
  if (state.players.filter((p) => !p.eliminated).length <= 1) return

  const r = roll(rng, { speedDie: false }) // 2 dados brancos (sem Speed Die)
  state.taxManPos = (state.taxManPos + r.move) % BOARD.length // movimento PURO (sem GO/prisão/carta)

  const sq = BOARD[state.taxManPos]
  if (sq.kind !== 'property' && sq.kind !== 'airport' && sq.kind !== 'utility') return // outras casas: sem efeito
  const owner = ownerOf(state, sq.pos)
  if (owner === null || isMortgaged(state, sq.pos)) return // livre/hipotecada: sem cobrança
  if (isBoycotted(state, sq.pos)) return // Boicote: não cobra (015, consistência)

  let amount = 0
  if (sq.kind === 'airport') {
    const hangarDobra = state.titles[sq.pos].hangar && !apagaoActive(state) // Apagão desliga a dobra
    amount = rentAirport(countOwned(state, 'airport', owner)) * (hangarDobra ? 2 : 1)
  } else if (sq.kind === 'utility') {
    amount = greveActive(state) ? 0 : rentUtility(countOwned(state, 'utility', owner), diceValue(r)) // Greve zera
  } else {
    const t = state.titles[sq.pos]
    amount = rentCity(
      sq.rent,
      groupOwnedCount(state, sq.group, owner),
      groupSize(sq.group),
      { houses: t.houses, hotel: t.hotel, hotel2: t.hotel2, skyscraper: t.skyscraper },
      groupHasSkyscraper(state, sq.group),
    )
  }

  const ownerP = state.players.find((p) => p.id === owner) // cobra mesmo se for o jogador da vez (§13.8)
  if (ownerP) ownerP.cash -= Math.min(ownerP.cash, amount) // banco (removido); paga o que houver (sem negativo)
}
