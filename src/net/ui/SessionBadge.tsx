// Link + código de reentrada durante a PARTIDA (041, D-033/FR-030) — discreto: recolhido por
// padrão, o mesmo lugar para os dois. Quem nunca anotou o código precisa conseguir lê-lo
// antes de precisar dele; o lobby já mostra os dois (`RoomLobby`), este é o equivalente para
// quando o jogo já está em curso.
import { useState } from 'react'
import { seatByUid } from '@/net/room'
import { useRoomStore } from '@/net/roomStore'

export function SessionBadge({ link }: { link: string }) {
  const room = useRoomStore((s) => s.room)
  const myUid = useRoomStore((s) => s.myUid)
  // 043, D-036/T026: o código vem da PRÉVIA (`room_preview`), nunca da sala publicada — `room`
  // não carrega código nenhum, nem o do dono (é assim que "nada vaza na difusão" vira garantia
  // estrutural, não promessa de código que esqueceu de redigir algum campo).
  const myReentryCode = useRoomStore((s) => s.myReentryCode)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)

  const seat = room && myUid ? seatByUid(room, myUid) : undefined
  if (!seat || !myReentryCode) return null

  function copy(what: 'link' | 'code', value: string): void {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(what)
      setTimeout(() => setCopied(null), 1800)
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="session-access__trigger fixed bottom-4 right-4 z-[74] min-h-11 px-4 rounded-full text-xs"
      >
        Link e código
      </button>
    )
  }

  return (
    <div className="atlas-surface atlas-surface--popover session-access fixed bottom-4 right-4 z-[74] w-72 max-w-[calc(100vw-2rem)] p-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="label text-gold">Seu acesso</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Recolher" className="w-11 h-11 -mr-2 -my-2 grid place-items-center text-cream-muted/85 hover:text-cream text-xs">
          ✕
        </button>
      </div>
      <button type="button" onClick={() => copy('link', link)} title={link} className="session-access__row min-h-11 text-left text-xs text-cream-muted truncate hover:text-cream">
        {copied === 'link' ? 'Link copiado!' : `Link: ${link}`}
      </button>
      <button type="button" onClick={() => copy('code', myReentryCode)} className="session-access__row min-h-11 text-left text-sm tracking-[0.25em] text-cream font-mono hover:text-gold">
        {copied === 'code' ? 'Código copiado!' : myReentryCode}
      </button>
      <p className="text-cream-muted/85" style={{ fontSize: 10 }}>
        Com o código, você reanexa a este assento de qualquer aparelho — mesmo sem este link salvo.
      </p>
    </div>
  )
}
