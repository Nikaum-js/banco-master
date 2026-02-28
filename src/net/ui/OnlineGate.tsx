// Boot do multiplayer (spec 037, T018). Envolve o app: SEM `?host=1`/`?room=<id>` na URL,
// renderiza o jogo single-player intocado (SC-007). Com eles, monta a sala online e só
// devolve o jogo quando o `GameState` da partida chegou.
//
// Papéis (D-020): quem cria a sala é o host — a ÚNICA autoridade — e roda `createHost` no
// próprio browser, ao lado do `client` que alimenta a UI. Convidados rodam só o `client`.
//
// Card 5 do review de arquitetura: a ORQUESTRAÇÃO saiu daqui para `net/roomSession.ts`
// (máquina de fases, decisão de autoridade, escada de entrada, regra de reconexão). O que
// resta é o que de fato é React: ler a URL, assinar a sessão e escolher a tela.
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { connectMultiplayer } from '@/net/connectStore'
import { hostSeat, type PieceId } from '@/net/room'
import { parseRoomLink, roomLink } from '@/net/session'
import { createRoomSession, type RoomSession } from '@/net/roomSession'
import { createSupabaseTransport, describeInfraError, isSupabaseConfigured } from '@/net/supabaseClient'
import { IdentityForm, LobbyMessage, ReentryForm, RoomLobby, TurnOrderReveal } from './LobbyScreen'
import { HomeScreen } from './HomeScreen'
import { SessionBadge } from './SessionBadge'
import { Button } from '@/game/ui/primitives'

const TICK_MS = 250 // o host fecha prazos vencidos (soft-close de leilão, janela de reação)

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

function OnlineRoom({ roomId, children }: { roomId: string | null; children: ReactNode }) {
  const [session] = useState<RoomSession>(() =>
    createRoomSession({
      createTransport: createSupabaseTransport, // a seam: em teste, entra o hub in-memory
      connectStore: connectMultiplayer,
      describeError: describeInfraError,
    }),
  )
  const state = useSyncExternalStore(session.subscribe, session.getState)
  const entered = useRef(false)

  // Entrada por link (convidado OU host reabrindo). O guard sobrevive ao StrictMode.
  useEffect(() => {
    if (!roomId || entered.current) return
    entered.current = true
    void session.enter(roomId)
  }, [roomId, session])

  // Prazos em voo são fechados pelo host (congelam sozinhos na pausa — FR-017).
  useEffect(() => {
    const id = setInterval(() => session.tick(), TICK_MS)
    return () => clearInterval(id)
  }, [session])

  // Soltar assinaturas e o store ao desmontar é seguro; DERRUBAR A CONEXÃO não é. Em dev, o
  // StrictMode monta → desmonta → remonta: o cleanup fechava o canal recém-aberto e o guard
  // de entrada impedia a reconexão, deixando o convidado preso em "Conectando…" para sempre.
  // A conexão vive enquanto a aba viver. Achado pelo E2E de dois browsers (T036).
  useEffect(() => () => session.dispose(), [session])

  const { phase, room, error, busy } = state

  // Ordem sorteada: mostrada uma vez, antes do primeiro turno (FR-030).
  if (phase === 'order' && room) {
    return <TurnOrderReveal room={room} onDone={session.orderSeen} />
  }

  if (phase === 'playing') {
    return (
      <>
        {children}
        {room && <SessionBadge link={roomLink(room.id, window.location.origin)} />}
      </>
    )
  }

  // Partida em curso, sem assento (041, D-033) — sessão/dispositivo perdido não é mais beco.
  if (phase === 'reentry') {
    return <ReentryForm busy={busy} error={error} onSubmit={(code) => session.requestReentry(code)} />
  }

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
        action={<Button onClick={() => { window.location.search = '' }}>Voltar ao início</Button>}
      />
    )
  }

  if (phase === 'identity') {
    // Criar a sala troca a URL para o link dela — assim um F5 do host cai no fluxo de
    // reentrada e reassume a autoridade (FR-015).
    const createAndHost = (name: string, color: string, piece: PieceId): void => {
      void session.create({ name, color, piece }).then((id) => {
        if (id) window.history.replaceState(null, '', roomLink(id, window.location.origin))
      })
    }
    return roomId ? (
      <IdentityForm
        title="Entrar na sala"
        subtitle="Escolha seu nome e sua cor"
        room={room}
        cta="Entrar"
        busy={busy}
        error={error}
        onSubmit={(name, color, piece) => session.requestSeat({ name, color, piece })}
      />
    ) : (
      <IdentityForm
        title="Criar sala"
        subtitle="Você será o anfitrião da partida"
        room={null}
        cta="Criar sala"
        busy={busy}
        error={error}
        onSubmit={createAndHost}
      />
    )
  }

  if (!room) return <LobbyMessage title="Conectando…" message="Abrindo a sala." />

  return (
    <RoomLobby
      room={room}
      myUid={state.uid ?? ''}
      myReentryCode={state.myReentryCode}
      isHost={hostSeat(room).uid === state.uid}
      link={roomLink(room.id, window.location.origin)}
      starting={busy}
      onStart={() => void session.startMatch()}
      onKick={session.kick}
    />
  )
}
