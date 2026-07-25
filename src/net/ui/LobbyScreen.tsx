// Tela mínima de sala (spec 037, T018) — nome + cor + assentos + iniciar. É a porta de
// entrada do multiplayer; o lobby RICO (avatares, rolagem de ordem, chat) é do 038+.
// Vocabulário visual: o mesmo dos modais do jogo (`shell`/`primitives`), sem dialeto novo.
import { useState } from 'react'
import { Button, Chip } from '@/game/ui/primitives'
import { ModalShell, ModalHeader } from '@/game/ui/shell'
import { availableColors, MAX_SEATS, MIN_SEATS, type JoinError, type Room } from '@/net/room'
import { availablePieces, PIECES, type PieceId } from '@/net/identity'

const JOIN_ERROR_TEXT: Record<JoinError, string> = {
  'room-full': `Sala cheia — o limite é ${MAX_SEATS} jogadores.`,
  'color-taken': 'Essa cor já foi escolhida por outro jogador.',
  'piece-taken': 'Essa peça já foi escolhida por outro jogador.',
  'already-started': 'A partida já começou — não é possível entrar agora.',
  'unknown-token': 'Sessão não reconhecida nesta sala.',
  kicked: 'O anfitrião removeu você desta sala.',
}

// Moldura comum das telas de sala (fundo do jogo + cartão central).
function Frame({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-coffee-950">
      <ModalShell className="w-full max-w-md">
        <ModalHeader title={title} subtitle={subtitle} center />
        <div className="p-4 flex flex-col gap-4">{children}</div>
      </ModalShell>
    </div>
  )
}

// Passo 1 — identidade: nome livre e cor ÚNICA na sala (§12.5). As cores já ocupadas
// somem da grade; a recusa do host (corrida por cor) volta como `error`.
export function IdentityForm({
  title,
  subtitle,
  room,
  cta,
  busy,
  error,
  onSubmit,
}: {
  title: string
  subtitle?: string
  room: Room | null
  cta: string
  busy?: boolean
  error?: JoinError | string | null
  onSubmit: (name: string, color: string, piece: PieceId) => void
}) {
  const salaVazia: Room = { id: '', status: 'lobby', seats: [] }
  const free = availableColors(room ?? salaVazia)
  const freePieces = availablePieces(room ?? salaVazia)
  const [name, setName] = useState('')
  const [color, setColor] = useState(free[0] ?? '')
  const [piece, setPiece] = useState<PieceId>(freePieces[0])
  const chosen = free.includes(color) ? color : (free[0] ?? '')
  const chosenPiece = freePieces.includes(piece) ? piece : freePieces[0]
  const message = error && (error in JOIN_ERROR_TEXT ? JOIN_ERROR_TEXT[error as JoinError] : String(error))

  return (
    <Frame title={title} subtitle={subtitle}>
      <label className="flex flex-col gap-1.5">
        <span className="label text-gold">Seu nome</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 16))}
          placeholder="Como aparecer na mesa"
          maxLength={16}
          autoFocus
          className="px-3 py-2 rounded-[var(--radius-sharp)] bg-coffee-900 border border-coffee-500 text-cream placeholder:text-cream-muted/50 focus:outline-none focus:border-gold/60"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="label text-gold">Sua cor</span>
        <div className="flex flex-wrap gap-2">
          {free.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Cor ${c}`}
              aria-pressed={c === chosen}
              style={{ background: c }}
              className={`w-9 h-9 rounded-full border-2 transition-transform ${
                c === chosen ? 'border-gold scale-110' : 'border-coffee-950/60 hover:scale-105'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="label text-gold">Sua peça</span>
        <div className="flex flex-wrap gap-2">
          {PIECES.filter((p) => freePieces.includes(p.id)).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPiece(p.id)}
              aria-label={p.label}
              aria-pressed={p.id === chosenPiece}
              title={p.label}
              className={`w-10 h-10 rounded-[var(--radius-card)] border-2 grid place-items-center text-lg transition-transform ${
                p.id === chosenPiece ? 'border-gold bg-gold/15 scale-110' : 'border-coffee-500 bg-coffee-900 hover:scale-105'
              }`}
            >
              {p.glyph}
            </button>
          ))}
        </div>
      </div>

      {message && <p className="text-signal-glow text-sm leading-snug">{message}</p>}

      <Button disabled={!name.trim() || !chosen || !chosenPiece || busy} onClick={() => onSubmit(name.trim(), chosen, chosenPiece)}>
        {busy ? 'Conectando…' : cta}
      </Button>
    </Frame>
  )
}

