import { useCallback, useEffect, useRef, useState } from 'react'
import type { AvatarId } from '@/boards/playerAvatarCatalog'
import type { SkinId } from '@/boards/playerSkinCatalog'

export type PublicOpeningMode = 'sealed-bid' | 'dice-roll'

export interface PublicRoomListing {
  listingId: string
  label: string
  availableSeats: number
  capacity: number
  openingMode: PublicOpeningMode
  createdMinutesAgo: number
}

export interface PublicJoinIdentity {
  name: string
  color: string
  avatar: AvatarId
  skin: SkinId
}

export type PublicRoomHiddenReason = 'full' | 'host-absent' | 'not-lobby' | null

export interface PublicRoomPublication {
  published: boolean
  visible: boolean
  listingId: string | null
  hiddenReason: PublicRoomHiddenReason
}

export type PublicRoomErrorCode =
  | 'active-public-room'
  | 'color-taken'
  | 'invalid-appearance'
  | 'invalid-color'
  | 'invalid-name'
  | 'invalid-response'
  | 'not-host'
  | 'rate-limited'
  | 'unavailable'

export class PublicRoomError extends Error {
  readonly code: PublicRoomErrorCode
  readonly retryAfterMs: number | null

  constructor(
    code: PublicRoomErrorCode,
    retryAfterMs: number | null = null,
    message = code,
  ) {
    super(message)
    this.name = 'PublicRoomError'
    this.code = code
    this.retryAfterMs = retryAfterMs
  }
}

export interface PublicRoomsRpc {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>
}

export interface PublicRoomGateway {
  list(): Promise<PublicRoomListing[]>
  publication(roomId: string): Promise<PublicRoomPublication>
  publish(roomId: string): Promise<PublicRoomPublication>
  unpublish(roomId: string): Promise<PublicRoomPublication>
  heartbeat(roomId: string): Promise<PublicRoomPublication>
  join(listingId: string, identity: PublicJoinIdentity): Promise<string>
}

interface FailurePayload {
  ok: false
  reason: PublicRoomErrorCode
  retryAfterMs?: number
}

const LISTING_KEYS = [
  'availableSeats',
  'capacity',
  'createdMinutesAgo',
  'label',
  'listingId',
  'openingMode',
] as const
const LIST_RESPONSE_KEYS = ['listings', 'ok'] as const
const PUBLICATION_KEYS = ['hiddenReason', 'listingId', 'ok', 'published', 'visible'] as const
const JOIN_SUCCESS_KEYS = ['ok', 'roomId'] as const
const FAILURE_KEYS = ['ok', 'reason'] as const
const RATE_FAILURE_KEYS = ['ok', 'reason', 'retryAfterMs'] as const

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index])
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function parseListing(value: unknown): PublicRoomListing {
  if (!isRecord(value) || !exactKeys(value, LISTING_KEYS)) {
    throw new PublicRoomError('invalid-response')
  }
  const {
    listingId,
    label,
    availableSeats,
    capacity,
    openingMode,
    createdMinutesAgo,
  } = value
  if (
    typeof listingId !== 'string'
    || !UUID_PATTERN.test(listingId)
    || typeof label !== 'string'
    || !/^Mesa [A-Z0-9]{4}$/.test(label)
    || !nonNegativeInteger(availableSeats)
    || capacity !== 8
    || availableSeats > capacity
    || (openingMode !== 'sealed-bid' && openingMode !== 'dice-roll')
    || !nonNegativeInteger(createdMinutesAgo)
  ) {
    throw new PublicRoomError('invalid-response')
  }
  return { listingId, label, availableSeats, capacity, openingMode, createdMinutesAgo }
}

function parseFailure(data: unknown): FailurePayload | null {
  if (!isRecord(data) || data.ok !== false || typeof data.reason !== 'string') return null
  const hasRetryAfter = Object.hasOwn(data, 'retryAfterMs')
  if (!exactKeys(data, hasRetryAfter ? RATE_FAILURE_KEYS : FAILURE_KEYS)) return null
  const allowed: PublicRoomErrorCode[] = [
    'active-public-room',
    'color-taken',
    'invalid-appearance',
    'invalid-color',
    'invalid-name',
    'not-host',
    'rate-limited',
    'unavailable',
  ]
  if (!allowed.includes(data.reason as PublicRoomErrorCode)) return null
  if (hasRetryAfter && !nonNegativeInteger(data.retryAfterMs)) return null
  const retryAfterMs = hasRetryAfter ? data.retryAfterMs as number : undefined
  return { ok: false, reason: data.reason as PublicRoomErrorCode, retryAfterMs }
}

