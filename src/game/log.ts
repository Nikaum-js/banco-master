// Event log do jogo (021, SRS §12.3) — puro. Os reducers chamam logEvent nos pontos
// onde a ação acontece; o painel Histórico lê GameState.log. Sem timestamp (motor
// determinístico → recência = ordem). Bounded para não crescer indefinidamente.
//
// LogEntry é união discriminada por `kind` (040/D-032): o motor emite o fato inteiro já
// montado — logEvent não separa kind dos campos porque isso impediria o TS de
// correlacioná-los (contrato §1).
import type { EliminationRecord, GameState } from './turn/types'
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

// Normaliza os quatro campos de fim de jogo (044, data-model §1 — Compatibilidade) para
// snapshot persistido ANTES desta fatia. Mesmo padrão de `normalizeLog`: roda UMA vez, no
// carregamento (`supabaseTransport.loadSnapshot`), com defaults seguros — nunca inventa um
// passado que não foi registrado. `matchSummary` sabe ler o resultado (`partial: true`
// quando falta registro de queda para um eliminado).
//
// Guarda `Array.isArray(g.players)`: só corrige quem PARECE um `GameState` de verdade.
// Sem ela, o spread injetaria os 4 campos em QUALQUER payload que passasse por aqui —
// inclusive o marcador sintético que a suíte de conformidade do Transport usa pra provar
// que `saveRoom` não apaga a partida em andamento (`tests/net/conformance.test.ts`), que
// não é um `GameState` e não deve ganhar campo que nunca pediu.
export function normalizeGame(raw: unknown): Partial<Pick<GameState, 'eliminationOrder' | 'round' | 'startedAt' | 'endedAt' | 'obligations' | 'landAuctionArmed'>> {
  const g = (raw ?? {}) as Partial<GameState>
  if (!Array.isArray(g.players)) return {}
  return {
    eliminationOrder: Array.isArray(g.eliminationOrder) ? (g.eliminationOrder as EliminationRecord[]) : [],
    round: typeof g.round === 'number' ? g.round : 0,
    startedAt: typeof g.startedAt === 'number' ? g.startedAt : 0,
    endedAt: typeof g.endedAt === 'number' ? g.endedAt : null,
    // D-061 — snapshot anterior não tem fila: ausente é `[]`, que é a semântica de antes
    // (obrigação curta era apagada, então nunca havia nada devido).
    obligations: Array.isArray(g.obligations) ? g.obligations : [],
    // D-060 — snapshot gravado entre a D-059 e a D-060 não tem a trava de episódio. Ausente
    // lê-se como `true` (armado), que é o valor de partida nova e o CONSERVADOR: no pior caso
    // o pregão de escassez dispara uma vez a mais, nunca uma a menos.
    landAuctionArmed: typeof g.landAuctionArmed === 'boolean' ? g.landAuctionArmed : true,
  }
}
