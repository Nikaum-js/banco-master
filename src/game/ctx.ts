// Fábrica do `TurnCtx` de PRODUÇÃO (spec 037) — a mesma configuração de portas/resolve que
// `src/game/store.ts` liga ao Zustand, mas com `rng`/`now` injetáveis. Usada pelo host
// (autoridade) e pelo cliente (replay) da fundação multiplayer, sem duplicar a fiação das
// regras. Não altera nenhuma regra (princípio I) — só reúne o que já existia no store.
import type { GameState } from './turn/types'
import type { TurnCtx } from './turn/turnMachine'
import type { RNG } from './turn/dice'
import { createSeedState } from './store'
import { THEME } from './theme'
import { economyResolve } from './economy/resolveRentable'
import { goBonus, payToCenter, collectCenter } from './balancing/balancing'
import { chargeLoanInterest } from './emprestimos/emprestimos'
import { tickImmunities } from './economy/imunidade'
import { tickTempEffects } from './economy/tempEffects'
import { rollTaxMan } from './balancing/taxMan'
import { cardRevealResolve } from './cards/draw'
import { taxBunkerResolve } from './cards/reacao'
import { weightedShuffle } from './cards/decks'

// Portas do produto (defaultPorts + Fiscal) — idênticas às de `store.ts`.
function buildPorts(): TurnCtx['ports'] {
  return {
    onPassGo: (state, id) => goBonus(state, id),
    onPayToCenter: (state, amount) => payToCenter(state, amount),
    onCollectCenter: (state, id) => collectCenter(state, id),
    isEliminated: () => false,
    onInsolvency: () => {},
    afterPassGo: (state, id) => {
      chargeLoanInterest(state, id)
      tickImmunities(state, id)
      tickTempEffects(state, id)
    },
    taxMan: (s, rng) => rollTaxMan(s, rng),
  }
}

// Monta o ctx de produção com relógio/RNG injetados. O host passa o RNG/relógio REAIS
// (embrulhados pelo recorder); o cliente passa o replay dos valores gravados.
export function buildGameCtx(rng: RNG, now: () => number): TurnCtx {
  return {
    rng,
    ports: buildPorts(),
    resolve: (r) => economyResolve(r) ?? cardRevealResolve(r) ?? taxBunkerResolve(r),
    now,
    speedDie: THEME.SPEED_DIE_ENABLED, // Speed Die suspenso (D-003) — sempre 2 dados
  }
}

// Estado inicial de uma partida em rede: seed + baralhos embaralhados pelo RNG do host. O
// resultado embaralhado VIVE no snapshot (os clientes o recebem por leitura, não por replay),
// então o embaralho não precisa ser gravado. Espelha `freshGame`, mas com RNG injetável.
export function buildInitialGame(playerIds: string[], rng: RNG): GameState {
  const g = createSeedState(playerIds)
  g.decks.acaso = weightedShuffle(g.decks.acaso, rng)
  g.decks.tesouro = weightedShuffle(g.decks.tesouro, rng)
  return g
}
