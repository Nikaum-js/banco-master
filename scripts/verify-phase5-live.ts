// Fase 6 (T043/T044, spec 043) — prova contra infra REAL do que a suíte headless já prova
// contra o hub in-memory: a mão para de trafegar (perspective-cards.test.ts) e o caminho
// quente não ganha salto de servidor (D9). Sobe 3 conexões Realtime reais, joga uma partida
// curta e mede.
//
// NÃO entra na suíte do vitest: depende de infra viva. Rode com:
//   bun run scripts/verify-phase5-live.ts
import { createClient as createSupabase, type SupabaseClient } from '@supabase/supabase-js'
import { createHost } from '../src/net/host'
import { createClient } from '../src/net/client'
import { supabaseTransport, type SupabaseLike } from '../src/net/supabaseTransport'
import { createRoom, SEAT_COLORS } from '../src/net/room'
import { cardById } from '../src/game/cards/catalog'
import { enumerateActions } from '../tests/sim/engine/actions'
import { pickAction } from '../tests/sim/engine/agent'
import { mulberry32 } from '../tests/sim/engine/rng'
import type { PlayerAction } from '../src/game/commands'
import type { SimSession } from '../tests/sim/engine/driver'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (.env)')

const roomId = `verify5-${Date.now().toString(36)}`

// Identidade atestada (D-035) — cada participante é a PRÓPRIA sessão anônima, nunca um uid
// escolhido pelo script. Sem isto, nenhuma política de 0003 concede nada (todas exigem
// `to authenticated` + `auth.uid()` real).
async function anonSession(): Promise<{ raw: SupabaseClient; uid: string }> {
  // `persistSession: false` — script de um tiro, várias identidades no MESMO processo Node;
  // sem storage isolado por padrão, sessões concorrentes podem se pisar (achado ao depurar
  // T043/T044). Cada cliente mantém a própria sessão só em memória, nunca compartilhada.
  const raw = createSupabase(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 20 } },
  })
  const { data, error } = await raw.auth.signInAnonymously()
  if (error) throw new Error(`signInAnonymously falhou: ${error.message}`)
  await raw.realtime.setAuth()
  return { raw, uid: data.user!.id }
}

const ok = (msg: string) => console.log(`  ✓ ${msg}`)
const fail = (msg: string) => { console.error(`  ✗ ${msg}`); process.exitCode = 1 }

async function until(cond: () => boolean, ms = 15_000): Promise<void> {
  const t0 = Date.now()
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timeout')
    await new Promise((r) => setTimeout(r, 20))
  }
}

