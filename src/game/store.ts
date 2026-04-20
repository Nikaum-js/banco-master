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
import { deadlinePlan } from './deadlines'
import { isRentableKind } from './economy/titles'
import type { Title } from './economy/types'
import { BOARD, registerActiveBoardChangeHandler } from '@/lib/boardData'

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

// Um timer para todos os prazos serializáveis. A política de qual evento vence e quando
// mora em `deadlines.ts`; este handle é só o adapter do relógio do browser.
let deadlineTimer: ReturnType<typeof setTimeout> | null = null
function clearDeadlineTimer(): void {
  if (deadlineTimer) {
    clearTimeout(deadlineTimer)
    deadlineTimer = null
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

export const useGameStore = create<GameStore>((set, get) => {
  function rearmDeadlines(): void {
    clearDeadlineTimer()
    const now = Date.now()
    const plan = deadlinePlan(get().game, now)
    const wakeAt = plan.due.length > 0 ? now : plan.next
    if (wakeAt === null) return

    deadlineTimer = setTimeout(() => {
      deadlineTimer = null
      const current = deadlinePlan(get().game, Date.now())
      for (const action of current.due) get().dispatch(action)
      // Um comando pode fechar só parte do Pregão ou abrir outro prazo. Recalcular no estado
      // final também cobre um due que virou no mesmo tick e um comando que terminou em no-op.
      rearmDeadlines()
    }, Math.max(0, wakeAt - now))
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
      rearmDeadlines()
    },

    resetGame: () => {
      clearDeadlineTimer()
      set((st) => ({ game: freshGame(st.game.players.map((p) => p.id)) })) // mesmos jogadores, baralho novo
    },
  }
})

// O tabuleiro pode mudar na home antes de uma sala/partida começar. O estado precisa ganhar
// a mesma forma imediatamente: uma Mina na pos 4 da Fuligem não pode encontrar o `titles[4]`
// ausente que o Atlas semeou para sua casa de imposto. Reconciliar só a FORMA preserva o estado
// que já existe nas posições ainda rentáveis (inclusive snapshots e previews de UI), sem
// transformar uma troca de apresentação em "Novo jogo".
registerActiveBoardChangeHandler(() => {
  const current = useGameStore.getState().game
  const titles: Record<number, Title> = {}
  for (const sq of BOARD) {
    if (!isRentableKind(sq.kind)) continue
    titles[sq.pos] = current.titles[sq.pos] ?? {
      ownerId: null,
      mortgaged: false,
      houses: 0,
      hotel: false,
      hotel2: false,
      skyscraper: false,
      hangar: false,
    }
  }
  useGameStore.setState({ game: { ...current, titles } })
})