// Passo 2 — sala montada: assentos na ORDEM DE ENTRADA (= ordem de turno, FR-006), link
// compartilhável e o botão de iniciar (só o host, com 2+ jogadores).
export function RoomLobby({
  room,
  myToken,
  isHost,
  link,
  starting,
  onStart,
  onKick,
}: {
  room: Room
  myToken: string
  isHost: boolean
  link: string
  starting?: boolean
  onStart: () => void
  onKick?: (token: string) => void
}) {
  const [copied, setCopied] = useState(false)

  function copy(): void {
    void navigator.clipboard?.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <Frame title="Sala aberta" subtitle={`${room.seats.length}/${MAX_SEATS} jogadores · ordem de entrada = ordem de turno`}>
      <div className="flex flex-col gap-2">
        {room.seats.map((s, i) => (
          <div
            key={s.token}
            className="flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-card)] bg-coffee-800/60 border border-coffee-500"
          >
            <span
              className="w-7 h-7 rounded-full border-2 border-coffee-950/60 shrink-0 grid place-items-center text-sm"
              style={{ background: s.color }}
              title={pieceLabel(s.piece)}
            >
              {pieceGlyph(s.piece)}
            </span>
            <span className="text-cream truncate flex-1">{s.name}</span>
            {s.token === myToken && <Chip tone="gold">você</Chip>}
            {s.isHost && <Chip>anfitrião</Chip>}
            {!s.connected && <Chip tone="alert">offline</Chip>}
            <span className="label text-cream-muted/60 tabular-nums">{i + 1}º</span>
            {isHost && !s.isHost && onKick && (
              <button
                type="button"
                onClick={() => onKick(s.token)}
                title={`Remover ${s.name} da sala`}
                aria-label={`Remover ${s.name} da sala`}
                className="shrink-0 w-6 h-6 rounded-full grid place-items-center text-cream-muted/60 hover:text-signal-glow hover:bg-signal/15 transition-colors"
              >
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="label text-gold">Link da sala</span>
        <div className="flex gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 min-w-0 px-3 py-2 rounded-[var(--radius-sharp)] bg-coffee-900 border border-coffee-500 text-cream-muted text-sm"
          />
          <Button variant="secondary" onClick={copy}>
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
      </div>

      {isHost ? (
        <Button disabled={room.seats.length < MIN_SEATS || starting} onClick={onStart}>
          {starting ? 'Iniciando…' : `Iniciar partida (${room.seats.length}/${MAX_SEATS})`}
        </Button>
      ) : (
        <p className="label text-cream-muted text-center">Aguardando o anfitrião iniciar a partida…</p>
      )}
    </Frame>
  )
}

// Emblema da peça escolhida — cai no ponto neutro em salas da 037 (sem peça).
function pieceGlyph(id?: string): string {
  return PIECES.find((p) => p.id === id)?.glyph ?? '●'
}

function pieceLabel(id?: string): string {
  return PIECES.find((p) => p.id === id)?.label ?? 'Peça'
}

// Ordem sorteada da mesa (FR-030): mostrada a todos antes do primeiro turno.
export function TurnOrderReveal({ room, onDone }: { room: Room; onDone: () => void }) {
  return (
    <Frame title="Ordem da mesa" subtitle="Sorteada agora — vale para toda a partida">
      <ol className="flex flex-col gap-2">
        {room.seats.map((s, i) => (
          <li
            key={s.token}
            className="flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-card)] bg-coffee-800/60 border border-coffee-500"
          >
            <span className="display text-gold w-6 text-center tabular-nums">{i + 1}º</span>
            <span
              className="w-7 h-7 rounded-full border-2 border-coffee-950/60 shrink-0 grid place-items-center text-sm"
              style={{ background: s.color }}
            >
              {pieceGlyph(s.piece)}
            </span>
            <span className="text-cream truncate flex-1">{s.name}</span>
          </li>
        ))}
      </ol>
      <Button onClick={onDone}>Começar</Button>
    </Frame>
  )
}

// Estados terminais de entrada: link inválido, partida já começada, host ausente.
export function LobbyMessage({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return (
    <Frame title={title}>
      <p className="text-cream leading-snug">{message}</p>
      {action}
    </Frame>
  )
}
