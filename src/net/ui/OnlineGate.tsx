// Boot do multiplayer (spec 037, T018). Envolve o app: SEM `?host=1`/`?room=<id>` na URL,
// renderiza o jogo single-player intocado (SC-007). Com eles, monta a sala online sobre o
// `supabaseTransport` e só devolve o jogo quando o `GameState` da partida chegou.
//
// Papéis (D-020): quem cria a sala é o host — a ÚNICA autoridade — e roda `createHost` no
// próprio browser, ao lado do `client` que alimenta a UI. Convidados rodam só o `client`.
// Reabrir o link já assentado re-anexa ao mesmo assento (FR-004); se o assento reaberto for
// o do host, ele reassume a autoridade a partir do snapshot (FR-015).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createClient, type Client } from '@/net/client'
import { connectMultiplayer } from '@/net/connectStore'
import { createHost, type Host } from '@/net/host'
import { hostSeat, seatByToken, type JoinError, type Room } from '@/net/room'
import { createRoom } from '@/net/room'
import { getSessionToken, newRoomId, parseRoomLink, roomLink } from '@/net/session'
import { createSupabaseTransport, isSupabaseConfigured } from '@/net/supabaseClient'
import type { Transport } from '@/net/transport'
import { IdentityForm, LobbyMessage, RoomLobby, TurnOrderReveal } from './LobbyScreen'
import { HomeScreen } from './HomeScreen'
import { Button } from '@/game/ui/primitives'

const TICK_MS = 250 // o host fecha prazos vencidos (soft-close de leilão, janela de reação)

// Falha de infra vira mensagem acionável em vez de rejeição silenciosa. O caso mais provável
// no primeiro deploy é a migration não aplicada (PostgREST devolve 42P01 / "does not exist").
function describeInfraError(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'object' && e ? JSON.stringify(e) : String(e)
  if (/does not exist|42P01|schema cache/i.test(raw)) {
    return 'A tabela `rooms` não existe no projeto Supabase. Aplique supabase/migrations/0001_rooms_snapshots.sql e recarregue.'
  }
  return `Falha ao conectar na sala: ${raw}`
}

type Phase = 'home' | 'identity' | 'lobby' | 'order' | 'playing' | 'error'

export function OnlineGate({ children }: { children: ReactNode }) {
  // A URL é lida uma vez: trocar de sala é recarregar a página.
  const [link] = useState(() => parseRoomLink(window.location.search))
  // `?local=1` (ou o botão "jogar local") entrega o cliente único de sempre — o andaime de
  // desenvolvimento e demonstração segue existindo, intacto (FR-029/SC-007). `?players=N`
  // é o hook de boot do smoke E2E (036): também é partida local e NÃO pode ver a home,
  // senão o gate desta spec quebraria a suíte de ponta a ponta que já existia.
  const [local, setLocal] = useState(() => {
    const q = new URLSearchParams(window.location.search)
    return q.has('local') || q.has('players')
  })

  if (local) return <>{children}</>
  if (!link.roomId && !link.createHost) {
    // Porta de entrada de verdade (FR-021): ninguém precisa saber o que é `?host=1`.
    return (
      <HomeScreen
        onCreate={() => { window.location.search = '?host=1' }}
        onJoin={(roomId) => { window.location.search = `?room=${encodeURIComponent(roomId)}` }}
        onLocal={() => setLocal(true)}
      />
    )
  }
  if (!isSupabaseConfigured()) {
    return (
      <LobbyMessage
        title="Multiplayer indisponível"
        message="Este build não tem Supabase configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Abra sem parâmetros para jogar local."
      />
    )
  }
  return <OnlineRoom roomId={link.roomId}>{children}</OnlineRoom>
}

// Uma aba = UMA conexão: o `client` (visão de UI) e, quando somos o anfitrião, o `host`
// (autoridade) compartilham o mesmo transporte — é assim que o host escuta a si mesmo.
interface Session {
  transport: Transport
  client: Client
}