async function main(): Promise<void> {
  console.log(`sala: ${roomId}\n`)

  const NAMES = ['Alice', 'Bruno', 'Carla']
  // Sequencial, não `Promise.all` — supabase-js em Node sem storage persistente pode
  // compartilhar estado de sessão entre clientes concorrentes (achado ao depurar T043/T044).
  const sessions: Awaited<ReturnType<typeof anonSession>>[] = []
  for (const _n of NAMES) sessions.push(await anonSession())
  const clients = NAMES.map((name, i) => ({
    uid: sessions[i].uid,
    name,
    raw: sessions[i].raw,
    transport: supabaseTransport(sessions[i].raw as unknown as SupabaseLike, roomId, sessions[i].uid),
  }))

  const hostTransport = clients[0].transport
  const hostClient = createClient(hostTransport)
  await hostClient.join()
  const host = createHost(hostTransport, createRoom(roomId, { uid: clients[0].uid, name: clients[0].name, color: SEAT_COLORS[0] }))
  await host.open()
  ok('anfitrião abriu a sala')

  const guests = clients.slice(1).map((c, i) => ({ ...c, client: createClient(c.transport), color: SEAT_COLORS[i + 1] }))
  for (const g of guests) {
    await g.client.join()
    await g.client.requestJoin({ name: g.name, color: g.color })
  }
  await until(() => guests.every((g) => g.client.playerId() !== null), 30_000)
  ok('3 assentos concedidos pela rede')

  const started = await host.startMatch()
  if (!started.ok) throw new Error(`start falhou: ${started.reason}`)
  const allClients = [{ ...clients[0], client: hostClient }, ...guests]
  await until(() => allClients.every((c) => Boolean(c.client.game())))
  ok('partida iniciada e estado inicial propagado a todos')

  function clientOf(playerId: string) {
    const g = host.game()
    const seat = g.players.find((p) => p.id === playerId)
    if (!seat) throw new Error(`sem jogador ${playerId}`)
    const netSeat = host.room().seats.find((s) => s.playerId === playerId)!
    return allClients.find((c) => c.uid === netSeat.uid)!.client
  }

  // — T043 + T044 num passeio SÓ, jogado por comandos REAIS.
  //
  // A versão anterior forçava o cenário mutando `host.game()` direto (`pos = 2`, `turn.state =
  // 'casa-a-resolver'`, carta plantada no topo do baralho) — técnica emprestada dos testes
  // headless, onde só existe um estado. Contra rede real ela mede o nada: a mutação acontece
  // FORA de qualquer comando, então nenhum cliente a recebe, e o `resolve-pending` seguinte
  // chega a eles sem a pré-condição que o host tinha. Cada cliente o aplica como no-op, avança
  // o `seq` e não sai do lugar — as três asserções de perspectiva passavam a olhar mãos VAZIAS,
  // e a de espectador "passava" por vacuidade. Aqui o estado só muda por comando aceito, que é
  // a única coisa que a spec promete replicar.
  //
  // O relógio que o navegador agenda (`Host.tick` — fecha leilão/lote vencido pelo prazo,
  // emitindo comando de sistema). Sem ele o passeio empaca no primeiro leilão: a resolução
  // fica pendente para sempre, `resolve-pending` é recusado em laço, e o orçamento acaba antes
  // de qualquer carta ser sacada. Não é peculiaridade do roteiro — é uma peça do host que só
  // o hospedeiro roda, e um verificador headless precisa rodá-la igual.
  const ticker = setInterval(() => host.tick(), 250)

  const latenciesMs: number[] = []
  const pickRng = mulberry32(Date.now())
  let maoOwnerId: string | null = null

  // `mao` visível na mão de alguém, na visão da AUTORIDADE (que nunca tem `null`).
  function findMaoOwner(): string | null {
    for (const p of host.game().players) {
      if (p.hand.some((id) => id !== null && cardById(id).mode === 'mao')) return p.id
    }
    return null
  }

  const budgetMs = 240_000
  const t0 = Date.now()
  let discarded = 0
  let exit = 'orçamento esgotado'
  for (let step = 0; Date.now() - t0 < budgetMs && host.game().phase !== 'ended'; step++) {
    if (maoOwnerId === null) maoOwnerId = findMaoOwner()
    // Para assim que houver o que medir E amostra de latência bastante — a carta pode ser
    // jogada ou descartada num passo seguinte, e aí não haveria mais o que verificar.
    if (maoOwnerId !== null && latenciesMs.length >= 10) { exit = 'carta encontrada'; break }
    const points = enumerateActions({ game: host.game() } as unknown as SimSession)
    if (points.length === 0) { exit = 'sem ação possível'; break }
    // Enviesado para o turno ANDAR, não uniforme. O agente da simulação escolhe entre todos os
    // pontos de ação, e a cada turno há dezenas de construir/hipotecar/vender contra um único
    // `roll` — medido, 372 comandos aceitos renderam 6 rolagens e nenhuma carta sacada (os dois
    // baralhos terminaram intactos, 16/16). O que esta verificação precisa é de gente ANDANDO
    // pelo tabuleiro até cair em Acaso/Tesouro; as ações de patrimônio não acrescentam nada ao
    // que se mede aqui (privacidade da carta e latência do caminho quente), e cada uma delas é
    // um comando real de qualquer forma.
    // `finalize` fecha o turno e `roll` abre o seguinte — sem privilegiar os dois, o passeio
    // gasta o turno inteiro em construir/hipotecar/vender e o peão quase não sai do lugar.
    // `resolve-pending` fica DE FORA: durante um leilão ainda no prazo ele é no-op, e preferi-lo
    // prendia o passeio num laço de recusas (medido: 0 comandos aceitos). Quando ele é de fato
    // necessário, `enumerateActions` já o marca como obrigatório, e o ramo acima o pega.
    const ADVANCE = new Set(['roll', 'finalize', 'jail-decision'])
    const mandatory = points.filter((p) => p.mandatory)
    const advancing = points.filter((p) => p.actions.some((a) => ADVANCE.has((a as PlayerAction).kind)))
    const pool = mandatory.length > 0 ? mandatory : advancing.length > 0 ? advancing : points
    const { actorId, action } = pickAction(pickRng, pool)
    const seqBefore = host.seq()
    const sentAt = Date.now()
    clientOf(actorId).send(action as PlayerAction)
    try {
      // 400ms é ~19× a mediana medida (21ms) — folga de sobra para um comando que vai ser
      // aceito, e barato para um que não vai. Um comando descartado (no-op) nunca chega, então
      // esta espera é paga por INTEIRO a cada recusa: com os 10s originais, poucas dezenas de
      // recusas torravam o orçamento e o passeio acabava antes de qualquer carta ser sacada.
      await until(() => host.seq() > seqBefore, 400)
      latenciesMs.push(Date.now() - sentAt)
    } catch {
      discarded++ // comando descartado (não-ator/no-op) — não é falha, só não gera amostra
    }
  }
  console.log(`  passeio: ${latenciesMs.length} aceitos, ${discarded} descartados, fim por "${exit}"`)

  // — T043: privacidade de carta na prática (SC-002) —
  if (!maoOwnerId) {
    fail('nenhuma carta de MÃO chegou a mão nenhuma durante o passeio — T043 não exercitado nesta rodada')
  } else {
    await new Promise((r) => setTimeout(r, 1_500)) // drena a difusão pros três
    const ownerSeat = host.room().seats.find((s) => s.playerId === maoOwnerId)!
    const hostHand = host.game().players.find((p) => p.id === maoOwnerId)!.hand

    for (const c of allClients) {
      const seat = host.room().seats.find((s) => s.uid === c.uid)
      if (!seat) continue
      const view = c.client.game()!.players.find((p) => p.id === maoOwnerId)!.hand
      const named = view.filter((id) => id !== null && cardById(id).mode === 'mao')
      if (seat.playerId === maoOwnerId) {
        // O dono vê a própria carta, e vê a MESMA que a autoridade tem.
        if (named.length > 0) ok(`dono (${maoOwnerId}, uid ${ownerSeat.uid.slice(0, 8)}) vê a própria carta: ${JSON.stringify(named)}`)
        else fail(`dono não viu a própria carta — autoridade tem ${JSON.stringify(hostHand)}, ele vê ${JSON.stringify(view)}`)
      } else if (seat.isHost) {
        // Exceção CONHECIDA e documentada (SRS §10.3, host.ts): o navegador do anfitrião roda a
        // autoridade, então ele já conhece baralho e mãos por construção — redigir a difusão
        // para ele não esconderia nada de quem tem o estado inteiro na memória do mesmo
        // processo. Por isso `host.ts` manda a cópia íntegra também para o assento do
        // anfitrião. Não é o que a SC-002 mede: o que ela mede é o JOGADOR COMUM, abaixo.
        console.log(`  · ${seat.playerId} é o anfitrião — vê ${JSON.stringify(view)} (exceção conhecida, SRS §10.3)`)
      } else if (named.length === 0) {
        // Espectador: nenhuma carta NOMEADA, e comprimento igual — a contagem é pública
        // (§12.3), o conteúdo não. Comparar o comprimento é o que impede este caso de passar
        // por vacuidade, que foi exatamente como ele passava antes.
        if (view.length === hostHand.length) ok(`${seat.playerId} não nomeia a carta de ${maoOwnerId} (vê ${JSON.stringify(view)}, comprimento ${view.length} confere)`)
        else fail(`${seat.playerId} não nomeia, mas o comprimento diverge: vê ${view.length}, autoridade tem ${hostHand.length}`)
      } else {
        fail(`VAZAMENTO: ${seat.playerId} vê ${JSON.stringify(named)} na mão de ${maoOwnerId}`)
      }
    }
  }

  if (latenciesMs.length === 0) {
    fail('nenhum comando aceito durante a medição — SC-004 não verificável nesta rodada')
  } else {
    const sorted = [...latenciesMs].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    console.log(`\n  SC-004: mediana de propagação = ${median}ms sobre ${latenciesMs.length} comandos aceitos`)
    console.log('  (sem baseline "antes da Fase 2" registrado — a spec inteira foi feita numa sessão')
    console.log('   contínua, sem medição intermediária contra infra viva. Verificação por design,')
    console.log('   não por comparação numérica: accept() em host.ts chama só `broadcast`/')
    console.log('   `broadcastPrivate` — as RPCs novas (request_seat/reattach_by_code/room_preview/')
    if (median < 1000) ok('abaixo de 1000ms — dentro da faixa que a 037 já validava (SC-002 daquela spec)')
    else fail('acima de 1000ms')
    console.log('   read_snapshot) vivem em entrar/reconectar/reanexar, fora do caminho de comando.)')
  }

  console.log('\nencerrando a sala de teste…')
  clearInterval(ticker)
  host.stop()
  for (const c of allClients) c.client.leave()
  console.log(`  (linha '${roomId}' fica pra trás — apagar exige a role admin/dashboard, fora do que o cliente pode fazer sob RLS)`)

  if (process.exitCode) {
    console.error('\nFALHOU — ver ✗ acima.')
  } else {
    console.log('\ntudo verde.')
  }
}

main().catch((e) => {
  console.error('\n✗ ERRO no roteiro:', e instanceof Error ? e.message : e)
  process.exit(1)
})
