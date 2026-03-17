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
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { connectMultiplayer } from '@/net/connectStore'
import { hostSeat } from '@/net/room'
import { parseRoomLink, roomLink } from '@/net/session'
import { createRoomSession, type RoomSession } from '@/net/roomSession'
import { setActiveSession } from '@/net/activeSession'
import { MatchErrorBoundary } from '@/app/MatchErrorBoundary'
import {
  createSupabaseTransport,
  describeInfraError,
  describeSupabaseConfiguration,
  getPublicRoomGateway,
  isSupabaseConfigured,
} from '@/net/supabaseClient'
import { resolveTelemetry } from '@/telemetry'
import {
  IdentityForm,
  LobbyMessage,
  OpeningAuction,
  OpeningRolls,
  ReentryForm,
  RoomLobby,
  TurnOrderReveal,
} from './LobbyScreen'
import { HomeScreen } from './HomeScreen'
import { SessionBadge } from './SessionBadge'
import { Button } from '@/game/ui/primitives'
import { OrientationGate } from '@/game/ui/OrientationGate'
import type { AvatarId } from '@/boards/playerAvatarCatalog'
import type { SkinId } from '@/boards/playerSkinCatalog'
import { recallRoomPreset, rememberRoomPreset } from '@/net/roomPresets'
import { PublicRoomControl } from './PublicRoomControl'
import type { PublicRoomGateway } from '@/net/publicRoomDirectory'
import type { Telemetry } from '@/telemetry/port'

const TICK_MS = 250 // o host fecha prazos vencidos (soft-close de leilão, janela de reação)

