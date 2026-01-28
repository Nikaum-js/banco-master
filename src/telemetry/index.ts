// Resolve QUAL adaptador entra atrás da porta `Telemetry` (044, T043 — FR-038/T5/T6 do
// contrato). Ponto de composição único: `net/host.ts`/`net/roomSession.ts` recebem a
// instância já pronta por parâmetro — nenhum dos dois chama isto, nem sabe que existe.
import { isSupabaseConfigured, getSupabase } from '@/net/supabaseClient'
import { nullTelemetry, type Telemetry } from './port'
import { createSupabaseSink, type TelemetrySupabaseLike } from './supabaseSink'

// Overrides injetáveis SÓ para o teste obrigatório 1 provar, sem depender de
// `import.meta.env`/singleton do cliente Supabase, que nenhuma chamada de rede é feita
// quando o ambiente não está configurado — `createSink` fica sem ser chamado nesse caso.
export interface ResolveTelemetryOptions {
  dev?: boolean
  configured?: boolean
  createSink?: () => Telemetry
}

export function resolveTelemetry(opts: ResolveTelemetryOptions = {}): Telemetry {
  // Em DEV, sempre nulo (T6) — mesmo com o ambiente configurado, ninguém quer poluir a
  // tabela de produção rodando `bun dev` na própria máquina.
  const dev = opts.dev ?? import.meta.env.DEV
  if (dev) return nullTelemetry

  const configured = opts.configured ?? isSupabaseConfigured()
  if (!configured) return nullTelemetry // T5: nenhuma requisição sai

  const createSink = opts.createSink ?? (() => createSupabaseSink(getSupabase() as unknown as TelemetrySupabaseLike))
  return createSink()
}
