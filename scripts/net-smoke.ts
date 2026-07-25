// Smoke de INFRA da spec 037 (T028) — o único caminho que a suíte headless não cobre:
// o `supabaseTransport` real, contra o projeto Supabase de verdade. Sobe um host e um
// convidado em processos-cliente distintos (duas conexões Realtime), monta a sala pela rede,
// inicia a partida e mede a propagação de um comando (SC-002).
//
// NÃO entra na suíte do vitest: depende de infra viva e de rede. Rode com:
//   bun run scripts/net-smoke.ts
import { createClient as createSupabase } from '@supabase/supabase-js'
import { createHost } from '../src/net/host'
import { createClient } from '../src/net/client'
import { supabaseTransport, type SupabaseLike } from '../src/net/supabaseTransport'
import { createRoom, SEAT_COLORS } from '../src/net/room'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (.env)')

const roomId = `smoke-${Date.now().toString(36)}`
const HOST_TOKEN = 'smoke-host'
const GUEST_TOKEN = 'smoke-guest'

const conn = (): SupabaseLike =>
  createSupabase(url, key, { realtime: { params: { eventsPerSecond: 20 } } }) as unknown as SupabaseLike

// Espera uma condição virar verdadeira (ou estoura). Rede real = tudo assíncrono.
async function until(label: string, cond: () => boolean, ms = 15_000): Promise<number> {
  const t0 = Date.now()
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error(`timeout esperando: ${label}`)
    await new Promise((r) => setTimeout(r, 25))
  }
  return Date.now() - t0
}

const ok = (msg: string) => console.log(`  ✓ ${msg}`)

async function main(): Promise<void> {
  console.log(`sala: ${roomId}\n`)

  // — host: autoridade + client próprio sobre a MESMA conexão —
  const hostTransport = supabaseTransport(conn(), roomId, HOST_TOKEN)
  const hostClient = createClient(hostTransport)
  await hostClient.join()
  const host = createHost(hostTransport, createRoom(roomId, { token: HOST_TOKEN, name: 'Host', color: SEAT_COLORS[0] }))
  await host.open()
  ok('host abriu a sala (canal Realtime + linha em `rooms`)')

  // — convidado: outra conexão, pede assento pela rede —
  const guestTransport = supabaseTransport(conn(), roomId, GUEST_TOKEN)
  const guest = createClient(guestTransport)
  await guest.join()
  ok('convidado conectou e leu a sala persistida')

  guest.requestJoin({ name: 'Convidado', color: SEAT_COLORS[1] })
  const joinMs = await until('assento concedido', () => guest.playerId() === 'p2')
  ok(`assento concedido pela rede em ${joinMs}ms (playerId=${guest.playerId()})`)

  // — início: o 1º snapshot vai ao Postgres e todos o leem —
  const started = await host.startMatch()
  if (!started.ok) throw new Error(`start falhou: ${started.reason}`)
  const startMs = await until('estado inicial em ambos', () => Boolean(hostClient.game()) && Boolean(guest.game()))
  ok(`partida iniciada e estado inicial propagado em ${startMs}ms`)

  // — SC-001/SC-002: comando do host propaga e converge —
  const seqBefore = guest.seq()
  const t0 = Date.now()
  hostClient.send({ kind: 'roll' })
  await until('comando difundido ao convidado', () => guest.seq() > seqBefore)
  const propMs = Date.now() - t0
  ok(`comando propagou host→convidado em ${propMs}ms (SC-002: alvo <1000ms p95)`)

  const same = JSON.stringify(hostClient.game()) === JSON.stringify(guest.game())
  if (!same) throw new Error('DIVERGÊNCIA: estado do host ≠ estado do convidado')
  const roll = host.game().turn.lastRoll
  ok(`estados convergiram byte a byte (dados: ${JSON.stringify(roll)})`)

  // — anti-spoof sobre o transporte real: convidado tenta agir como p1 —
  const seqSpoof = host.seq()
  guestTransport.submit({ senderId: 'p1', action: { kind: 'roll' } })
  await new Promise((r) => setTimeout(r, 1200))
  if (host.seq() !== seqSpoof) throw new Error('FALHA: comando forjado foi aceito pelo host')
  ok('comando forjado (convidado dizendo ser p1) descartado pelo host')

  console.log('\ntudo verde. limpando a sala de teste…')
  host.stop()
  hostClient.leave()
  guest.leave()
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('\n✗ FALHOU:', e instanceof Error ? e.message : e)
    process.exit(1)
  })
