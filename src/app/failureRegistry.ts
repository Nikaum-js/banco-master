// Registro de falha contida (spec 042, FR-016..018). O que o navegador já oferece basta
// (Assumptions do spec) — sem serviço externo, sem persistência nova. A forma é
// DELIBERADAMENTE estreita: só aceita primitivos + `unknown` pro erro, nunca `GameState`/
// `Room`/mão de cartas — a ausência de PII é garantida pela ASSINATURA, não por filtro depois.
export interface FailureContext {
  /** Onde a falha foi contida — 'match' | 'root' | 'accessory:<label>' | 'host.accept' | 'window'. */
  where: string
  /** Fase da sessão no instante da falha, quando conhecida (fase de `RoomSession`, status da sala). */
  phase?: string | null
  /** Sequência de estado no instante da falha, quando conhecida (seq do host/client). */
  seq?: number | null
  error: unknown
}

export interface FailureRegistryOptions {
  now?(): number
  mintId?(): string
}

export interface FailureRecord {
  occurrenceId: string
  where: string
  phase: string | null
  seq: number | null
  message: string
  at: number
}

function defaultMintId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// Ponto de assinatura ADITIVO (044, T048): quem quiser saber de toda falha registrada (o
// Sentry, em `telemetry/sentry.ts`) assina aqui. A 042 continua sendo a ÚNICA fonte do
// `occurrenceId` — isto não muda contenção, loop-breaker nem tela de falha, só ganha um
// ouvinte a mais. Um ouvinte quebrado nunca pode calar o registro local (console.error
// roda de qualquer jeito, ANTES de qualquer callback).
const listeners = new Set<(record: FailureRecord) => void>()

export function onFailure(cb: (record: FailureRecord) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Registra e devolve o identificador curto (FR-017) — utilizável para relatar sem console. */
export function registerFailure(ctx: FailureContext, opts: FailureRegistryOptions = {}): string {
  const now = opts.now ?? Date.now
  const mintId = opts.mintId ?? defaultMintId
  const occurrenceId = mintId()
  const record: FailureRecord = {
    occurrenceId,
    where: ctx.where,
    phase: ctx.phase ?? null,
    seq: ctx.seq ?? null,
    message: messageOf(ctx.error),
    at: now(),
  }
  console.error('[banco-master:failure]', record)
  for (const cb of listeners) {
    try {
      cb(record)
    } catch {
      // um ouvinte quebrado (ex.: SDK de monitoramento fora do ar) não pode derrubar o
      // registro de falha em si — a garantia central deste arquivo.
    }
  }
  return occurrenceId
}
