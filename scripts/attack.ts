// Fase 6 (T040, spec 043) — prova que o SERVIDOR recusa, não só o código. Os seis vetores de
// contracts/policies.md §6, cada um a política correspondente na migration 0003. Nenhum destes
// vetores tem teste headless possível: política de RLS/Realtime não tem tipo, não quebra o
// build e falha em silêncio — é POR ISSO que este script é o critério de aceite (SC-001), não
// um `expect` do vitest.
//
// NÃO entra na suíte do vitest: precisa da migration 0003 aplicada e sessões anônimas
// habilitadas no projeto vivo (T041 — pede confirmação explícita antes). Roda com:
//   bun run scripts/attack.ts
//
// Monta a própria sala de teste com a chave PÚBLICA do bundle (a mesma que vai pro cliente
// real — nada de service role aqui, seria provar a política errada) e a apaga ao terminar.
import { createClient as createSupabase, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (.env)')

const roomId = `attack-${Date.now().toString(36)}`

interface Session {
  client: SupabaseClient
  uid: string
}

// Sessão anônima nova (identidade atestada, D-035) — cada ator do roteiro (anfitrião legítimo,
// espectador legítimo, atacante) é uma conexão própria, exatamente como duas abas de verdade.
async function session(): Promise<Session> {
  const client = createSupabase(url!, key!, { realtime: { params: { eventsPerSecond: 20 } } })
  const { data, error } = await client.auth.signInAnonymously()
  if (error) throw new Error(`signInAnonymously falhou (sessões anônimas habilitadas? T041): ${error.message}`)
  await client.realtime.setAuth()
  return { client, uid: data.user!.id }
}

function subscribeChannel(client: SupabaseClient, topic: string, selfEcho = false) {
  return client.channel(topic, { config: { broadcast: { self: selfEcho }, private: true } })
}

// Espera o canal chegar a 'SUBSCRIBED' (ou falhar) antes de qualquer send/track — sem isso o
// primeiro envio cai no chão por não haver assinatura ainda, e pareceria recusa por engano.
function waitSubscribed(ch: ReturnType<typeof subscribeChannel>): Promise<string> {
  return new Promise((resolve) => {
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve(status)
    })
  })
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

interface Vector {
  n: number
  label: string
  run(ctx: { host: Session; bystander: Session; attacker: Session }): Promise<boolean> // true = recusado
}

