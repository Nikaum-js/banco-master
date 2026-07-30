// PONTO DE COMPOSIÇÃO ÚNICO do jogo (card 8 do review de arquitetura 2026-07-25).
//
// Antes desta fábrica a fiação existia em QUATRO lugares — `store.ts` (Zustand),
// `ctx.ts` (host/cliente), `tests/sim/engine/driver.ts` (simulação) e
// `tests/game/turn/_helpers.ts` (unitários) — e as cópias divergiam em duas portas:
// o Fiscal (`taxMan`, removido do jogo na D-065) e o Speed Die. A suíte rodava com Speed Die LIGADO e Fiscal
// DESLIGADO, exatamente o inverso da produção.
//
// A regra desta fábrica: **o default é a configuração de produção**. Quem quiser
// menos pede menos, explicitamente, via `overrides`. Um default desonesto faz o teste
// validar um jogo que ninguém joga.
//
// Módulo folha do ponto de vista do React: não importa Zustand nem componente algum,
// então importá-lo NÃO inicia partida nenhuma (ao contrário de `store.ts`, cujo
// `create()` roda no load e lê `window.location.search`).
import { BOARD } from '@/lib/boardData'
import { isRentableKind } from './economy/titles'
import { THEME } from './theme'
import type { GameState, Player } from './turn/types'
import type { Title } from './economy/types'
import type { TurnCtx } from './turn/turnMachine'
import type { TurnPorts } from './turn/resolution'
import type { RNG } from './turn/dice'
import { startTurn } from './turn/turnMachine'
import { economyResolve } from './economy/resolveRentable'
import { goBonus, payToCenter, collectCenter } from './balancing/balancing'
import { chargeLoanInterest } from './emprestimos/emprestimos'
import { tickImmunities } from './economy/imunidade'
import { tickTempEffects } from './economy/tempEffects'
import { deckCardIds } from './cards/catalog'
import { weightedShuffle } from './cards/decks'
import { cardRevealResolve } from './cards/draw'
import { taxBunkerResolve, findReactionCard } from './cards/reacao'

function seedTitles(): Record<number, Title> {
  const titles: Record<number, Title> = {}
  for (const sq of BOARD) {
    if (isRentableKind(sq.kind)) {
      titles[sq.pos] = { ownerId: null, mortgaged: false, houses: 0, hotel: false, hotel2: false, skyscraper: false, hangar: false }
    }
  }
  return titles
}

// Estado inicial determinístico: baralhos na ordem do catálogo, sem embaralhar.
// Quem quer partida de verdade usa `buildInitialGame`, que embaralha com o RNG dado.
//
// `startedAt` é OPCIONAL (default `0`, 044/D3): mais de 50 arquivos de teste chamam
// esta função sem o parâmetro, e `0` é o mesmo sentinela de "sem relógio" que já
// existia implicitamente — a duração da partida vira indisponível, não errada.
export function createSeedState(playerIds: string[], startedAt = 0): GameState {
  const players: Player[] = playerIds.map((id) => ({
    id,
    pos: 0,
    completouPrimeiraVolta: false,
    jail: { inJail: false, attempts: 0 },
    eliminated: false,
    cash: THEME.INITIAL_CASH, // SRS §3.1 (tema)
    hand: [],
    busTickets: 0,
    nextPurchaseDiscount: 0,
  }))
  const state: GameState = {
    players,
    turnOrder: players.map((_, i) => i),
    activeSeat: 0,
    turn: {
      state: 'aguardando-rolagem',
      seat: 0,
      consecutiveDoubles: 0,
      lastRoll: null,
      pendingResolve: false,
      mayRollAgain: false,
      awaitingChoice: null,
    },
    paused: null,
    phase: 'playing',
    titles: seedTitles(),
    resolution: null,
    decks: { acaso: deckCardIds('acaso'), tesouro: deckCardIds('tesouro') },
    centerPot: THEME.PARKING_SEED, // 007 — Free Parking (tema)
    loans: [], // 010 — empréstimos ativos
    pendingLoan: null, // 010 — solicitação aguardando resposta do credor (§15.2)
    immunities: [], // 014 — imunidades de aluguel ativas
    tempEffects: [], // 015 — efeitos temporários de carta
    log: [], // 021 — event log do jogo
    tradeProposals: [], // 047 — propostas simultâneas e independentes
    nextTradeProposalId: 1, // 047 — ids determinísticos no snapshot/replay
    obligations: [], // 051 — obrigações a outro jogador ainda não pagas (§9.1/D-061)
    landAuction: null, // 031/039 — pregão simultâneo (escassez §7.5 ou espólio §9.2); evento autônomo
    landAuctionArmed: true, // 031 — trava de episódio: armado de início (D-060 restaurou)
    tradeHistory: [], // 027 — histórico de trocas aceitas
    notice: null, // 030 — notificação informativa (Free Parking / Aquisição Hostil)
    eliminationOrder: [], // 044 — quedas na ordem em que a falência foi processada
    round: 1, // 044 — a partida começa NA primeira rodada
    startedAt, // 044 — injetado; 0 = sem relógio (partidas de teste)
    endedAt: null, // 044 — gravado por checkEndGame na transição para 'ended'
  }
  startTurn(state)
  return state
}

