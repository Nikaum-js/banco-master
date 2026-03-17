import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Globe2, LoaderCircle } from 'lucide-react'
import type {
  PublicRoomGateway,
  PublicRoomPublication,
} from '@/net/publicRoomDirectory'
import { PublicRoomError } from '@/net/publicRoomDirectory'
import type { Telemetry } from '@/telemetry/port'
import { Button } from '@/game/ui/primitives'

const HEARTBEAT_MS = 30_000

function statusCopy(status: PublicRoomPublication): string {
  if (!status.published) return 'Privada — só entra quem receber seu convite.'
  if (status.visible) return 'Publicada — aparece no diretório enquanto houver vaga.'
  if (status.hiddenReason === 'full') return 'Publicada, mas oculta enquanto a sala estiver cheia.'
  if (status.hiddenReason === 'host-absent') return 'Publicada, mas oculta até sua presença ser confirmada.'
  return 'Publicada, mas indisponível fora do lobby.'
}

function errorCopy(error: unknown): string {
  if (error instanceof PublicRoomError) {
    if (error.code === 'active-public-room') return 'Você já mantém outro lobby publicado.'
    if (error.code === 'rate-limited') return 'Limite de 3 salas públicas em 10 minutos atingido.'
    if (error.code === 'not-host') return 'Somente o host pode alterar a publicação.'
  }
  return 'Não foi possível atualizar o diretório. A sala privada continua funcionando.'
}

const PRIVATE: PublicRoomPublication = {
  published: false,
  visible: false,
  listingId: null,
  hiddenReason: null,
}

export function PublicRoomControl({
  roomId,
  gateway,
  telemetry,
}: {
  roomId: string
  gateway: PublicRoomGateway
  telemetry: Telemetry
}) {
  const [status, setStatus] = useState<PublicRoomPublication>(PRIVATE)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestVersion = useRef(0)

  const sync = useCallback(async (heartbeat = false) => {
    const version = ++requestVersion.current
    try {
      const next = heartbeat
        ? await gateway.heartbeat(roomId)
        : await gateway.publication(roomId)
      if (version !== requestVersion.current) return
      setStatus(next)
      setError(null)
    } catch (cause) {
      if (version !== requestVersion.current) return
      setError(errorCopy(cause))
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [gateway, roomId])

  useEffect(() => {
    const initial = window.setTimeout(() => void sync(), 0)
    return () => window.clearTimeout(initial)
  }, [sync])

  useEffect(() => {
    if (!status.published || busy) return
    const initial = window.setTimeout(() => void sync(true), 0)
    const timer = window.setInterval(() => void sync(true), HEARTBEAT_MS)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
  }, [status.published, busy, sync])

  async function toggle(): Promise<void> {
    const version = ++requestVersion.current
    setBusy(true)
    setError(null)
    try {
      const next = status.published
        ? await gateway.unpublish(roomId)
        : await gateway.publish(roomId)
      if (version !== requestVersion.current) return
      setStatus(next)
      if (next.published) telemetry.track({ kind: 'public_room_published' })
    } catch (cause) {
      if (version !== requestVersion.current) return
      setError(errorCopy(cause))
    } finally {
      if (version === requestVersion.current) setBusy(false)
    }
  }

  const Icon = loading || busy
    ? LoaderCircle
    : status.visible
      ? Eye
      : status.published
        ? EyeOff
        : Globe2

  return (
    <section className="public-room-control" aria-labelledby="public-room-control-title">
      <div className="public-room-control__copy">
        <span className="label text-brass" id="public-room-control-title">Sala pública</span>
        <p aria-live="polite">
          {loading ? 'Consultando publicação…' : statusCopy(status)}
        </p>
        {error && <p className="public-room-control__error" role="alert">{error}</p>}
      </div>
      <Button
        variant="ghost"
        className="public-room-control__action"
        disabled={loading || busy}
        aria-pressed={status.published}
        onClick={() => void toggle()}
      >
        <Icon className={loading || busy ? 'animate-spin' : undefined} size={16} aria-hidden />
        {busy
          ? 'Atualizando…'
          : status.published
            ? 'Tornar privada'
            : 'Publicar lobby'}
      </Button>
    </section>
  )
}
