// Tax Man / Fiscal (012, SRS §13.8) — puro (MUTA o state, que é clone do turno).
// Token do banco: move 1×/turno (chamado em advanceSeat via porta) e, se parar em
// propriedade com dono não hipotecada, debita do dono o aluguel daquela propriedade.
// O valor é REMOVIDO da economia (banco), não vai ao pote (clarify). Catch-up discreto (IV).
import { BOARD } from '@/lib/boardData'
import type { GameState } from '../turn/types'
import { roll, type RNG } from '../turn/dice'
import { ownerOf, isMortgaged } from '../economy/titles'
import { rentDue } from '../economy/rent'
import { isBoycotted } from '../economy/tempEffects'
import { logEvent } from '../log'

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

  // MESMA função de aluguel que a resolução da casa usa — este bloco era uma cópia
  // verbatim de `resolveRentable.ts`, e só aquela tinha teste.
  const amount = rentDue(state, sq.pos, owner, r)

  const ownerP = state.players.find((p) => p.id === owner) // cobra mesmo se for o jogador da vez (§13.8)
  if (!ownerP) return
  const charged = Math.min(ownerP.cash, amount) // banco (removido); paga o que houver (sem negativo)
  ownerP.cash -= charged
  // O FATO, que faltava (D-063). Esta cobrança acontece na PASSAGEM DE TURNO e atinge um dono
  // que quase nunca é o jogador da vez — é a única regra do jogo assim. Sem esta linha, o
  // jogador vê o caixa cair sozinho e não tem nada no histórico para ligar causa e efeito;
  // foi exatamente o que produziu três relatos de bug financeiro distintos. `due` vai junto de
  // `amount` porque a diferença entre os dois é a informação: cobrança truncada por falta de
  // caixa é um fato diferente de cobrança paga por inteiro (§9.1 — o Fiscal não abre dívida).
  logEvent(state, { kind: 'tax-man', who: owner, pos: sq.pos, amount: charged, due: amount })
}
