// Event log do jogo (021, SRS §12.3) — puro. Os reducers chamam logEvent nos pontos
// onde a ação acontece; o painel Histórico lê GameState.log. Sem timestamp (motor
// determinístico → recência = ordem). Bounded para não crescer indefinidamente.
//
// LogEntry é união discriminada por `kind` (040/D-032): o motor emite o fato inteiro já
// montado — logEvent não separa kind dos campos porque isso impediria o TS de
// correlacioná-los (contrato §1).
import type { GameState } from './turn/types'
import type { LogEntry } from './economy/types'

const LOG_MAX = 50

export function logEvent(state: GameState, entry: LogEntry): void {
  state.log.push(entry)
  if (state.log.length > LOG_MAX) state.log.shift()
}

// Normaliza log de snapshot persistido ANTES desta fatia (`{ who, what }`, sem `kind`)
// para a variante de compatibilidade `'legacy'` (FR-022, D8 do plan). Roda UMA vez, no
// carregamento (`supabaseTransport.loadSnapshot`) — não em cada consumidor: assim frase,
// som e ícone tratam `'legacy'` pela mesma exaustividade de qualquer outro `kind`.
export function normalizeLog(log: unknown[]): LogEntry[] {
  return log.map((raw) => {
    const e = raw as Partial<LogEntry> & { what?: string }
    if (e.kind) return e as LogEntry
    return { kind: 'legacy', who: e.who ?? 'bank', what: e.what ?? '' }
  })
}
