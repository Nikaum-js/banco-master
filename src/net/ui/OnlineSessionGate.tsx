// Parte pesada da entrada: transporte, lobby e partida só entram depois que a pessoa
// cria/abre uma sala ou escolhe o modo local. A home Atlas não deve pagar por Supabase,
// sessão, HUD ou orientação antes de qualquer intenção de jogar.
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { connectMultiplayer } from '@/net/connectStore'
import { hostSeat } from '@/net/room'
import { roomLink } from '@/net/session'
import { createRoomSession, type RoomSession } from '@/net/roomSession'
import { setActiveSession } from '@/net/activeSession'
import { MatchErrorBoundary } from '@/app/MatchErrorBoundary'
import {
  createSupabaseTransport,
  describeInfraError,
  describeSupabaseConfiguration,
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
import { SessionBadge } from './SessionBadge'
import { Button } from '@/game/ui/primitives'
import type { AvatarId } from '@/boards/playerAvatarCatalog'
import type { SkinId } from '@/boards/playerSkinCatalog'
import { recallRoomPreset, rememberRoomPreset } from '@/net/roomPresets'
import { coerceBoardId, type BoardId } from '@/lib/mapCatalog'
import { useRoomStore } from '@/net/roomStore'

const TICK_MS = 250

function mapParam(search: string): BoardId | null {
  const value = new URLSearchParams(search).get('map')
  return value === null ? null : coerceBoardId(value)
}

export function OnlineSessionGate({
  local,
  roomId,
  onExit,
  children,
}: {
  local: boolean
  roomId: string | null
  onExit: () => void
  children: ReactNode
}) {
  // Sem gate de orientação (D-079): retrato de celular tem layout próprio e joga.
  if (local) {
    return <MatchErrorBoundary roomId={null}>{children}</MatchErrorBoundary>
  }

  if (!isSupabaseConfigured()) {
    return (
      <LobbyMessage
        title="Multiplayer indisponível"
        message={describeSupabaseConfiguration() ?? 'Não foi possível validar a configuração do multiplayer.'}
        action={<Button onClick={onExit}>Voltar ao início</Button>}
      />
    )
  }

  return <OnlineRoom roomId={roomId} onExit={onExit}>{children}</OnlineRoom>
}

function OnlineRoom({
  roomId,
  onExit,
  children,
}: {
  roomId: string | null
  onExit: () => void
  children: ReactNode
}) {
  if (new URLSearchParams(window.location.search).has('e2eCrashCasca')) {
    throw new Error('E2E: queda intencional da casca de sessão (042, FR-025)')
  }
  const [session] = useState<RoomSession>(() =>
    createRoomSession({
      createTransport: createSupabaseTransport,
      connectStore: connectMultiplayer,
      describeError: describeInfraError,
      telemetry: resolveTelemetry(),
      initialRoomPreset: recallRoomPreset(),
      onRoomPresetSelected: rememberRoomPreset,
      initialBoardId: mapParam(window.location.search) ?? undefined,
    }),
  )
  const state = useSyncExternalStore(session.subscribe, session.getState)
  const entered = useRef(false)

  useEffect(() => {
    setActiveSession(session)
    return () => setActiveSession(null)
  }, [session])

  useEffect(() => {
    if (!roomId || entered.current) return
    entered.current = true
    void session.enter(roomId)
  }, [roomId, session])

  useEffect(() => {
    const id = setInterval(() => session.tick(), TICK_MS)
    return () => clearInterval(id)
  }, [session])

  useEffect(() => () => session.dispose(), [session])

  const { phase, room, error, busy } = state

  useEffect(() => {
    if (room) useRoomStore.getState().setRoom(room)
  }, [room])

  useEffect(() => () => useRoomStore.getState().setRoom(null), [])

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
    return <OpeningRolls room={room} myUid={state.uid ?? ''} onRoll={session.submitOpeningRoll} />
  }

  if (phase === 'reveal' && room) return <TurnOrderReveal room={room} />

  if (phase === 'playing') {
    return (
      <>
        <MatchErrorBoundary roomId={room?.id ?? null}>{children}</MatchErrorBoundary>
        {room && <SessionBadge link={roomLink(room.id, window.location.origin)} />}
      </>
    )
  }

  if (phase === 'reentry') {
    return <ReentryForm busy={busy} error={error} onSubmit={(code) => session.requestReentry(code)} />
  }

  if (phase === 'error') {
    const message =
      error === 'already-started'
        ? 'A partida desta sala já começou. Peça um novo link ao host.'
        : error === 'ended'
          ? 'Esta partida terminou e aguarda o host reabrir a sala.'
          : String(error ?? 'Erro desconhecido.')
    return (
      <LobbyMessage
        title="Não foi possível entrar"
        message={message}
        action={<Button onClick={onExit}>Voltar ao início</Button>}
      />
    )
  }

  if (phase === 'identity') {
    const createAndHost = (name: string, color: string, avatar: AvatarId, skin: SkinId): void => {
      void session.create({ name, color, avatar, skin }).then((id) => {
        if (id) window.history.replaceState(null, '', roomLink(id, window.location.origin))
      })
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
      onBoardChange={session.setBoardId}
      onStart={() => void session.startMatch()}
      onKick={session.kick}
    />
  )
}