function parsePublication(data: unknown): PublicRoomPublication {
  const failure = parseFailure(data)
  if (failure) throw new PublicRoomError(failure.reason, failure.retryAfterMs ?? null)
  if (
    !isRecord(data)
    || !exactKeys(data, PUBLICATION_KEYS)
    || data.ok !== true
    || typeof data.published !== 'boolean'
    || typeof data.visible !== 'boolean'
    || (data.listingId !== null && (typeof data.listingId !== 'string' || !UUID_PATTERN.test(data.listingId)))
    || !(
      data.hiddenReason === null
      || data.hiddenReason === 'full'
      || data.hiddenReason === 'host-absent'
      || data.hiddenReason === 'not-lobby'
    )
  ) {
    throw new PublicRoomError('invalid-response')
  }
  return {
    published: data.published,
    visible: data.visible,
    listingId: data.listingId,
    hiddenReason: data.hiddenReason,
  }
}

function describeRpcError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (isRecord(error) && typeof error.message === 'string') return error.message
  return String(error)
}

export function createPublicRoomGateway(
  client: () => Promise<PublicRoomsRpc>,
): PublicRoomGateway {
  async function call(fn: string, args?: Record<string, unknown>): Promise<unknown> {
    const rpc = await client()
    const { data, error } = await rpc.rpc(fn, args)
    if (error) throw new Error(describeRpcError(error))
    return data
  }

  return {
    async list() {
      const data = await call('list_public_rooms')
      const failure = parseFailure(data)
      if (failure) throw new PublicRoomError(failure.reason, failure.retryAfterMs ?? null)
      if (
        !isRecord(data)
        || !exactKeys(data, LIST_RESPONSE_KEYS)
        || data.ok !== true
        || !Array.isArray(data.listings)
      ) {
        throw new PublicRoomError('invalid-response')
      }
      return data.listings.map(parseListing)
    },

    async publication(roomId) {
      return parsePublication(await call('public_room_publication', { room_id: roomId }))
    },

    async publish(roomId) {
      return parsePublication(await call('publish_public_room', { room_id: roomId }))
    },

    async unpublish(roomId) {
      return parsePublication(await call('unpublish_public_room', { room_id: roomId }))
    },

    async heartbeat(roomId) {
      return parsePublication(await call('heartbeat_public_room', { room_id: roomId }))
    },

    async join(listingId, identity) {
      if (!UUID_PATTERN.test(listingId)) throw new PublicRoomError('unavailable')
      const data = await call('join_public_room', {
        listing_id: listingId,
        name: identity.name,
        color: identity.color,
        avatar: identity.avatar,
        skin: identity.skin,
      })
      const failure = parseFailure(data)
      if (failure) throw new PublicRoomError(failure.reason, failure.retryAfterMs ?? null)
      if (
        !isRecord(data)
        || !exactKeys(data, JOIN_SUCCESS_KEYS)
        || data.ok !== true
        || typeof data.roomId !== 'string'
        || !data.roomId
      ) {
        throw new PublicRoomError('invalid-response')
      }
      return data.roomId
    },
  }
}

export type PublicDirectoryPhase =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error'
  | 'rate-limited'

export interface PublicDirectoryState {
  phase: PublicDirectoryPhase
  listings: PublicRoomListing[]
  retryAfterMs: number | null
  message: string | null
}

export function usePublicRoomDirectory(
  gateway: PublicRoomGateway,
  active: boolean,
): PublicDirectoryState & { refresh(): void } {
  const [state, setState] = useState<PublicDirectoryState>({
    phase: 'idle',
    listings: [],
    retryAfterMs: null,
    message: null,
  })
  const alive = useRef(true)
  const inFlight = useRef(false)
  const nextAllowedAt = useRef(0)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const refresh = useCallback(() => {
    const wait = Math.max(0, nextAllowedAt.current - Date.now())
    if (inFlight.current) return
    if (wait > 0) {
      setState((current) => ({
        ...current,
        phase: 'rate-limited',
        retryAfterMs: wait,
        message: 'Aguarde alguns segundos antes de atualizar novamente.',
      }))
      return
    }
    inFlight.current = true
    setState((current) => ({
      ...current,
      phase: current.listings.length === 0 ? 'loading' : current.phase,
      retryAfterMs: null,
      message: null,
    }))
    void gateway.list().then(
      (listings) => {
        nextAllowedAt.current = Date.now() + 5_000
        if (!alive.current) return
        setState({
          phase: listings.length === 0 ? 'empty' : 'ready',
          listings,
          retryAfterMs: null,
          message: null,
        })
      },
      (error: unknown) => {
        if (!alive.current) return
        if (error instanceof PublicRoomError && error.code === 'rate-limited') {
          const retryAfterMs = error.retryAfterMs ?? 5_000
          nextAllowedAt.current = Date.now() + retryAfterMs
          setState((current) => ({
            ...current,
            phase: 'rate-limited',
            retryAfterMs,
            message: 'O diretório está atualizando. Tente novamente em instantes.',
          }))
          return
        }
        setState((current) => ({
          ...current,
          phase: 'error',
          retryAfterMs: null,
          message: 'Não foi possível carregar as mesas públicas.',
        }))
      },
    ).finally(() => {
      inFlight.current = false
    })
  }, [gateway])

  useEffect(() => {
    if (!active) return
    refresh()
    const timer = window.setInterval(refresh, 5_200)
    return () => window.clearInterval(timer)
  }, [active, refresh])

  return { ...state, refresh }
}
