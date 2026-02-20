// Ponte entre a sala (rede) e a UI (spec 038, T007). ADITIVO por decisão de risco, como na
// 037: `useGameStore` não é tocado, e quem não está numa sala lê um store vazio e recebe as
// identidades de fallback — a UI tem UM caminho de render para os dois modos.
//
// Por que um store separado e não campos no `useGameStore`: manter o `GameState` livre de PII
// é invariante de arquitetura (D-019), e o snapshot do jogo é persistido a cada comando.
// Separando, a fronteira é física — não depende de alguém lembrar de não serializar.
import { useMemo } from 'react'
import { create } from 'zustand'
import { useGameStore } from '@/game/store'
import type { ConnectionState } from './client'
import { identityOf, type PlayerIdentity } from './identity'
import { localView, type LocalView } from './localView'
import type { Room } from './room'

interface RoomState {
  room: Room | null
  myUid: string | null
  /** Conexão da PRÓPRIA sessão (041, data-model §4) — espelhada do `client`, não do jogo. */
  connection: ConnectionState
  /** Diferença estimada `Date.now()` do host menos `Date.now()` deste aparelho. */
  clockOffsetMs: number
  /** 043, D-036/T026: o PRÓPRIO código de reentrada — vem da PRÉVIA (`Client.myReentryCode()`),
   * nunca de `room` (que não carrega código nenhum, nem o do dono). */
  myReentryCode: string | null
  /** Último comando MEU recusado por FALHA na autoridade (042, FR-020/022) — espelhado do
   * `client`, sinal de sessão, nunca de partida. */
  commandFailure: { occurrenceId: string } | null
  setRoom(room: Room | null): void
  setSession(uid: string | null): void
  setConnection(connection: ConnectionState): void
  setMyReentryCode(code: string | null): void
  reset(): void
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  myUid: null,
  connection: 'connected',
  clockOffsetMs: 0,
  myReentryCode: null,
  commandFailure: null,
  setRoom: (room) => set({ room }),
  setSession: (myUid) => set({ myUid }),
  setConnection: (connection) => set({ connection }),
  setMyReentryCode: (myReentryCode) => set({ myReentryCode }),
  reset: () => set({ room: null, myUid: null, connection: 'connected', clockOffsetMs: 0, myReentryCode: null, commandFailure: null }),
}))

// Perspectiva local viva. Sem sala → modo 'local' (nada bloqueado), preservando o
// comportamento de cliente único (FR-029/SC-007).
export function useLocalView(): LocalView {
  const game = useGameStore((s) => s.game)
  const room = useRoomStore((s) => s.room)
  const myUid = useRoomStore((s) => s.myUid)
  const connection = useRoomStore((s) => s.connection)
  return useMemo(() => localView(game, room, myUid, connection), [game, room, myUid, connection])
}

// Identidade de exibição de um jogador (nome/cor/peça). Nunca devolve id técnico.
export function useIdentity(playerId: string): PlayerIdentity {
  const room = useRoomStore((s) => s.room)
  return useMemo(() => identityOf(room, playerId), [room, playerId])
}

// Nome curto para interpolar em texto ("aguardando Ana", "Ana comprou Tóquio").
export function useName(playerId: string | null | undefined): string {
  const room = useRoomStore((s) => s.room)
  return useMemo(() => (playerId ? identityOf(room, playerId).name : ''), [room, playerId])
}
