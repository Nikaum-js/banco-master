// Fake in-memory do subconjunto do supabase-js que `supabaseTransport` usa.
//
// Card 6 do review de arquitetura: `supabaseTransport.ts` era o maior `.ts` sem teste do
// repositório (196 linhas) — e é o adapter que roda em PRODUÇÃO. O único caminho que o
// exercitava era `scripts/net-smoke.ts`, manual, contra infra viva e fora da suíte.
//
// Nada disso era necessário: `SupabaseLike`/`SupabaseChannelLike` (supabaseTransport.ts:24-39)
// já foram desenhadas como interfaces ESTRUTURAIS, justamente para o build não depender do
// pacote. O mesmo desenho torna o adapter testável sem rede — só faltava o fake.
//
// 041 (D14): ganhou faltas injetáveis — queda/restauração de CANAL (sem takeover, o cenário
// do defeito 1), recusa de gravação/leitura e a guarda monotônica que o trigger SQL também
// aplica em produção. Sem os equivalentes aqui, a conformidade prova uma garantia que o
// adapter real não tem — exatamente como `takeover` divergiu uma vez entre os dois adapters.
import type { SupabaseChannelLike, SupabaseLike } from '@/net/supabaseTransport'

type BroadcastCb = (msg: { payload: unknown }) => void
type PresenceCb = (payload: { key: string; newPresences?: unknown[]; leftPresences?: unknown[] }) => void
type SyncCb = () => void

interface Broker {
  channels: Set<FakeChannel>
  rows: Map<string, Record<string, unknown>>
  writeFailures: number | 'always'
  readFails: boolean
}

class FakeChannel implements SupabaseChannelLike {
  private broadcastCbs = new Map<string, BroadcastCb[]>()
  private joinCbs: PresenceCb[] = []
  private leaveCbs: PresenceCb[] = []
  private syncCbs: SyncCb[] = []
  private statusCb: ((status: string) => void) | undefined
  subscribed = false
  private tracked = false

  private readonly broker: Broker
  readonly key: string
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
  on(type: 'presence', filter: { event: 'sync' }, cb: SyncCb): SupabaseChannelLike
  on(type: 'broadcast' | 'presence', filter: { event: string }, cb: BroadcastCb | PresenceCb | SyncCb): SupabaseChannelLike {
    if (type === 'broadcast') {
      const list = this.broadcastCbs.get(filter.event) ?? []
      list.push(cb as BroadcastCb)
      this.broadcastCbs.set(filter.event, list)
    } else if (filter.event === 'join') {
      this.joinCbs.push(cb as PresenceCb)
    } else if (filter.event === 'leave') {
      this.leaveCbs.push(cb as PresenceCb)
    } else {
      this.syncCbs.push(cb as SyncCb)
    }
    return this
  }

  presenceState(): Record<string, unknown[]> {
    const state: Record<string, unknown[]> = {}
    for (const ch of this.broker.channels) {
      if (ch.tracked) state[ch.key] = [{ uid: ch.key }]
    }
    return state
  }

  private emitSyncAll(): void {
    for (const ch of this.broker.channels) {
      if (!ch.subscribed) continue
      for (const cb of ch.syncCbs) cb()
    }
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
      for (const cb of ch.joinCbs) cb({ key: this.key, newPresences: [{ uid: this.key }] })
    }
    this.emitSyncAll()
    return Promise.resolve({})
  }

  subscribe(cb?: (status: string) => void): SupabaseChannelLike {
    this.subscribed = true
    this.statusCb = cb
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
        for (const cb of ch.leaveCbs) cb({ key: this.key, leftPresences: [{ uid: this.key }] })
      }
      this.emitSyncAll()
    }
    return Promise.resolve({})
  }

  // Falta injetável (041, D14): queda de CANAL — não uma saída de sala. O canal permanece
  // no broker (para `simulateResubscribe` reconectar o MESMO objeto), a presença cai e o
  // status vira 'CHANNEL_ERROR'. É o cenário do defeito 1: reassinatura precisa reanunciar
  // presença, e só a `track()` seguinte (disparada pela produção ao ver 'SUBSCRIBED') faz isso.
  simulateDrop(): void {
    if (!this.subscribed) return
    const wasTracked = this.tracked
    this.subscribed = false
    this.tracked = false
    if (wasTracked) {
      for (const ch of this.broker.channels) {
        if (ch === this || !ch.subscribed) continue
        for (const cb of ch.leaveCbs) cb({ key: this.key, leftPresences: [{ uid: this.key }] })
      }
      this.emitSyncAll()
    }
    this.statusCb?.('CHANNEL_ERROR')
  }

  simulateResubscribe(): void {
    if (this.subscribed) return
    this.subscribed = true
    this.statusCb?.('SUBSCRIBED')
  }
}

export interface FakeSupabase {
  client(uid: string): SupabaseLike
  /** Linhas da tabela `rooms` — para asserir upsert parcial. */
  rows: Map<string, Record<string, unknown>>
  /** O canal MAIS RECENTE assinado com este uid — para simular queda/restauração (041, D14). */
  channelByUid(uid: string): { simulateDrop(): void; simulateResubscribe(): void } | undefined
  /** Recusa a próxima gravação `n` vezes (ou sempre, com `'always'`) — FR-012/013, SC-003. */
  failWrites(n: number | 'always'): void
  /** Recusa a próxima leitura de snapshot/sala — FR-004/005. */
  failRead(fail: boolean): void
}

export function fakeSupabase(): FakeSupabase {
  const broker: Broker = { channels: new Set(), rows: new Map(), writeFailures: 0, readFails: false }

  function consumeWriteFailure(): boolean {
    if (broker.writeFailures === 'always') return true
    if (broker.writeFailures > 0) {
      broker.writeFailures -= 1
      return true
    }
    return false
  }

  return {
    rows: broker.rows,
    channelByUid(uid: string) {
      return [...broker.channels].findLast((ch) => ch.key === uid)
    },
    failWrites(n: number | 'always'): void {
      broker.writeFailures = n
    },
    failRead(fail: boolean): void {
      broker.readFails = fail
    },
    client(uid: string): SupabaseLike {
      return {
        channel(_name: string, opts?: unknown): SupabaseChannelLike {
          const cfg = opts as { config?: { broadcast?: { self?: boolean } } } | undefined
          return new FakeChannel(broker, uid, cfg?.config?.broadcast?.self === true)
        },
        from(table: string) {
          return {
            upsert(row: Record<string, unknown>) {
              if (consumeWriteFailure()) return Promise.resolve({ error: new Error('injected write failure') })
              const id = String(row.id)
              const key = `${table}:${id}`
              const existing = broker.rows.get(key)
              // Guarda monotônica (041, D9) — espelha `0002_snapshot_monotonic.sql`: escrita
              // com `seq` MENOR que o já gravado é NO-OP silencioso, não erro. Estritamente
              // `<`, para não bloquear o upsert parcial de `saveRoom` (que não envia `seq`).
              if (existing && typeof row.seq === 'number' && typeof existing.seq === 'number' && row.seq < existing.seq) {
                return Promise.resolve({ error: null })
              }
              broker.rows.set(key, { ...(existing ?? {}), ...row })
              return Promise.resolve({ error: null })
            },
            select(_cols: string) {
              return {
                eq(_col: string, val: string) {
                  return {
                    maybeSingle() {
                      if (broker.readFails) return Promise.resolve({ data: null as never, error: new Error('injected read failure') })
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
