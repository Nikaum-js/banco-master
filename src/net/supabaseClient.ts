// Cliente Supabase do app (spec 037) — lê as credenciais do ambiente Vite e monta o
// `supabaseTransport`. A publishable/anon key é pública por design (vai no bundle, protegida
// por RLS). Se o ambiente não estiver configurado, `isSupabaseConfigured()` é false e o app
// segue single-player (nenhum boot multiplayer é forçado).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseTransport, type SupabaseLike } from './supabaseTransport'
import { durableWrites } from './durableWrites'
import type { Transport } from './transport'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey)
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error('Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env')
  }
  client ??= createClient(url, anonKey, { realtime: { params: { eventsPerSecond: 20 } } })
  return client
}

// Transporte Supabase para uma sala. O `as unknown as SupabaseLike` estreita o cliente real
// (tipos amplos/overloaded) para o subconjunto estrutural que o adapter usa.
//
// Já embrulhado em `durableWrites` (041, D8/T019) — este é o ÚNICO ponto de montagem de
// produção; embrulhar em qualquer outro lugar deixa um caminho cru vivo. `onExhausted`/
// `onRecovered` ficam vazios aqui de propósito: quem liga isso à pausa por persistência é
// o host, via `transport.onWriteExhausted`/`onWriteRecovered` (D10) — não há como passar um
// `pause()` do host para dentro desta fábrica, que roda antes do host existir.
export function createSupabaseTransport(roomId: string, token: string): Transport {
  const inner = supabaseTransport(getSupabase() as unknown as SupabaseLike, roomId, token)
  return durableWrites(inner, {
    retries: 5,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    backoff: (attempt) => Math.min(500 * 2 ** (attempt - 1), 8_000),
    onExhausted: () => {},
    onRecovered: () => {},
  })
}

// Falha de infra vira mensagem acionável em vez de rejeição silenciosa. É código Postgres
// e nome de migration — pertence AQUI, junto do adapter, não dentro de um componente React
// (era `OnlineGate.tsx:26`). `createRoomSession` a recebe como opção.
export function describeInfraError(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'object' && e ? JSON.stringify(e) : String(e)
  if (/does not exist|42P01|schema cache/i.test(raw)) {
    return 'A tabela `rooms` não existe no projeto Supabase. Aplique supabase/migrations/0001_rooms_snapshots.sql e recarregue.'
  }
  return `Falha ao conectar na sala: ${raw}`
}
