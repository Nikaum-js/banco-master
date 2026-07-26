// Fake in-memory do subconjunto do supabase-js que `supabaseTransport` usa.
//
// Card 6 do review de arquitetura: `supabaseTransport.ts` era o maior `.ts` sem teste do
// repositório (196 linhas) — e é o adapter que roda em PRODUÇÃO. O único caminho que o
// exercitava era `scripts/net-smoke.ts`, manual, contra infra viva e fora da suíte.
//
// Nada disso era necessário: `SupabaseLike`/`SupabaseChannelLike` (supabaseTransport.ts:24-39)
// já foram desenhadas como interfaces ESTRUTURAIS, justamente para o build não depender do
// pacote. O mesmo desenho torna o adapter testável sem rede — só faltava o fake.
import type { SupabaseChannelLike, SupabaseLike } from '@/net/supabaseTransport'

type BroadcastCb = (msg: { payload: unknown }) => void
type PresenceCb = (payload: { key: string; newPresences?: unknown[]; leftPresences?: unknown[] }) => void

interface Broker {
  channels: Set<FakeChannel>
  rows: Map<string, Record<string, unknown>>
}

class FakeChannel implements SupabaseChannelLike {
  private broadcastCbs = new Map<string, BroadcastCb[]>()
  private joinCbs: PresenceCb[] = []
  private leaveCbs: PresenceCb[] = []
  private subscribed = false
  private tracked = false

  private readonly broker: Broker
  private readonly key: string
  /** `broadcast.self` — o Realtime só ecoa o próprio envio quando ligado. */
  private readonly selfEcho: boolean

  // Campos declarados e atribuídos à mão: parameter properties não são sintaxe apagável
  // (`erasableSyntaxOnly`), e este arquivo agora passa pelo typecheck junto do resto.
  constructor(broker: Broker, key: string, selfEcho: boolean) {
    this.broker = broker
    this.key = key
    this.selfEcho = selfEcho
  }

  on(type: 'broadcast', filter: { event: string }, cb: (msg: { payload: unknown }) => void): SupabaseChannelLike
  on(type: 'presence', filter: { event: 'join' | 'leave' }, cb: PresenceCb): SupabaseChannelLike
  on(type: 'broadcast' | 'presence', filter: { event: string }, cb: BroadcastCb | PresenceCb): SupabaseChannelLike {
    if (type === 'broadcast') {
      const list = this.broadcastCbs.get(filter.event) ?? []
      list.push(cb as BroadcastCb)
      this.broadcastCbs.set(filter.event, list)
    } else if (filter.event === 'join') {
      this.joinCbs.push(cb as PresenceCb)
    } else {
      this.leaveCbs.push(cb as PresenceCb)
    }
    return this
  }

  send(msg: { type: 'broadcast'; event: string; payload: unknown }): Promise<unknown> {
    if (!this.subscribed) return Promise.resolve({ status: 'not_subscribed' }) // igual ao real: cai no chão
    for (const ch of this.broker.channels) {
      if (ch === this && !this.selfEcho) continue
      if (!ch.subscribed) continue
      for (const cb of ch.broadcastCbs.get(msg.event) ?? []) cb({ payload: msg.payload })
    }
    return Promise.resolve({ status: 'ok' })
  }

  track(): Promise<unknown> {
    if (this.tracked) return Promise.resolve({})
    this.tracked = true
    for (const ch of this.broker.channels) {
      if (!ch.subscribed) continue
      for (const cb of ch.joinCbs) cb({ key: this.key, newPresences: [{ token: this.key }] })
    }
    return Promise.resolve({})
  }

  subscribe(cb?: (status: string) => void): SupabaseChannelLike {
    this.subscribed = true
    this.broker.channels.add(this)
    cb?.('SUBSCRIBED')
    return this
  }

  unsubscribe(): Promise<unknown> {
    const wasTracked = this.tracked
    this.subscribed = false
    this.tracked = false
    this.broker.channels.delete(this)
    if (wasTracked) {
      for (const ch of this.broker.channels) {
        if (!ch.subscribed) continue
        for (const cb of ch.leaveCbs) cb({ key: this.key, leftPresences: [{ token: this.key }] })
      }
    }
    return Promise.resolve({})
  }
}

export interface FakeSupabase {
  client(token: string): SupabaseLike
  /** Linhas da tabela `rooms` — para asserir upsert parcial. */
  rows: Map<string, Record<string, unknown>>
}

export function fakeSupabase(): FakeSupabase {
  const broker: Broker = { channels: new Set(), rows: new Map() }

  return {
    rows: broker.rows,
    client(token: string): SupabaseLike {
      return {
        channel(_name: string, opts?: unknown): SupabaseChannelLike {
          const cfg = opts as { config?: { broadcast?: { self?: boolean } } } | undefined
          return new FakeChannel(broker, token, cfg?.config?.broadcast?.self === true)
        },
        from(table: string) {
          return {
            upsert(row: Record<string, unknown>) {
              // `ON CONFLICT DO UPDATE` toca só as colunas ENVIADAS — é o que permite
              // `saveRoom` não sobrescrever o `game`/`seq` de uma partida em andamento.
              const id = String(row.id)
              const key = `${table}:${id}`
              broker.rows.set(key, { ...(broker.rows.get(key) ?? {}), ...row })
              return Promise.resolve({ error: null })
            },
            select(_cols: string) {
              return {
                eq(_col: string, val: string) {
                  return {
                    maybeSingle() {
                      const row = broker.rows.get(`${table}:${val}`)
                      return Promise.resolve({ data: (row ?? null) as never, error: null })
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }
}
