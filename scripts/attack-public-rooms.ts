// Spec 054 / FR-047 — vetores reais com a mesma chave publishable do navegador.
// Nenhum `service_role`: o roteiro só prova políticas se estiver sujeito a elas.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY')

interface Actor {
  client: SupabaseClient
  uid: string
}

const roomId = `pub054-${Date.now().toString(36)}`

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') return JSON.stringify(error)
  return String(error)
}

async function actor(): Promise<Actor> {
  const client = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signInAnonymously()
  if (error) throw new Error(messageOf(error))
  return { client, uid: data.user!.id }
}

function seat(
  playerId: string,
  uid: string,
  color: string,
  isHost = false,
): Record<string, unknown> {
  return {
    playerId,
    uid,
    historyId: `history-${playerId}`,
    name: isHost ? 'Host' : `Pessoa ${playerId}`,
    color,
    avatar: 'classic-alive',
    skin: 'careca',
    isHost,
    connected: true,
    openingBid: null,
    bidLocked: false,
    openingRoll: null,
    openingRollStartedAt: null,
    openingRollResolvesAt: null,
    reentryCode: isHost ? 'HOST01' : `CODE${playerId.slice(1).padStart(2, '0')}`,
  }
}

async function rpc(
  who: Actor,
  fn: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const { data, error } = await who.client.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data
}

function ok(label: string, condition: boolean): void {
  console.log(`  ${condition ? '✓' : '✗'} ${label}`)
  if (!condition) throw new Error(`vetor aceito: ${label}`)
}

