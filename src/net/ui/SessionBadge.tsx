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
        className="fixed bottom-4 right-4 z-[74] px-3 py-1.5 rounded-full border border-coffee-500 bg-coffee-900/80 text-cream-muted/85 text-xs hover:text-cream hover:border-gold/40 transition-colors"
      >
        Link e código
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-[74] w-64 p-3 rounded-[var(--radius-card)] border border-coffee-500 bg-coffee-900/97 shadow-[var(--shadow-dropdown)] flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="label text-gold">Seu acesso</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Recolher" className="text-cream-muted/85 hover:text-cream text-xs">
          ✕
        </button>
      </div>
      <button type="button" onClick={() => copy('link', link)} title={link} className="text-left text-xs text-cream-muted truncate hover:text-cream">
        {copied === 'link' ? 'Link copiado!' : `Link: ${link}`}
      </button>
      <button type="button" onClick={() => copy('code', myReentryCode)} className="text-left text-sm tracking-[0.25em] text-cream font-mono hover:text-gold">
        {copied === 'code' ? 'Código copiado!' : myReentryCode}
      </button>
      <p className="text-cream-muted/85" style={{ fontSize: 10 }}>
        Com o código, você reanexa a este assento de qualquer aparelho — mesmo sem este link salvo.
      </p>
    </div>
  )
}