export function OnlineGate({ children }: { children: ReactNode }) {
  const [link, setLink] = useState(() => parseRoomLink(window.location.search))
  const [telemetry] = useState(() => resolveTelemetry())
  // `?local=1` (ou o botão "jogar local") entrega o cliente único de sempre — o andaime de
  // desenvolvimento e demonstração segue existindo, intacto (FR-029/SC-007). `?players=N`
  // é o hook de boot do smoke E2E (036): também é partida local e NÃO pode ver a home,
  // senão o gate desta spec quebraria a suíte de ponta a ponta que já existia.
  const [local, setLocal] = useState(() => {
    const q = new URLSearchParams(window.location.search)
    return q.has('local') || q.has('players')
  })
  const navigateEntry = useCallback((search: string) => {
    window.history.pushState(null, '', `${window.location.pathname}${search}`)
    setLink(parseRoomLink(search))
  }, [])

  // Back/forward continua sendo navegação real, mas sem recarregar todo o bundle nem
  // reconstruir a home antes da próxima tela de entrada.
  useEffect(() => {
    const syncRoute = () => {
      const search = window.location.search
      const query = new URLSearchParams(search)
      setLocal(query.has('local') || query.has('players'))
      setLink(parseRoomLink(search))
    }
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  if (local) {
    return (
      <OrientationGate>
        <MatchErrorBoundary roomId={null}>{children}</MatchErrorBoundary>
      </OrientationGate>
    )
  }
  if (!link.roomId && !link.publicListingId && !link.createHost) {
    // Porta de entrada de verdade (FR-021): ninguém precisa saber o que é `?host=1`.
    return (
      <HomeScreen
        onCreate={() => navigateEntry('?host=1')}
        onJoin={(roomId) => navigateEntry(`?room=${encodeURIComponent(roomId)}`)}
        onJoinPublic={(listingId) => navigateEntry(`?public=${encodeURIComponent(listingId)}`)}
        onLocal={() => setLocal(true)}
        publicRooms={isSupabaseConfigured() ? getPublicRoomGateway() : null}
        telemetry={telemetry}
      />
    )
  }
  if (!isSupabaseConfigured()) {
    return (
      <LobbyMessage
        title="Multiplayer indisponível"
        message={describeSupabaseConfiguration() ?? 'Não foi possível validar a configuração do multiplayer.'}
        action={<Button onClick={() => navigateEntry('')}>Voltar ao início</Button>}
      />
    )
  }
  return (
    <OnlineRoom
      roomId={link.roomId}
      publicListingId={link.publicListingId}
      publicRooms={getPublicRoomGateway()}
      telemetry={telemetry}
      onExit={() => navigateEntry('')}
    >
      {children}
    </OnlineRoom>
  )
}

function OnlineRoom({
  roomId,
  publicListingId,
  publicRooms,
  telemetry,
  onExit,
  children,
}: {
  roomId: string | null
  publicListingId: string | null
  publicRooms: PublicRoomGateway
  telemetry: Telemetry
  onExit: () => void
  children: ReactNode
}) {
  // Hook de E2E (042, FR-025/e2e/errorBoundary.spec.ts) — mesmo espírito de `?players=N` (036):
  // um jeito determinístico de provar a queda da CASCA sem depender de um bug de verdade. Só
  // atua na 1ª chamada por navegação (a fronteira de último recurso captura e não remonta
  // `OnlineRoom` de novo sozinha); "Reabrir a sala" navega para um link limpo, sem o parâmetro.
  if (new URLSearchParams(window.location.search).has('e2eCrashCasca')) {
    throw new Error('E2E: queda intencional da casca de sessão (042, FR-025)')
  }
  const [session] = useState<RoomSession>(() =>
    createRoomSession({
      createTransport: createSupabaseTransport, // a seam: em teste, entra o hub in-memory
      publicRooms,
      connectStore: connectMultiplayer,
      describeError: describeInfraError,
      telemetry, // 044: nulo sem env/DEV — nenhuma requisição sai (FR-038)
      initialRoomPreset: recallRoomPreset(),
      onRoomPresetSelected: rememberRoomPreset,
    }),
  )
  const state = useSyncExternalStore(session.subscribe, session.getState)
  const entered = useRef(false)

  // Fronteira de último recurso (042): acha a sessão sem prop-drilling por três componentes.
  useEffect(() => {
    setActiveSession(session)
    return () => setActiveSession(null)
  }, [session])

  // Entrada por link (convidado OU host reabrindo). O guard sobrevive ao StrictMode.
  useEffect(() => {
    if (!roomId || publicListingId || entered.current) return
    entered.current = true
    void session.enter(roomId)
  }, [publicListingId, roomId, session])

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

  if (phase === 'auction' && room) {
    return (
      <OpeningAuction
        room={room}
        myUid={state.uid ?? ''}
        myBid={state.openingBid}
        onBid={session.submitOpeningBid}
      />
    )
  }

  if (phase === 'rolling' && room) {
    return (
      <OpeningRolls
        room={room}
        myUid={state.uid ?? ''}
        onRoll={session.submitOpeningRoll}
      />
    )
  }

  // Resultado aparece como transição, sem botão local: todas as telas embarcam sozinhas.
  if (phase === 'reveal' && room) {
    return <TurnOrderReveal room={room} />
  }

  if (phase === 'playing') {
    return (
      <>
        <OrientationGate>
          <MatchErrorBoundary roomId={room?.id ?? null}>{children}</MatchErrorBoundary>
        </OrientationGate>
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
        ? 'A partida desta sala já começou. Peça um novo link ao host.'
        : error === 'ended'
          ? 'Esta partida terminou e aguarda o host reabrir a sala.'
          : String(error ?? 'Erro desconhecido.')
    return (
      <LobbyMessage
        title="Não foi possível entrar"
        message={msg}
        action={<Button onClick={onExit}>Voltar ao início</Button>}
      />
    )
  }

  if (phase === 'identity') {
    // Criar a sala troca a URL para o link dela — assim um F5 do host cai no fluxo de
    // reentrada e reassume a autoridade (FR-015).
    const createAndHost = (name: string, color: string, avatar: AvatarId, skin: SkinId): void => {
      void session.create({ name, color, avatar, skin }).then((id) => {
        if (id) window.history.replaceState(null, '', roomLink(id, window.location.origin))
      })
    }
    if (publicListingId) {
      const joinPublic = (name: string, color: string, avatar: AvatarId, skin: SkinId): void => {
        void session.joinPublic(publicListingId, { name, color, avatar, skin }).then((id) => {
          if (id) window.history.replaceState(null, '', roomLink(id, window.location.origin))
        })
      }
      return (
        <IdentityForm
          title="Entrar em mesa pública"
          subtitle="Escolha como você aparece. A entrada será confirmada pelo servidor"
          room={null}
          cta="Confirmar e entrar"
          busy={busy}
          error={error}
          onSubmit={joinPublic}
        />
      )
    }
    return roomId ? (
      <IdentityForm
        title="Entrar na sala"
        subtitle="Confirme seu nome e escolha como você aparece na mesa"
        room={room}
        cta="Confirmar e entrar"
        busy={busy}
        error={error}
        onSubmit={(name, color, avatar, skin) => session.requestSeat({ name, color, avatar, skin })}
      />
    ) : (
      <IdentityForm
        title="Criar sala"
        subtitle="Você será o host. Escolha seu nome e como vai aparecer na mesa"
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
      onOpeningModeChange={session.setOpeningMode}
      onStart={() => void session.startMatch()}
      onKick={session.kick}
      publicRoomControl={state.isHost ? (
        <PublicRoomControl roomId={room.id} gateway={publicRooms} telemetry={telemetry} />
      ) : undefined}
    />
  )
}