async function main(): Promise<void> {
  const host = await actor()
  const directory = await actor()
  const listingReader = await actor()
  const attacker = await actor()
  const contenderA = await actor()
  const contenderB = await actor()
  const actors = [host, directory, listingReader, attacker, contenderA, contenderB]
  const hostSeats = [seat('p1', host.uid, '#d9a650', true)]
  let cleanupSeats = hostSeats

  try {
    await rpc(host, 'write_room', {
      room_id: roomId,
      status: 'lobby',
      seats: hostSeats,
      match_generation: 0,
      opening_mode: 'sealed-bid',
      opening_auction: null,
      match_history: [],
    })

    const privateDirectory = await rpc(directory, 'list_public_rooms') as {
      ok: boolean
      listings: unknown[]
    }
    ok('sala privada nunca aparece', privateDirectory.ok && privateDirectory.listings.length === 0)

    const { data: directRooms } = await attacker.client.from('rooms').select('*').limit(50)
    const { data: directListings } = await attacker.client
      .from('public_room_listings')
      .select('*')
      .limit(50)
    const { error: forgedRoomWrite } = await attacker.client
      .from('rooms')
      .update({ status: 'ended' })
      .eq('id', roomId)
    const { error: forgedListingWrite } = await attacker.client
      .from('public_room_listings')
      .update({ is_published: true })
      .eq('room_id', roomId)
    ok(
      'tabelas internas não são enumeráveis nem graváveis',
      (directRooms?.length ?? 0) === 0
        && (directListings?.length ?? 0) === 0
        && forgedRoomWrite !== null
        && forgedListingWrite !== null,
    )

    const forgedPublish = await rpc(attacker, 'publish_public_room', { room_id: roomId }) as {
      ok: boolean
      reason: string
    }
    const forgedUnpublish = await rpc(attacker, 'unpublish_public_room', { room_id: roomId }) as {
      ok: boolean
      reason: string
    }
    const forgedHeartbeat = await rpc(attacker, 'heartbeat_public_room', { room_id: roomId }) as {
      ok: boolean
      reason: string
    }
    ok(
      'publicação, despublicação e heartbeat alheios são recusados',
      !forgedPublish.ok
        && forgedPublish.reason === 'not-host'
        && !forgedUnpublish.ok
        && forgedUnpublish.reason === 'not-host'
        && !forgedHeartbeat.ok
        && forgedHeartbeat.reason === 'not-host',
    )

    const published = await rpc(host, 'publish_public_room', { room_id: roomId }) as {
      ok: boolean
      listingId: string
    }
    ok('host publica', published.ok && Boolean(published.listingId))

    const listed = await rpc(listingReader, 'list_public_rooms') as {
      ok: boolean
      listings: Record<string, unknown>[]
    }
    const item = listed.listings[0]
    const keys = Object.keys(item ?? {}).sort()
    ok('payload usa allowlist exata', JSON.stringify(keys) === JSON.stringify([
      'availableSeats',
      'capacity',
      'createdMinutesAgo',
      'label',
      'listingId',
      'openingMode',
    ]))
    ok(
      'payload não contém credencial privada',
      !/roomId|"seats"|"uid"|"name"|snapshot|reentry|history/i.test(JSON.stringify(item)),
    )

    await rpc(host, 'unpublish_public_room', { room_id: roomId })
    const expired = await rpc(attacker, 'join_public_room', {
      listing_id: published.listingId,
      name: 'Intruso',
      color: '#3b8bd0',
      avatar: 'classic-alive',
      skin: 'careca',
    }) as Record<string, unknown>
    ok('listing expirado não revela roomId', expired.reason === 'unavailable' && !('roomId' in expired))

    const fakeListing = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    for (let attempt = 1; attempt < 10; attempt += 1) {
      await rpc(attacker, 'join_public_room', {
        listing_id: fakeListing,
        name: 'Spam',
        color: '#36dde7',
        avatar: 'classic-alive',
        skin: 'careca',
      })
    }
    const limited = await rpc(attacker, 'join_public_room', {
      listing_id: fakeListing,
      name: 'Spam',
      color: '#36dde7',
      avatar: 'classic-alive',
      skin: 'careca',
    }) as Record<string, unknown>
    ok('11ª tentativa pública é limitada', limited.reason === 'rate-limited' && !('roomId' in limited))

    const occupied = [
      seat('p1', host.uid, '#d9a650', true),
      seat('p2', crypto.randomUUID(), '#3b8bd0'),
      seat('p3', crypto.randomUUID(), '#36dde7'),
      seat('p4', crypto.randomUUID(), '#00bca5'),
      seat('p5', crypto.randomUUID(), '#e77376'),
      seat('p6', crypto.randomUUID(), '#7b9d41'),
      seat('p7', crypto.randomUUID(), '#b665a2'),
    ]
    cleanupSeats = occupied
    await rpc(host, 'write_room', {
      room_id: roomId,
      status: 'lobby',
      seats: occupied,
      match_generation: 0,
      opening_mode: 'sealed-bid',
      opening_auction: null,
      match_history: [],
    })
    const republished = await rpc(host, 'publish_public_room', { room_id: roomId }) as {
      listingId: string
    }

    const identity = (color: string) => ({
      listing_id: republished.listingId,
      name: `Pessoa ${color.slice(-2)}`,
      color,
      avatar: 'classic-alive',
      skin: 'careca',
    })
    const [a, b] = await Promise.all([
      rpc(contenderA, 'join_public_room', identity('#b0a5ff')),
      rpc(contenderB, 'join_public_room', identity('#b0a5ff')),
    ]) as Record<string, unknown>[]
    const winners = [a, b].filter((result) => result.ok === true)
    const refusals = [a, b].filter((result) => result.ok === false)
    ok('última vaga tem um vencedor e uma recusa', winners.length === 1 && refusals.length === 1)

    const preview = await rpc(host, 'room_preview', { room_id: roomId }) as {
      seats: unknown[]
    }
    ok('capacidade permanece em 8', preview.seats.length === 8)

    console.log('\n10/10 vetores do diretório público recusados ou contidos.')
  } finally {
    await rpc(host, 'write_room', {
      room_id: roomId,
      status: 'ended',
      seats: cleanupSeats,
      match_generation: 0,
      opening_mode: 'sealed-bid',
      opening_auction: null,
      match_history: [],
    }).catch(() => undefined)
    await Promise.all(actors.map((item) => item.client.auth.signOut()))
  }
}

main().catch((error) => {
  console.error(`\n✗ ataque público falhou: ${messageOf(error)}`)
  process.exit(1)
})
