// Telas de sala (spec 037, T018; redesenho no lançamento) — nome + cor + peça + assentos +
// iniciar. Vocabulário visual: a "sala de mapas" do `entryShell` (o mesmo mundo do
// tabuleiro — graticule, latão, marcas de registro), peças em SVG autoral (`pieceGlyphs`)
// e o PRÓPRIO token do tabuleiro (`PlayerFace`) como preview: a pergunta "como eu apareço
// na mesa?" é respondida mostrando, não descrevendo.
import { useState } from 'react'
import { Button, Chip } from '@/game/ui/primitives'
import { PlayerFace } from '@/boards/shared'
import { availableColors, availablePieces, MAX_SEATS, MIN_SEATS, PIECES, pieceOf, type JoinError, type PieceId, type Room } from '@/net/room'
import { NAME_MAX, recallPlayerName, rememberPlayerName } from '@/net/session'
import { EntryPanel, EntryStage, EntryHeader } from './entryShell'
import { PieceGlyph } from './pieceGlyphs'

const JOIN_ERROR_TEXT: Record<JoinError, string> = {
  'room-full': `Sala cheia — o limite é ${MAX_SEATS} jogadores.`,
  'color-taken': 'Essa cor já foi escolhida por outro jogador.',
  'piece-taken': 'Essa peça já foi escolhida por outro jogador.',
  'already-started': 'A partida já começou — não é possível entrar agora.',
  'unknown-uid': 'Sessão não reconhecida nesta sala.',
  kicked: 'O anfitrião removeu você desta sala.',
  'bad-code': 'Código de reentrada inválido.',
}

// Moldura comum das telas de sala: palco da sala de mapas + prancha central.
function Frame({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <EntryStage>
      <EntryPanel className="max-w-md">
        <EntryHeader title={title} subtitle={subtitle} />
        <div className="p-5 pt-4 flex flex-col gap-4">{children}</div>
      </EntryPanel>
    </EntryStage>
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
  // Já vem preenchido com o nome da home (`rememberPlayerName`): aqui a pergunta que
  // sobra é a aparência — o nome só é redigitado por quem quiser trocá-lo.
  const [name, setName] = useState(() => recallPlayerName())
  const [color, setColor] = useState(free[0] ?? '')
  const [piece, setPiece] = useState<PieceId>(freePieces[0])
  const chosen = free.includes(color) ? color : (free[0] ?? '')
  const chosenPiece = freePieces.includes(piece) ? piece : freePieces[0]
  const message = error && (error in JOIN_ERROR_TEXT ? JOIN_ERROR_TEXT[error as JoinError] : String(error))

  return (
    <Frame title={title} subtitle={subtitle}>
      {/* Preview vivo — o token REAL do tabuleiro com a cor escolhida, respirando. */}
      <div className="flex items-center gap-3.5 px-4 py-3 rounded-[var(--radius-card)] bg-ink-950/50 border border-ink-500">
        <PlayerFace color={chosen || 'var(--color-ink-400)'} size={46} active />
        <div className="min-w-0 flex-1">
          <p className={`font-semibold leading-tight truncate ${name.trim() ? 'text-starlight' : 'text-starlight-muted/70'}`}>
            {name.trim() || 'Viajante sem nome'}
          </p>
          <p className="label text-starlight-muted mt-1 flex items-center gap-1.5">
            <PieceGlyph id={chosenPiece} size={13} className="text-brass shrink-0" />
            {pieceOf(chosenPiece).label} · assim você aparece na mesa
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="player-name" className="label text-brass">
          Seu nome
        </label>
        <input
          id="player-name"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
          placeholder="Ex.: Marco Polo"
          maxLength={NAME_MAX}
          autoFocus={name === ''}
          className="entry-input"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="label text-brass">Sua cor</span>
        <div className="flex flex-wrap gap-2.5">
          {free.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Cor ${c}`}
              aria-pressed={c === chosen}
              style={{ background: c }}
              className={`w-8 h-8 rounded-full border border-ink-950/60 transition-all ${
                c === chosen
                  ? 'ring-2 ring-brass ring-offset-2 ring-offset-ink-800 scale-105'
                  : 'opacity-80 hover:opacity-100 hover:scale-105'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="label text-brass">Sua peça</span>
        <div className="grid grid-cols-4 gap-2">
          {PIECES.filter((p) => freePieces.includes(p.id)).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPiece(p.id)}
              aria-label={p.label}
              aria-pressed={p.id === chosenPiece}
              title={p.label}
              className={`h-12 rounded-[var(--radius-card)] border grid place-items-center transition-all ${
                p.id === chosenPiece
                  ? 'border-brass/80 bg-brass/10 text-brass-glow shadow-[var(--shadow-glow)]'
                  : 'border-ink-500 bg-ink-900/60 text-starlight-muted hover:text-starlight hover:border-ink-300'
              }`}
            >
              <PieceGlyph id={p.id} size={24} />
            </button>
          ))}
        </div>
      </div>

      {message && <p className="text-signal-glow text-sm leading-snug">{message}</p>}

      <Button
        disabled={!name.trim() || !chosen || !chosenPiece || busy}
        onClick={() => {
          rememberPlayerName(name)
          onSubmit(name.trim(), chosen, chosenPiece)
        }}
      >
        {busy ? 'Conectando…' : cta}
      </Button>
    </Frame>
  )
}