function OnlineRoom({ roomId, children }: { roomId: string | null; children: ReactNode }) {
  const [token] = useState(getSessionToken) // token de sessão do dispositivo (FR-003), estável na aba
  const sessionRef = useRef<Session | null>(null)
  const hostRef = useRef<Host | null>(null)
  const disconnectStore = useRef<(() => void) | null>(null)
  const booted = useRef(false)

  const [phase, setPhase] = useState<Phase>(roomId ? 'lobby' : 'identity') // sem sala na URL → criar
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState<JoinError | string | null>(null)
  const [busy, setBusy] = useState(false)

  // Espelha o estado do client/host na UI e liga o store quando a partida existe.
  const syncFromClient = useCallback((client: Client) => {
    setRoom(client.room())
    setError(client.joinError())
    const game = client.game()
    if (game) {
      if (!disconnectStore.current) disconnectStore.current = connectMultiplayer(client)
      // Só quem chega no estado INICIAL vê a ordem sorteada; quem reconecta no meio da
      // partida volta direto ao tabuleiro (FR-030 é ritual de início, não de reconexão).
      setPhase((prev) => (prev === 'playing' || client.seq() > 0 ? 'playing' : 'order'))
    } else if (client.playerId()) {
      setPhase('lobby')
    }
  }, [])

  // Abre a conexão da aba: um transporte, um client (e, se formos anfitrião, o host por cima).
  const openSession = useCallback(async (id: string): Promise<Session> => {
    const transport = createSupabaseTransport(id, token)
    const client = createClient(transport)
    const session: Session = { transport, client }
    sessionRef.current = session
    client.subscribe(() => syncFromClient(client))
    await client.join()
    return session
  }, [token, syncFromClient])

  // Assume a autoridade desta sala (host criando, ou host voltando de um F5 — FR-015).
  const takeAuthority = useCallback(async (session: Session, initial: Room) => {
    if (hostRef.current) return
    const host = createHost(session.transport, initial)
    hostRef.current = host
    host.subscribe(() => setRoom(host.room()))
    await host.open()
    setRoom(host.room())
  }, [])

  // Entrada por link (convidado OU host reabrindo): conecta, lê a sala e decide a tela.
  useEffect(() => {
    if (!roomId || booted.current) return
    booted.current = true
    void (async () => {
      try {
        const session = await openSession(roomId)
        const client = session.client

        const current = client.room()
        if (!current) {
          setError('Sala não encontrada — confira o link.')
          setPhase('error')
          return
        }
        if (client.game()?.phase === 'ended') {
          setError('ended') // partida encerrada: o link não reabre a mesa (FR-028)
          setPhase('error')
          return
        }
        const mine = seatByToken(current, token)
        if (mine && hostSeat(current).token === token) await takeAuthority(session, current)
        if (!mine && current.status !== 'lobby') {
          setError('already-started') // FR-005: token desconhecido não entra depois do início
          setPhase('error')
          return
        }
        setRoom(current)
        setPhase(mine ? 'lobby' : 'identity')
        syncFromClient(client)
      } catch (e) {
        setError(describeInfraError(e))
        setPhase('error')
      }
    })()
  }, [roomId, token, syncFromClient, takeAuthority, openSession])

  // Prazos em voo são fechados pelo host (congelam sozinhos na pausa — FR-017).
  useEffect(() => {
    const id = setInterval(() => hostRef.current?.tick(), TICK_MS)
    return () => clearInterval(id)
  }, [])

  // Desligar o store ao desmontar é seguro; DERRUBAR A CONEXÃO não é. Em dev, o StrictMode
  // monta → desmonta → remonta: o cleanup fechava o canal recém-aberto e o guard `booted`
  // impedia a reconexão, deixando o convidado presoLike em "Conectando…" para sempre. A
  // conexão vive enquanto a aba viver — quem a encerra é o `leave()` explícito (sair da sala)
  // ou o próprio browser ao fechar/recarregar. Achado pelo E2E de dois browsers (T036).
  useEffect(() => () => {
    disconnectStore.current?.()
  }, [])

  // Criar sala (host): gera o id, abre a autoridade e troca a URL para o link da sala — assim
  // um F5 do host cai no fluxo de reentrada acima e reassume a autoridade.
  async function createAndHost(name: string, color: string, piece: string): Promise<void> {
    setBusy(true)
    try {
      const id = newRoomId()
      const session = await openSession(id)
      await takeAuthority(session, createRoom(id, { token, name, color, piece }))
      window.history.replaceState(null, '', roomLink(id, window.location.origin))
      setPhase('lobby')
    } catch (e) {
      setError(describeInfraError(e))
      setPhase('error')
    }
    setBusy(false)
  }

  function requestSeat(name: string, color: string, piece: string): void {
    setBusy(true)
    setError(null)
    sessionRef.current?.client.requestJoin({ name, color, piece })
    setTimeout(() => setBusy(false), 400) // resposta chega pelo `onRoom`/`onJoinRejected`
  }

  async function startMatch(): Promise<void> {
    setBusy(true)
    const result = await hostRef.current?.startMatch()
    if (result && !result.ok) setError(result.reason === 'too-few' ? 'São necessários ao menos 2 jogadores.' : result.reason)
    setBusy(false)
  }

  // Ordem sorteada: mostrada uma vez, antes do primeiro turno (FR-030).
  if (phase === 'order' && room) {
    return <TurnOrderReveal room={room} onDone={() => setPhase('playing')} />
  }

  if (phase === 'playing') return <>{children}</>

  if (phase === 'error') {
    const msg =
      error === 'already-started'
        ? 'A partida desta sala já começou. Peça um link novo ao anfitrião.'
        : error === 'ended'
          ? 'Esta partida já terminou. Crie uma sala nova para jogar de novo.'
          : String(error ?? 'Erro desconhecido.')
    return (
      <LobbyMessage
        title="Não foi possível entrar"
        message={msg}
        action={
          <Button onClick={() => { window.location.search = '' }}>Voltar ao início</Button>
        }
      />
    )
  }

  if (phase === 'identity') {
    return roomId ? (
      <IdentityForm
        title="Entrar na sala"
        subtitle="Escolha seu nome e sua cor"
        room={room}
        cta="Entrar"
        busy={busy}
        error={error}
        onSubmit={requestSeat}
      />
    ) : (
      <IdentityForm
        title="Criar sala"
        subtitle="Você será o anfitrião da partida"
        room={null}
        cta="Criar sala"
        busy={busy}
        error={error}
        onSubmit={(name, color, piece) => void createAndHost(name, color, piece)}
      />
    )
  }

  if (!room) return <LobbyMessage title="Conectando…" message="Abrindo a sala." />

  return (
    <RoomLobby
      room={room}
      myToken={token}
      isHost={hostSeat(room).token === token}
      link={roomLink(room.id, window.location.origin)}
      starting={busy}
      onStart={() => void startMatch()}
      onKick={(target) => {
        const r = hostRef.current?.kick(target)
        if (r && !r.ok) setError(r.reason === 'is-host' ? 'O anfitrião não pode se remover.' : String(r.reason))
      }}
    />
  )
}