const VECTORS: Vector[] = [
  {
    n: 1,
    label: 'comando em nome de assento alheio (escrita em room:<id>:s:<outro uid>)',
    async run({ bystander, attacker }) {
      const topic = `room:${roomId}:s:${bystander.uid}`
      const listener = subscribeChannel(bystander.client, topic)
      let received = false
      listener.on('broadcast', { event: 'cmd' }, () => { received = true })
      await waitSubscribed(listener)

      const spoofer = subscribeChannel(attacker.client, topic)
      await waitSubscribed(spoofer)
      await spoofer.send({ type: 'broadcast', event: 'cmd', payload: { senderId: 'p2', action: { kind: 'roll' } } })
      await wait(1500)

      await listener.unsubscribe()
      await spoofer.unsubscribe()
      return !received
    },
  },
  {
    n: 2,
    label: 'difundir comando aceito em room:<id>:play sem ser a autoridade',
    async run({ bystander, attacker }) {
      const topic = `room:${roomId}:play`
      const listener = subscribeChannel(bystander.client, topic)
      let received = false
      listener.on('broadcast', { event: 'cmd' }, () => { received = true })
      await waitSubscribed(listener)

      const spoofer = subscribeChannel(attacker.client, topic)
      await waitSubscribed(spoofer)
      await spoofer.send({ type: 'broadcast', event: 'cmd', payload: { seq: 999, action: { kind: 'roll' }, resolved: { rng: [], now: [], draws: [], reactions: [] } } })
      await wait(1500)

      await listener.unsubscribe()
      await spoofer.unsubscribe()
      return !received
    },
  },
  {
    n: 3,
    label: 'publicar sala / recusar entrada em room:<id>:lobby sem ser a autoridade',
    async run({ bystander, attacker }) {
      const topic = `room:${roomId}:lobby`
      const listener = subscribeChannel(bystander.client, topic)
      let received = false
      listener.on('broadcast', { event: 'room' }, () => { received = true })
      await waitSubscribed(listener)

      const spoofer = subscribeChannel(attacker.client, topic)
      await waitSubscribed(spoofer)
      await spoofer.send({ type: 'broadcast', event: 'room', payload: { id: roomId, status: 'lobby', seats: [] } })
      await wait(1500)

      await listener.unsubscribe()
      await spoofer.unsubscribe()
      return !received
    },
  },
  {
    n: 4,
    label: 'anunciar presença em nome de outro assento',
    async run({ bystander, attacker }) {
      const topic = `room:${roomId}:s:${bystander.uid}`
      const observer = subscribeChannel(bystander.client, topic)
      const joins: string[] = []
      observer.on('presence', { event: 'join' }, ({ key }) => joins.push(key))
      await waitSubscribed(observer)

      const spoofer = subscribeChannel(attacker.client, topic)
      await waitSubscribed(spoofer)
      await spoofer.track({ uid: bystander.uid }) // finge ser o dono do assento
      await wait(1500)

      const spoofedIn = joins.includes(attacker.uid) || observer.presenceState()[attacker.uid] !== undefined
      await observer.unsubscribe()
      await spoofer.unsubscribe()
      return !spoofedIn
    },
  },
  {
    n: 5,
    label: 'ler ou gravar a linha de uma sala sem ter assento nela',
    async run({ attacker }) {
      const { data: readData } = await attacker.client.from('rooms').select('*').eq('id', roomId)
      const readBlocked = !readData || readData.length === 0

      const { error: writeError } = await attacker.client.from('rooms').update({ status: 'ended' }).eq('id', roomId)
      // RLS em `update` sem política aplicável = 0 linhas afetadas, não necessariamente erro —
      // a leitura de volta (que TAMBÉM está bloqueada) é o que prova que nada mudou.
      const { data: afterRead } = await attacker.client.from('rooms').select('status').eq('id', roomId)
      const writeBlocked = Boolean(writeError) || !afterRead || afterRead.length === 0

      return readBlocked && writeBlocked
    },
  },
  {
    n: 6,
    label: 'listar salas (select sem filtro)',
    async run({ attacker }) {
      const { data } = await attacker.client.from('rooms').select('id').limit(50)
      return !data || data.length === 0
    },
  },
]

async function main(): Promise<void> {
  console.log(`sala de ataque: ${roomId}\n`)

  const host = await session()
  const bystander = await session()
  const attacker = await session()

  // Monta a sala pelo caminho de PRODUTO (insert aberto a qualquer sessão autenticada — quem
  // cria é o anfitrião dela) e um segundo assento legítimo (bystander), para os vetores de
  // "assento alheio" terem um uid real e não o do próprio anfitrião.
  const seats = [
    { playerId: 'p1', uid: host.uid, name: 'Host', color: '#1a1a1a', isHost: true, connected: true, reentryCode: 'AAAAAA' },
    { playerId: 'p2', uid: bystander.uid, name: 'Bystander', color: '#2a2a2a', isHost: false, connected: true, reentryCode: 'BBBBBB' },
  ]
  const { error: insertErr } = await host.client.from('rooms').insert({ id: roomId, status: 'lobby', seats, secrets: {} })
  if (insertErr) throw new Error(`setup falhou (insert em rooms): ${insertErr.message}`)
  console.log('  sala de teste criada (anfitrião + 1 assento legítimo)\n')

  const results: { n: number; label: string; refused: boolean }[] = []
  for (const v of VECTORS) {
    const refused = await v.run({ host, bystander, attacker })
    results.push({ n: v.n, label: v.label, refused })
    console.log(`  ${refused ? '✓ recusado' : '✗ ACEITO — FALHA'}  [${v.n}] ${v.label}`)
  }

  console.log('\nlimpando a sala de teste…')
  await host.client.from('rooms').delete().eq('id', roomId)
  for (const s of [host, bystander, attacker]) await s.client.auth.signOut()

  const passed = results.filter((r) => r.refused).length
  console.log(`\n${passed}/${results.length} vetores recusados`)
  if (passed !== results.length) {
    console.error('\nFALHA: nem todo vetor foi recusado — política não fecha (SC-001).')
    process.exit(1)
  }
  console.log('6/6 — política fecha.')
}

main().catch((e) => {
  console.error('\n✗ ERRO no roteiro:', e instanceof Error ? e.message : e)
  process.exit(1)
})