// Passo 2 — sala montada: convite, assentos na ORDEM DE ENTRADA (= ordem de turno, FR-006)
// e o botão de iniciar (só o host, com 2+ jogadores).
//
// Ordem da tela (revisão de UI, referência: richup.io): convite → jogadores → iniciar. O
// texto do estado incompleto também mudou porque MENTIA: dizia "a partida começa com 2
// jogadores", como se ela partisse sozinha ao chegar o segundo — quem começa é o anfitrião,
// e 2 é o mínimo, não o número.
export function RoomLobby({
  room,
  myUid,
  myReentryCode,
  isHost,
  link,
  starting,
  onStart,
  onKick,
}: {
  room: Room
  myUid: string
  /** 043, D-036/T026: da PRÉVIA (`Client.myReentryCode()`) — `room` nunca carrega código
   * nenhum, nem o do dono. `null` até a prévia resolver. */
  myReentryCode: string | null
  isHost: boolean
  link: string
  starting?: boolean
  onStart: () => void
  onKick?: (uid: string) => void
}) {
  const [copied, setCopied] = useState(false)

  function copy(): void {
    void navigator.clipboard?.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  const faltam = MIN_SEATS - room.seats.length

  return (
    <Frame title="Sala aberta" subtitle={faltam > 0 ? 'Aguardando jogadores…' : 'A ordem da mesa é sorteada ao iniciar'}>
      {/* 1. Convite — o PRIMEIRO bloco da tela. Numa sala recém-criada não há nada a fazer
          além de chamar gente; deixar o link abaixo da lista de assentos enterrava a única
          ação que importa naquele momento. */}
      <div className="flex flex-col gap-1.5">
        <span className="label text-brass">Convide seus amigos</span>
        <div className="flex gap-2">
          <input
            readOnly
            value={link}
            aria-label="Link da sala"
            onFocus={(e) => e.currentTarget.select()}
            className="entry-input flex-1 min-w-0 text-sm text-starlight-muted"
          />
          <Button variant="secondary" onClick={copy}>
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        {/* Frase, não rótulo: `.label` versaleta e alarga o espaçamento — bom para "Link da
            sala", ilegível para uma linha inteira de texto. */}
        <p className="text-[0.8rem] text-starlight-muted leading-snug">
          {faltam > 0
            ? `Pelo menos ${MIN_SEATS} jogadores para começar — falta${faltam > 1 ? 'm' : ''} ${faltam}.`
            : `Cabem até ${MAX_SEATS} jogadores — o anfitrião começa quando quiser.`}
        </p>
      </div>

      {/* 2. Quem já está na sala. Assento vazio não é informação: a capacidade está no
          contador, e uma lista de oito placeholders faz uma sala de 1 parecer deserta. */}
      <div className="flex flex-col gap-1.5">
        <span className="label text-brass">
          Jogadores ({room.seats.length}/{MAX_SEATS})
        </span>
        {room.seats.map((s) => (
          <div
            key={s.uid}
            className="flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-card)] bg-ink-800/70 border border-ink-500"
          >
            <PlayerFace color={s.color} size={30} />
            <span className="text-starlight truncate flex-1 inline-flex items-center gap-2 min-w-0">
              <span className="truncate">{s.name}</span>
              <PieceGlyph id={s.piece} size={14} className="text-starlight-muted/80 shrink-0" />
            </span>
            {s.uid === myUid && <Chip tone="gold">você</Chip>}
            {s.isHost && <Chip>anfitrião</Chip>}
            {!s.connected && <Chip tone="alert">offline</Chip>}
            {isHost && !s.isHost && onKick && (
              <button
                type="button"
                onClick={() => onKick(s.uid)}
                title={`Remover ${s.name} da sala`}
                aria-label={`Remover ${s.name} da sala`}
                className="shrink-0 w-6 h-6 rounded-full grid place-items-center text-starlight-muted/60 hover:text-signal-glow hover:bg-signal/15 transition-colors"
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

      {/* 3. A ação da tela. O motivo de estar desabilitado fica no `title` — antes, o
          botão apagado não dizia o que faltava. */}
      {isHost ? (
        <Button
          disabled={faltam > 0 || starting}
          title={faltam > 0 ? `São necessários pelo menos ${MIN_SEATS} jogadores para começar` : undefined}
          onClick={onStart}
        >
          {starting ? 'Iniciando…' : 'Iniciar partida'}
        </Button>
      ) : (
        <p className="label text-starlight-muted text-center">Aguardando o anfitrião iniciar a partida…</p>
      )}

      {/* 4. Código de reentrada do PRÓPRIO assento (041, D-033/FR-030): visível desde o
          lobby, para quem nunca anotou conseguir ler antes de precisar. É seguro de
          esquecer até a hora em que faz falta — daí o rodapé, atrás do filete. */}
      {myReentryCode && (
        <p className="label text-starlight-muted/85 text-center border-t border-ink-500/70 pt-3 -mt-0.5">
          Seu código de reentrada:{' '}
          <span className="text-starlight tracking-[0.2em] font-mono">{myReentryCode}</span>
        </p>
      )}
    </Frame>
  )
}

// Ordem sorteada da mesa (FR-030): mostrada a todos antes do primeiro turno.
export function TurnOrderReveal({ room, onDone }: { room: Room; onDone: () => void }) {
  return (
    <Frame title="Ordem da mesa" subtitle="Sorteada agora — vale para toda a partida">
      <ol className="flex flex-col gap-1.5">
        {room.seats.map((s, i) => (
          <li
            key={s.uid}
            className="flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-card)] bg-ink-800/70 border border-ink-500"
          >
            <span className="display text-brass text-xl w-7 text-center tabular-nums">{i + 1}º</span>
            <PlayerFace color={s.color} size={30} />
            <span className="text-starlight truncate flex-1">{s.name}</span>
            <PieceGlyph id={s.piece} size={14} className="text-starlight-muted/80 shrink-0" />
          </li>
        ))}
      </ol>
      <Button onClick={onDone}>Começar</Button>
    </Frame>
  )
}

// Reentrada por código (041, D-033) — perder o aparelho deixava a mesa refém; com link +
// código, qualquer aparelho reanexa ao assento. Recusa por 'bad-code' volta AQUI, legível,
// sem sair da tela (roomSession mantém a fase 'reentry').
export function ReentryForm({
  busy,
  error,
  onSubmit,
}: {
  busy?: boolean
  error?: JoinError | string | null
  onSubmit: (code: string) => void
}) {
  const [code, setCode] = useState('')
  const message = error && (error in JOIN_ERROR_TEXT ? JOIN_ERROR_TEXT[error as JoinError] : String(error))

  return (
    <Frame title="Reentrar na sala" subtitle="A partida já começou — informe o código do seu assento">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reentry-code" className="label text-brass">
          Código de reentrada
        </label>
        <input
          id="reentry-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Ex.: 7F3K9M"
          maxLength={6}
          autoFocus
          className="entry-input tracking-[0.3em] uppercase font-mono"
        />
      </div>
      <p className="label text-starlight-muted/85 leading-snug">
        O código fica ao lado do link da sala, no seu próprio assento — visível durante toda a partida.
      </p>
      {message && <p className="text-signal-glow text-sm leading-snug">{message}</p>}
      <Button disabled={code.trim().length === 0 || busy} onClick={() => onSubmit(code.trim())}>
        {busy ? 'Reanexando…' : 'Reanexar'}
      </Button>
    </Frame>
  )
}

// Estados terminais de entrada: link inválido, partida já começada, host ausente.
export function LobbyMessage({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return (
    <Frame title={title}>
      <p className="text-starlight leading-snug">{message}</p>
      {action}
    </Frame>
  )
}