// Partida nova pronta pra jogar: seed + baralhos embaralhados (FR-001). O resultado
// embaralhado VIVE no snapshot — os clientes o recebem por leitura, não por replay —
// então o embaralho não precisa ser gravado pelo recorder.
//
// `startedAt` OPCIONAL (default `0`, 044/D3) pela mesma razão de `createSeedState`.
export function buildInitialGame(playerIds: string[], rng: RNG, startedAt = 0): GameState {
  const g = createSeedState(playerIds, startedAt)
  // `createSeedState` acabou de popular os dois baralhos com ids REAIS (`deckCardIds`) — é a
  // construção do estado da AUTORIDADE, antes de qualquer perspectiva existir. `weightedShuffle`
  // continua tipada em `string[]` de propósito (043): ela só embaralha carta CONHECIDA, nunca
  // um slot oculto — o cast reflete essa garantia, não a contorna.
  g.decks.acaso = weightedShuffle(g.decks.acaso as string[], rng)
  g.decks.tesouro = weightedShuffle(g.decks.tesouro as string[], rng)
  return g
}

// PORTAS DE PRODUÇÃO. O Fiscal (012) faz parte do produto — deixá-lo de fora do
// default remove metade do dreno econômico do jogo que os testes exercitam.
export function buildPorts(overrides: Partial<TurnPorts> = {}): TurnPorts {
  return {
    onPassGo: (state, id) => goBonus(state, id), // GO (007)
    onPayToCenter: (state, amount) => payToCenter(state, amount), // pote (007)
    onCollectCenter: (state, id) => collectCenter(state, id), // Free Parking (007)
    afterPassGo: (state, id) => {
      // ORDEM LOAD-BEARING: `chargeLoanInterest` pode instalar `resolution.debt`
      // no meio do `advance`, o que bloqueia o `resolvePending` seguinte.
      chargeLoanInterest(state, id) // juros de empréstimo no GO (010)
      tickImmunities(state, id) // expira imunidades por volta do beneficiário (014)
      tickTempEffects(state, id) // expira efeitos temporários por volta do originador (015)
    },
    // 043, D8 — implementação PADRÃO: shift local. No host (decks sempre reais) devolve o
    // id de verdade; num cliente (decks nulos na perspectiva alheia) devolve `null` — o
    // `recordingCtx`/`replayCtx` em `recorder.ts` decide se esse valor é gravado ou substituído
    // pelo reproduzido.
    draw: (state, deckId) => state.decks[deckId].shift() ?? null,
    // 043 — implementação PADRÃO: delega ao mesmo lookup puro que já existia (`findReactionCard`).
    // No host (mão sempre real) devolve a carta de verdade; num cliente que não é o reator
    // (mão oculta) devolve `null` — gravado/reproduzido do mesmo jeito que `draw`.
    hasReaction: (state, playerId, effect) => findReactionCard(state, playerId, effect) ?? null,
    ...overrides,
  }
}

// As portas do produto como constante, para quem só quer "a configuração real".
// Inclui o Fiscal (012): a versão anterior o omitia "p/ não afetar os testes", o que
// tirava metade do dreno econômico do jogo que os testes exercitavam.
export const defaultPorts: TurnPorts = buildPorts()

// CADEIA DE RESOLUÇÃO — a ordem importa: a revelação de carta (025) precisa correr
// antes do Bunker (017), e a economia (003) antes das duas.
export function buildResolve(): NonNullable<TurnCtx['resolve']> {
  return (r) => economyResolve(r) ?? cardRevealResolve(r) ?? taxBunkerResolve(r)
}

export interface GameCtxOptions {
  ports?: Partial<TurnPorts>
  /** Speed Die. Default = `THEME.SPEED_DIE_ENABLED` (hoje false, D-003). */
  speedDie?: boolean
}

// O `TurnCtx` do produto, com o não-determinismo injetado. O host passa RNG/relógio
// REAIS (embrulhados pelo recorder); o cliente passa o replay dos valores gravados;
// o teste passa dados fixos. A CONFIGURAÇÃO é a mesma nos três.
export function buildGameCtx(rng: RNG, now: () => number, opts: GameCtxOptions = {}): TurnCtx {
  return {
    rng,
    ports: buildPorts(opts.ports),
    resolve: buildResolve(),
    now,
    speedDie: opts.speedDie ?? THEME.SPEED_DIE_ENABLED, // D-003 — suspenso: 2 dados
  }
}
