// Decorator de transporte (041, D8/D-034) — embrulha `saveSnapshot`/`saveRoom` numa fila
// serializada, monotônica, com repetição e sinal de esgotamento. UMA implementação para os
// dois adapters: a alternativa — cada adapter cuidando de si — é como `takeover: false`
// fixo chegou à produção sem que nenhum teste visse (037).
//
// A promessa devolvida por `saveSnapshot`/`saveRoom` do transporte EMBRULHADO resolve assim
// que o pedido entra na fila — não quando a escrita de fato termina (contrato §4). O adapter
// CRU por baixo continua rejeitando em falha; é essa rejeição que este arquivo consome.
import type { PersistedSnapshot, Transport, Unsubscribe } from './transport'
import type { Room } from './room'

export interface DurableWriteOptions {
  retries: number // tentativas por escrita, além da primeira
  sleep(ms: number): Promise<void> // injetado — testes não esperam de verdade
  backoff(attempt: number): number // ms da n-ésima espera
  onExhausted(): void // → host emite pause('persistence')
  onRecovered(): void // → host emite resume('persistence')
}

type PendingWrite = { kind: 'snapshot'; snap: PersistedSnapshot } | { kind: 'room'; room: Room }

export function durableWrites(inner: Transport, opts: DurableWriteOptions): Transport {
  // Uma fila só para as duas operações (não uma por operação): a invariante é "uma escrita
  // em voo POR SALA" — saveSnapshot e saveRoom escrevem a MESMA linha.
  let inFlight = false
  let pending: PendingWrite | null = null // profundidade 1: só a MAIS RECENTE sobrevive
  let lastAckedSeq = -1
  let exhausted = false // episódio de esgotamento em curso — onExhausted já disparou

  // Pub-sub próprio (041, D8/D10) — o adapter CRU nunca emite `onWriteExhausted`/
  // `onWriteRecovered` (são no-op); é este decorator quem os sobrescreve, para o host se
  // ligar à pausa por persistência SEM precisar conhecer `DurableWriteOptions`.
  const exhaustedCbs = new Set<() => void>()
  const recoveredCbs = new Set<() => void>()

  function noteFailure(): void {
    if (exhausted) return
    exhausted = true
    opts.onExhausted()
    for (const cb of exhaustedCbs) cb()
  }

  function noteRecovered(): void {
    if (!exhausted) return
    exhausted = false
    opts.onRecovered()
    for (const cb of recoveredCbs) cb()
  }

  async function performWrite(item: PendingWrite): Promise<void> {
    if (item.kind === 'snapshot') await inner.saveSnapshot(item.snap)
    else await inner.saveRoom(item.room)
  }

  async function runOne(item: PendingWrite): Promise<void> {
    inFlight = true
    let attempt = 0
    for (;;) {
      try {
        await performWrite(item)
        if (item.kind === 'snapshot') lastAckedSeq = Math.max(lastAckedSeq, item.snap.seq)
        noteRecovered()
        break
      } catch {
        attempt += 1
        if (attempt > opts.retries) { noteFailure(); break } // esgotou — FR-015: tratada aqui, não escapa
        await opts.sleep(opts.backoff(attempt))
      }
    }
    inFlight = false

    if (pending) {
      const next = pending
      pending = null
      await runOne(next)
    }
  }

  function request(item: PendingWrite): void {
    if (item.kind === 'snapshot' && item.snap.seq < lastAckedSeq) return // FR-011: sem tentativa
    if (inFlight) { pending = item; return } // coalescing (data-model §5, invariante 2)
    void runOne(item)
  }

  return {
    ...inner,
    saveSnapshot(snap: PersistedSnapshot): Promise<void> {
      request({ kind: 'snapshot', snap })
      return Promise.resolve()
    },
    saveRoom(room: Room): Promise<void> {
      request({ kind: 'room', room })
      return Promise.resolve()
    },

    onWriteExhausted(cb: () => void): Unsubscribe {
      exhaustedCbs.add(cb)
      return () => exhaustedCbs.delete(cb)
    },

    onWriteRecovered(cb: () => void): Unsubscribe {
      recoveredCbs.add(cb)
      return () => recoveredCbs.delete(cb)
    },
  }
}
