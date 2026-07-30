import { useId, useMemo, useState } from 'react'
import { Button } from '@/game/ui/primitives'
import { ModalHeader, ModalShell, Overlay } from '@/game/ui/shell'
import {
  isShareCancellation,
  roomQr,
  roomShareData,
  whatsappShareUrl,
} from '@/net/invite'

type InviteFeedback = 'copied' | 'copy-error' | 'share-error' | null

const FEEDBACK_TEXT: Record<Exclude<InviteFeedback, null>, string> = {
  copied: 'Link copiado. Agora é só colar onde quiser.',
  'copy-error': 'Não foi possível copiar automaticamente. Selecione o link abaixo.',
  'share-error': 'Não foi possível abrir o compartilhamento.',
}

export function RoomInviteDialog({
  link,
  onClose,
}: {
  link: string
  onClose: () => void
}) {
  const qr = useMemo(() => roomQr(link), [link])
  const [feedback, setFeedback] = useState<InviteFeedback>(null)
  const [sharing, setSharing] = useState(false)
  const qrTitleId = useId()
  const canShare = typeof navigator.share === 'function'
  const quietZone = 4
  const canvasSize = qr.size + quietZone * 2

  async function copy(): Promise<void> {
    setFeedback(null)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(link)
      setFeedback('copied')
    } catch {
      setFeedback('copy-error')
    }
  }

  async function share(): Promise<void> {
    if (!canShare || sharing) return
    setFeedback(null)
    setSharing(true)
    try {
      await navigator.share(roomShareData(link))
    } catch (error) {
      if (!isShareCancellation(error)) setFeedback('share-error')
    } finally {
      setSharing(false)
    }
  }

  return (
    <Overlay z={75} dismissible onClick={onClose}>
      <ModalShell className="room-invite-dialog w-full max-w-[38rem]">
        <ModalHeader
          title="Compartilhar sala"
          subtitle="Convite privado · quem recebe o link pode pedir um assento"
          onClose={onClose}
        />

        <div className="room-invite-dialog__body">
          <figure className="room-invite-qr">
            <svg
              role="img"
              aria-labelledby={qrTitleId}
              viewBox={`0 0 ${canvasSize} ${canvasSize}`}
              shapeRendering="crispEdges"
              className="room-invite-qr__image"
            >
              <title id={qrTitleId}>QR Code do convite da sala</title>
              <rect width={canvasSize} height={canvasSize} fill="#fff" />
              {qr.matrix.map((row, y) => row.map((dark, x) => (
                dark
                  ? <rect key={`${x}-${y}`} x={x + quietZone} y={y + quietZone} width="1" height="1" fill="#07111f" />
                  : null
              )))}
            </svg>
            <figcaption>Aponte a câmera para entrar nesta sala.</figcaption>
          </figure>

          <div className="room-invite-dialog__actions">
            <div className="room-invite-dialog__link">
              <span className="label text-brass">Link da sala</span>
              <code>{link}</code>
            </div>

            {canShare && (
              <Button
                variant="ghost"
                className="room-invite-dialog__primary"
                disabled={sharing}
                onClick={() => void share()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path d="m8.7 10.6 6.6-4.1M8.7 13.4l6.6 4.1" />
                </svg>
                {sharing ? 'Abrindo…' : 'Compartilhar pelo dispositivo'}
              </Button>
            )}

            <Button
              variant="ghost"
              className="room-invite-dialog__secondary"
              onClick={() => void copy()}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <rect x="8" y="8" width="11" height="11" rx="1.5" />
                <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-10A1.5 1.5 0 0 0 3 5.5v10A1.5 1.5 0 0 0 4.5 17H8" />
              </svg>
              Copiar link da sala
            </Button>

            {!canShare && (
              <>
                <a
                  className="room-invite-dialog__whatsapp"
                  href={whatsappShareUrl(link)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir no WhatsApp
                </a>
                <p className="room-invite-dialog__discord">
                  Para convidar pelo Discord, copie e cole o link copiado no Discord.
                </p>
              </>
            )}

            <p
              className={`room-invite-dialog__feedback ${feedback && feedback !== 'copied' ? 'text-signal-glow' : ''}`}
              role={feedback && feedback !== 'copied' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {feedback ? FEEDBACK_TEXT[feedback] : '\u00a0'}
            </p>
          </div>
        </div>
      </ModalShell>
    </Overlay>
  )
}
