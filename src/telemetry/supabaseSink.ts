// Adaptador Supabase da porta `Telemetry` (044, T042). Insert-only na tabela nova
// (`supabase/migrations/0003_telemetry_events.sql`) — nunca lê a própria tabela, e a
// política de RLS nem permite (a tabela não tem `select`, data-model §3).
//
// Interface ESTRUTURAL (não importa `@supabase/supabase-js` aqui) pelo mesmo motivo de
// `net/supabaseTransport.ts`: o módulo de telemetria fica testável sem o pacote, e o
// cliente real de produção só precisa satisfazer este subconjunto.
import type { Telemetry, TelemetryEvent } from './port'

export interface TelemetrySupabaseLike {
  from(table: string): {
    insert(row: Record<string, unknown>): PromiseLike<{ error: unknown }>
  }
}

// Linha da tabela — cada evento preenche só as colunas que lhe dizem respeito (data-model
// §3); as demais ficam `null`. `version` vem do build (VITE_COMMIT_SHA), não do evento: não
// é dado de privacidade, é metadado de operação, e por isso fica de fora da união fechada.
function toRow(event: TelemetryEvent): Record<string, unknown> {
  const version = (import.meta.env.VITE_COMMIT_SHA as string | undefined) ?? null
  const base = { kind: event.kind, match_key: event.matchKey, version }
  switch (event.kind) {
    case 'room_created':
      return { ...base, players: null, rounds: null, duration_ms: null, cause: null }
    case 'match_started':
      return { ...base, players: event.players, rounds: null, duration_ms: null, cause: null }
    case 'match_ended':
      return { ...base, players: event.players, rounds: event.rounds, duration_ms: event.durationMs, cause: null }
    case 'match_paused':
      return { ...base, players: null, rounds: null, duration_ms: null, cause: event.cause }
  }
}

export function createSupabaseSink(supabase: TelemetrySupabaseLike): Telemetry {
  return {
    track(event: TelemetryEvent): void {
      // T1/T2 do contrato: nem o `try` (chamada síncrona pode lançar se o cliente estiver
      // mal configurado) nem a promessa (rede fora, RLS, tabela ausente) alcançam quem
      // chamou `track` — sem retentativa, sem fila. Perder um evento é perder um evento.
      try {
        void Promise.resolve(supabase.from('telemetry_events').insert(toRow(event))).then(
          () => {},
          () => {},
        )
      } catch {
        // mesma garantia acima, para o caminho síncrono
      }
    },
  }
}
