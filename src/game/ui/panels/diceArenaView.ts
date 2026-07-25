// VIEW-MODEL DA ARENA DE DADOS — card 4 do review de arquitetura (2026-07-25).
//
// O padrão `*View.ts` (puro, testável, deep) tinha sido aplicado às 5 telas PEQUENAS e
// pulado nas 4 grandes — exatamente invertido em relação a onde estava o leverage. O
// `DiceArena` era o caso mais agudo: 17 assinaturas do store numa função, cinco delas
// cópias da mesma expressão com um campo final diferente. "De que a arena depende" só se
// respondia lendo 17 linhas, e "a arena está correta" só se respondia jogando.
//
// Aqui está tudo que a tela precisa decidir, como função pura. A affordance NÃO é a
// autoridade: as perguntas de regra são delegadas ao motor (`canUseBusTicket`,
// `purchasePrice`), e a de perspectiva ao `localView` — nenhuma é recomputada.
import { BOARD } from '@/lib/boardData'
import { canUseBusTicket, JAIL_FINE } from '@/game/turn/turnMachine'
import { purchasePrice } from '@/game/economy/purchase'
import type { GameState } from '@/game/turn/types'
import type { LocalView } from '@/net/localView'

export interface DiceArenaView {
  /** Rótulo de estado da vez ("Sua vez", "Preso · tentativa 2/3", "Vez de Ana"…). */
  readonly status: string
  /** Dupla pendente — o rótulo ganha destaque. */
  readonly isDoubleReroll: boolean
  /** Faces dos dois dados brancos (1..6); 1 quando ainda não se rolou. */
  readonly dice: readonly [number, number]
  /** Face do Speed Die, quando houver (D-003: suspenso hoje). */
  readonly speed: number | 'mr-banco' | 'onibus' | null

  readonly canRoll: boolean
  readonly canFinalize: boolean
  readonly canBus: boolean
  readonly canJailDecide: boolean

  /** Compra inline (sem modal) — `null` quando não há proposta de compra aberta. */
  readonly purchase: {
    readonly pos: number
    readonly name: string
    /** Preço de tabela. */
    readonly listPrice: number
    /** O que o jogador PAGA — do motor, já com o Investidor Anjo (006). */
    readonly price: number
    readonly discounted: boolean
    readonly affordable: boolean
  } | null

  /** Multa de prisão, do tema — a UI não recopia o valor. */
  readonly jailFine: number
  readonly canPayJailFine: boolean
}

export interface DiceArenaGates {
  /** Animação do dado em curso — gate que só a casca React conhece. */
  rolling?: boolean
  /**
   * Nome de exibição do jogador da vez. Entra por parâmetro porque a identidade vem da
   * SALA, nunca do `GameState` (D-019 mantém PII fora do estado persistido).
   */
  activeName?: string
}

export function diceArenaView(game: GameState, local: LocalView, gates: DiceArenaGates = {}): DiceArenaView {
  const { rolling = false, activeName } = gates
  const active = game.players[game.turnOrder[game.activeSeat]]
  const turnState = game.turn.state
  const live = game.phase === 'playing' && !game.paused
  const iAct = local.mayAct('roll')

  const lastRoll = game.turn.lastRoll
  const isDoubleReroll = turnState === 'aguardando-rolagem' && game.turn.consecutiveDoubles > 0

  const purchasePos = game.resolution?.kind === 'purchase' ? game.resolution.pos : null
  const purchase = (() => {
    if (purchasePos === null) return null
    const sq = BOARD[purchasePos]
    const listPrice = 'price' in sq ? sq.price : 0
    const price = purchasePrice(game, purchasePos) ?? 0
    return {
      pos: purchasePos,
      name: sq.name,
      listPrice,
      price,
      discounted: price < listPrice,
      affordable: (active?.cash ?? 0) >= price,
    }
  })()

  const status =
    game.phase === 'ended' ? 'Fim de jogo'
    : !iAct ? `Vez de ${activeName ?? active?.id ?? '—'}`
    : isDoubleReroll ? 'Dupla! Role de novo'
    : turnState === 'aguardando-rolagem' ? 'Sua vez'
    : turnState === 'prisao-decisao' ? `Preso · tentativa ${(active?.jail.attempts ?? 0) + 1}/3`
    : turnState === 'casa-a-resolver' ? 'Resolva a jogada'
    : 'Finalize o turno'

  return {
    status,
    isDoubleReroll,
    dice: [lastRoll?.white[0] ?? 1, lastRoll?.white[1] ?? 1],
    speed: lastRoll?.speed ?? null,
    canRoll: iAct && live && turnState === 'aguardando-rolagem' && !rolling,
    canFinalize: live && turnState === 'aguardando-finalizacao',
    canBus: !rolling && canUseBusTicket(game),
    canJailDecide: iAct && live && turnState === 'prisao-decisao' && !rolling,
    purchase,
    jailFine: JAIL_FINE, // do TEMA — `shared.tsx` escrevia 50 à mão em dois lugares
    canPayJailFine: (active?.cash ?? 0) >= JAIL_FINE,
  }
}
