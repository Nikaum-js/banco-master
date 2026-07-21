// Store raiz da partida (Zustand). Casca com efeito — regra vive nos reducers puros de
// turn/ e economy/, e o DESPACHO vive em `commands.ts`. Estado serializável (princípio VII).
//
// Card 1 do review de arquitetura (2026-07-25): antes deste arquivo ter uma porta só, a
// tabela de despacho existia em três lugares — os 39 métodos daqui, o `switch` de
// `applyCommand` e os 34 mapeamentos à mão de `net/connectStore.ts`. As cópias já haviam
// divergido no único trecho que não era pass-through (`LAND_TRIGGERING`), a ponto de a
// simulação validar um gatilho que a produção não tinha.
//
// O que sobra aqui é o que `applyCommand` deliberadamente NÃO faz (comentário em
// `commands.ts:6`): os TIMERS. Handle de `setTimeout` não é estado serializável, então
// vive fora do jogo e é reconstruído pelo deadline.
import { create } from 'zustand'
import type { GameState } from './turn/types'
import type { TurnCtx } from './turn/turnMachine'
import { applyCommand, type GameAction } from './commands'
import { buildGameCtx, buildInitialGame } from './setup'

// Jogo novo pronto pra jogar: seed + baralhos embaralhados (FR-001). Usado no
// boot e no "Novo jogo" (reset ao fim da partida). A composição vive em `setup.ts`.
// `Date.now()` só aparece AQUI, na borda (044/D3) — nunca dentro de um reducer.
function freshGame(ids: string[]): GameState {
  return buildInitialGame(ids, () => Math.random(), Date.now())
}

export interface GameStore {
  game: GameState
  ctx: TurnCtx
  /**
   * A ÚNICA porta de ação do store. Em single-player aplica o comando localmente; numa
   * sala online, `net/connectStore.ts` a substitui por `client.send` e o estado só muda
   * quando o comando aceito volta pela difusão do host.
   */
  dispatch(action: GameAction): void
  /** Reinicia a partida (fim de jogo → "Novo jogo"). Operação de SESSÃO, não comando. */
  resetGame(): void
}

// Timer dos leilões: handle fora do estado (não-serializável); reconstruído pelo deadline.
let auctionTimer: ReturnType<typeof setTimeout> | null = null
function clearAuctionTimer(): void {
  if (auctionTimer) {
    clearTimeout(auctionTimer)
    auctionTimer = null
  }
}

// Timer do pregão de escassez de terrenos (031) — separado do leilão de propriedade.
let landTimer: ReturnType<typeof setTimeout> | null = null
function clearLandTimer(): void {
  if (landTimer) {
    clearTimeout(landTimer)
    landTimer = null
  }
}

// Contagem de jogadores no boot: 2 por padrão. Sem lobby, o parâmetro de URL
// `?players=2|3|6` é o único gancho para o smoke E2E (036/US3) escolher a contagem.
function initialPlayerIds(): string[] {
  if (typeof window === 'undefined') return ['p1', 'p2']
  const requested = Number(new URLSearchParams(window.location.search).get('players'))
  const count = requested === 3 || requested === 6 ? requested : 2
  return Array.from({ length: count }, (_, i) => `p${i + 1}`)
}

// Comandos que mexem no cronômetro do leilão de PROPRIEDADE (soft-close por lance).
const REARMS_AUCTION = new Set<GameAction['kind']>(['decline-property', 'place-bid', 'pass-bid', 'pause', 'resume'])

// Comandos que mexem no cronômetro do PREGÃO de terrenos. Superconjunto de
// `LAND_TRIGGERING` (commands.ts): lá é a mudança de ESTADO, aqui é só o agendamento.
const REARMS_LAND = new Set<GameAction['kind']>([
  'place-land-bid',
  'close-land-auction',
  'close-land-lots',
  'close-auction',
  'buy-property',
  'finalize',
  'declare-bankruptcy',
  'accept-trade',
  'pause',
  'resume',
])

export const useGameStore = create<GameStore>((set, get) => {
  // (Re)agenda o fechamento do leilão de PROPRIEDADE pelo deadline; respeita pausa.
  // (O leilão de casas — 026 — é evento autônomo de fecho manual, não usa este timer.)
  function rearmAuction(): void {
    clearAuctionTimer()
    const g = get().game
    if (g.paused || g.resolution?.kind !== 'auction') return
    const ms = Math.max(0, g.resolution.auction.deadline - Date.now())
    auctionTimer = setTimeout(() => {
      clearAuctionTimer()
      get().dispatch({ kind: 'close-auction' }) // pelo mesmo caminho: pega o gatilho de escassez
    }, ms)
  }

  // (Re)agenda o fechamento dos lotes do PREGÃO (031) pelo prazo PRÓPRIO de cada lote:
  // dispara no lote que vence primeiro, fecha os expirados e reagenda p/ os demais.
  function rearmLandAuction(): void {
    clearLandTimer()
    const g = get().game
    if (g.paused || !g.landAuction || g.landAuction.lots.length === 0) return
    const soonest = Math.min(...g.landAuction.lots.map((l) => l.deadline))
    const ms = Math.max(0, soonest - Date.now())
    landTimer = setTimeout(() => {
      clearLandTimer()
      get().dispatch({ kind: 'close-land-lots', now: Date.now() })
    }, ms)
  }

  return {
    game: freshGame(initialPlayerIds()),
    // Composição do jogo: uma fábrica só, compartilhada com host, cliente e simulação.
    ctx: buildGameCtx(() => Math.random(), () => Date.now()),

    dispatch: (action) => {
      const before = get().game
      const after = applyCommand(before, action, get().ctx)
      if (after === before) return // no-op (FR-009): nem `set`, nem reagendamento
      set({ game: after })
      if (REARMS_AUCTION.has(action.kind)) rearmAuction()
      if (REARMS_LAND.has(action.kind)) rearmLandAuction()
    },

    resetGame: () => {
      clearAuctionTimer()
      clearLandTimer()
      set((st) => ({ game: freshGame(st.game.players.map((p) => p.id)) })) // mesmos jogadores, baralho novo
    },
  }
})
