// Cliente Supabase do app (spec 037/043) — lê as credenciais do ambiente Vite e monta o
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

// Identidade por ABA, só em desenvolvimento (`?multi` na URL). A sessão anônima mora em
// `localStorage`, que é por origem+perfil e compartilhado entre abas — é por isso que abrir
// o link da sala numa segunda aba devolve o MESMO `uid` e reanexa você ao mesmo assento.
// Isso não é defeito: é a mesma persistência que faz o F5 não perder o assento (D-042,
// Princípio VII). `sessionStorage` é por aba e também sobrevive ao F5, então trocar o
// armazenamento dá um jogador por aba sem abrir mão da retomada — perde só o fechar-e-voltar,
// que é justamente o caso que o código de reentrada da 041 (D-033) cobre.
//
// `import.meta.env.DEV` é estático: o ramo inteiro é eliminado no build de produção, então
// não existe caminho em que um deploy troque o armazenamento da sessão.
function devPerTabStorage(): Storage | undefined {
  if (!import.meta.env.DEV) return undefined
  if (typeof window === 'undefined') return undefined
  return new URLSearchParams(window.location.search).has('multi') ? window.sessionStorage : undefined
}

export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error('Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env')
  }
  const storage = devPerTabStorage()
  client ??= createClient(url, anonKey, {
    realtime: { params: { eventsPerSecond: 20 } },
    ...(storage ? { auth: { storage, persistSession: true, autoRefreshToken: true } } : {}),
  })
  return client
}

// Identidade atestada (043, D-042/D1): sessão existente ?? sessão anônima nova. NUNCA um
// valor escolhido pelo participante — é o `sub` do JWT emitido pelo Supabase Auth. Chamada
// ANTES de qualquer transporte subir (contrato §1 de policies.md): `realtime.setAuth()` é
// obrigatório para canal privado, e sem ele a política de tópico recusa a assinatura.
export async function ensureSession(): Promise<{ uid: string }> {
  const supabase = getSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  if (session) return { uid: session.user.id }
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return { uid: data.user!.id }
}

// Transporte Supabase para uma sala. O `as unknown as SupabaseLike` estreita o cliente real
// (tipos amplos/overloaded) para o subconjunto estrutural que o adapter usa.
//
// 043 (D1): assíncrona — `ensureSession()` primeiro, `realtime.setAuth()` depois, SÓ ENTÃO o
// canal sobe. O `uid` que o transporte carrega vem da sessão atestada, nunca de um parâmetro
// escolhido pelo chamador (`roomSession.ts` não sabe mais quem o participante é até este
// factory devolver — é o transporte que informa a sessão, não o contrário).
//
// Já embrulhado em `durableWrites` (041, D8/T019) — este é o ÚNICO ponto de montagem de
// produção; embrulhar em qualquer outro lugar deixa um caminho cru vivo. `onExhausted`/
// `onRecovered` ficam vazios aqui de propósito: quem liga isso à pausa por persistência é
// o host, via `transport.onWriteExhausted`/`onWriteRecovered` (D10) — não há como passar um
// `pause()` do host para dentro desta fábrica, que roda antes do host existir.
export async function createSupabaseTransport(roomId: string): Promise<Transport> {
  const supabase = getSupabase()
  const { uid } = await ensureSession()
  await supabase.realtime.setAuth() // obrigatório para canal privado (contrato §1 de policies.md)
  const inner = supabaseTransport(supabase as unknown as SupabaseLike, roomId, uid)
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
  if (/anonymous.*(disab|not allow)|anonymous_provider_disabled/i.test(raw)) {
    return 'Sessões anônimas estão desabilitadas neste projeto Supabase. Habilite em Authentication → Providers → Anonymous Sign-In e recarregue.'
  }
  if (/does not exist|42P01|schema cache/i.test(raw)) {
    return 'A tabela `rooms` não existe no projeto Supabase. Aplique supabase/migrations/0001_rooms_snapshots.sql e recarregue.'
  }
  return `Falha ao conectar na sala: ${raw}`
}
