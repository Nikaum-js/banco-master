// Telas de sala (spec 037, T018; redesenho no lançamento) — nome + cor + visual + assentos
// + iniciar. Vocabulário visual: a "sala de mapas" do `entryShell` (o mesmo mundo do
// tabuleiro — graticule, latão, marcas de registro) e o PRÓPRIO token do tabuleiro
// (`PlayerFace`) como preview: a pergunta "como eu apareço na mesa?" é respondida
// mostrando, não descrevendo.
import { useEffect, useState } from 'react'
import { Button, Chip } from '@/game/ui/primitives'
import { PlayerFace } from '@/boards/shared'
import { SKINS, type SkinId } from '@/boards/faceSkins'
import {
  availableColors,
  MAX_SEATS,
  MIN_SEATS,
  type JoinError,
  type OpeningMode,
  type Room,
} from '@/net/room'
import { NAME_MAX, recallPlayerName, rememberPlayerName } from '@/net/session'
import { EntryPanel, EntryStage, EntryHeader } from './entryShell'

const JOIN_ERROR_TEXT: Record<JoinError, string> = {
  'room-full': `Sala cheia — o limite é ${MAX_SEATS} jogadores.`,
  'color-taken': 'Essa cor já foi escolhida por outro jogador.',
  // Cor fora da paleta não vem do lobby (a grade só oferece as oito): o texto fala de
  // recomeçar a escolha, não de trocar de cor, porque quem cai aqui está com a tela velha.
  'invalid-color': 'Essa cor não existe mais nesta mesa. Recarregue e escolha de novo.',
  'already-started': 'A partida já começou — não é possível entrar agora.',
  'unknown-uid': 'Sessão não reconhecida nesta sala.',
  kicked: 'O host removeu você desta sala.',
  'bad-code': 'Código de reentrada inválido.',
}

// Moldura comum das telas de sala: palco da sala de mapas + prancha central.
function Frame({
  title,
  subtitle,
  className = '',
  bodyClassName = '',
  children,
}: {
  title: string
  subtitle?: string
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}) {
  return (
    <EntryStage>
      <EntryPanel className={className || 'max-w-md'}>
        <EntryHeader title={title} subtitle={subtitle} />
        <div className={`p-5 pt-4 ${bodyClassName || 'flex flex-col gap-4'}`}>{children}</div>
      </EntryPanel>
    </EntryStage>
  )
}

function OpeningModeMark({ mode }: { mode: OpeningMode }) {
  return (
    <span className="opening-mode-option__mark" aria-hidden>
      {mode === 'sealed-bid' ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m4 8 8-4 8 4v9l-8 3-8-3z" />
          <path d="m4 8 8 4 8-4M12 12v8" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
          <circle cx="16" cy="8" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="8" cy="16" r="1" fill="currentColor" stroke="none" />
          <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
        </svg>
      )}
    </span>
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
  onSubmit: (name: string, color: string) => void
}) {
  const salaVazia: Room = { id: '', status: 'lobby', seats: [] }
  const free = availableColors(room ?? salaVazia)
  // Já vem preenchido com o nome da home (`rememberPlayerName`): aqui a pergunta que
  // sobra é a aparência — o nome só é redigitado por quem quiser trocá-lo.
  const [name, setName] = useState(() => recallPlayerName())
  const [color, setColor] = useState(free[0] ?? '')
  // Visual do personagem — por enquanto SÓ nesta tela (escolha visual, ainda não
  // viaja no `onSubmit` nem entra no assento; a propagação vem depois de fechar o catálogo).
  const [skin, setSkin] = useState<SkinId>('careca')
  const chosen = free.includes(color) ? color : (free[0] ?? '')
  const message = error && (error in JOIN_ERROR_TEXT ? JOIN_ERROR_TEXT[error as JoinError] : String(error))

  return (
    <Frame title={title} subtitle={subtitle}>
      {/* Preview vivo — o token REAL do tabuleiro com a cor escolhida, respirando. */}
      <div className="identity-preview flex items-center gap-3.5 px-4 py-3 rounded-[var(--radius-card)]">
        <PlayerFace color={chosen || 'var(--color-ink-400)'} size={46} active skin={skin} />
        <div className="min-w-0 flex-1">
          <p className={`font-semibold leading-tight truncate ${name.trim() ? 'text-starlight' : 'text-starlight-muted/70'}`}>
            {name.trim() || 'Viajante sem nome'}
          </p>
          <p className="label text-starlight-muted mt-1">
            {SKINS.find((s) => s.id === skin)?.label} · assim você aparece na mesa
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
              className={`w-11 h-11 rounded-full border border-ink-950/60 transition-all ${
                c === chosen
                  ? 'ring-2 ring-brass ring-offset-2 ring-offset-ink-800 scale-105'
                  : 'opacity-80 hover:opacity-100 hover:scale-105'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="label text-brass">Seu visual</span>
        <div className="grid grid-cols-4 gap-2">
          {SKINS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSkin(s.id)}
              aria-label={`Visual ${s.label}`}
              aria-pressed={s.id === skin}
              title={s.label}
              className={`min-h-16 py-1.5 rounded-[var(--radius-card)] border grid place-items-center gap-0.5 transition-all ${
                s.id === skin
                  ? 'border-brass/80 bg-brass/10 text-brass-glow shadow-[var(--shadow-glow)]'
                  : 'border-ink-500 bg-ink-900/60 text-starlight-muted hover:text-starlight hover:border-ink-300'
              }`}
            >
              <PlayerFace color={chosen || 'var(--color-ink-400)'} size={30} skin={s.id} />
              <span className="text-[9px] uppercase tracking-wider leading-none">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {message && <p className="text-signal-glow text-sm leading-snug">{message}</p>}

      <Button
        variant="ghost"
        className="cta-embark py-3 text-sm"
        disabled={!name.trim() || !chosen || busy}
        onClick={() => {
          rememberPlayerName(name)
          onSubmit(name.trim(), chosen)
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
// jogadores", como se ela partisse sozinha ao chegar o segundo — quem começa é o host,
// e 2 é o mínimo, não o número.
export function RoomLobby({
  room,
  myUid,
  myReentryCode,
  isHost,
  link,
  starting,
  onOpeningModeChange,
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
  onOpeningModeChange?: (mode: OpeningMode) => void
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
  const openingMode = room.openingMode ?? 'sealed-bid'

  return (
    <Frame
      title="Sala aberta"
      subtitle={faltam > 0
        ? 'Aguardando jogadores…'
        : openingMode === 'sealed-bid'
          ? 'Ordem por Leilão secreto'
          : 'Ordem por Maior dado'}
    >
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
          {faltam > 0 ? `Pelo menos ${MIN_SEATS} jogadores para começar.` : `Cabem até ${MAX_SEATS} jogadores.`}
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
            className="lobby-seat flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-card)]"
          >
            <PlayerFace color={s.color} size={30} />
            <span className="text-starlight truncate flex-1 inline-flex items-center gap-2 min-w-0">
              <span className="truncate">{s.name}</span>
            </span>
            {s.uid === myUid && <Chip tone="gold">você</Chip>}
            {s.isHost && <Chip>host</Chip>}
            {!s.connected && <Chip tone="alert">offline</Chip>}
            {isHost && !s.isHost && onKick && (
              <button
                type="button"
                onClick={() => onKick(s.uid)}
                title={`Remover ${s.name} da sala`}
                aria-label={`Remover ${s.name} da sala`}
                className="shrink-0 w-11 h-11 -my-2 -mr-2 rounded-full grid place-items-center text-starlight-muted/60 hover:text-signal-glow hover:bg-signal/15 transition-colors"
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

      <fieldset className="flex flex-col gap-1.5">
        <legend className="label text-brass mb-1">Ritual de Largada</legend>
        <div className="opening-mode-picker">
          {([
            { mode: 'sealed-bid', label: 'Leilão secreto', detail: 'Lances lacrados' },
            { mode: 'dice-roll', label: 'Maior dado', detail: 'Sem custo' },
          ] as const).map((option) => {
            const selected = openingMode === option.mode
            return (
              <button
                key={option.mode}
                type="button"
                className={`opening-mode-option ${selected ? 'opening-mode-option--selected' : ''}`}
                aria-pressed={selected}
                disabled={!isHost || starting}
                onClick={() => onOpeningModeChange?.(option.mode)}
              >
                <OpeningModeMark mode={option.mode} />
                <span className="min-w-0 text-left">
                  <strong>{option.label}</strong>
                  <small>{option.detail}</small>
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* 3. A ação da tela. O motivo de estar desabilitado fica no `title` — antes, o
          botão apagado não dizia o que faltava. */}
      {isHost ? (
        <Button
          disabled={faltam > 0 || starting}
          title={faltam > 0 ? `São necessários pelo menos ${MIN_SEATS} jogadores para começar` : undefined}
          onClick={onStart}
        >
          {starting
            ? 'Iniciando…'
            : openingMode === 'sealed-bid'
              ? 'Abrir leilão'
              : 'Rolar e iniciar'}
        </Button>
      ) : (
        <p className="label text-starlight-muted text-center">Aguardando o host iniciar a partida…</p>
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

const money = (amount: number): string => `$${amount.toLocaleString('pt-BR')}`
const DIE_PIPS: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
}

function OpeningDie({ value }: { value: number }) {
  return (
    <span className="opening-die" aria-hidden>
      {(DIE_PIPS[value] ?? DIE_PIPS[1]).map((cell) => <i key={cell} style={{ gridArea: `${Math.ceil(cell / 3)} / ${((cell - 1) % 3) + 1}` }} />)}
    </span>
  )
}

function SealIcon({ locked }: { locked: boolean }) {
  return (
    <span className={`auction-seal ${locked ? 'auction-seal--locked' : ''}`} aria-hidden>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        {locked ? (
          <>
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            <path d="m9.5 15 1.7 1.7 3.7-3.7" />
          </>
        ) : (
          <>
            <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" />
            <path d="m4 7.5 8 5 8-5M12 12.5V21" />
          </>
        )}
      </svg>
    </span>
  )
}

export function OpeningAuction({
  room,
  myUid,
  myBid,
  onBid,
}: {
  room: Room
  myUid: string
  myBid: number | null
  onBid: (amount: number) => void
}) {
  const [amount, setAmount] = useState(myBid ?? 0)
  const [now, setNow] = useState(() => Date.now())
  const closesAt = room.openingAuction?.closesAt ?? now
  const remaining = Math.max(0, closesAt - now)
  const seconds = Math.ceil(remaining / 1_000)
  const progress = Math.max(0, Math.min(1, remaining / 15_000))
  const mine = room.seats.find((seat) => seat.uid === myUid)
  const locked = mine?.bidLocked ?? false

  useEffect(() => {
    const id = setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= closesAt) clearInterval(id)
    }, 100)
    return () => clearInterval(id)
  }, [closesAt])

  return (
    <Frame
      title="Leilão da Largada"
      subtitle="Lances lacrados para escolher a ordem da mesa"
      className="auction-frame"
      bodyClassName="auction-layout"
    >
      <div className="auction-ledger">
        <div
          className="auction-clock"
          style={{ '--auction-progress': `${progress * 360}deg` } as React.CSSProperties}
          aria-label={`${seconds} segundos restantes`}
        >
          <span className="auction-clock__inner">
            <strong>{seconds}</strong>
            <small>seg</small>
          </span>
        </div>
        <div className="min-w-0">
          <span className="label text-brass">Caixa de largada</span>
          <p className="display text-2xl text-starlight mt-0.5">{money(2_000)}</p>
          <p className="text-xs text-starlight-muted leading-snug mt-1">
            Todos pagam o próprio lance. O total abastece a Loteria.
          </p>
        </div>
        <div className="lottery-stack" aria-label="Destino: Loteria">
          <span className="lottery-chip">L</span>
          <span className="lottery-chip">L</span>
          <span className="lottery-chip">L</span>
        </div>
      </div>

      <div className={`auction-bid-card ${locked ? 'auction-bid-card--locked' : ''}`}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <span className="label text-starlight-muted">{locked ? 'Seu lance lacrado' : 'Quanto vale sair primeiro?'}</span>
            <p className="display text-[2.15rem] leading-none text-brass-glow mt-1 tabular-nums">
              {money(myBid ?? amount)}
            </p>
          </div>
          <SealIcon locked={locked} />
        </div>

        <input
          type="range"
          min={0}
          max={500}
          step={50}
          value={myBid ?? amount}
          disabled={locked || remaining === 0}
          onChange={(event) => setAmount(Number(event.target.value))}
          aria-label="Valor do lance"
          className="auction-range"
        />
        <div className="auction-bounds justify-between label text-starlight-muted/80">
          <span>$0</span>
          <span>$500</span>
        </div>

        <Button
          disabled={locked || remaining === 0}
          onClick={() => onBid(amount)}
          className={locked ? 'auction-locked-button' : ''}
        >
          {locked ? 'Lance lacrado' : `Lacrar lance de ${money(amount)}`}
        </Button>
      </div>

      <div className="auction-roster flex flex-col gap-1.5" aria-live="polite">
        {room.seats.map((seat) => (
          <div
            key={seat.uid}
            className={`auction-player ${seat.bidLocked ? 'auction-player--locked' : ''}`}
          >
            <PlayerFace color={seat.color} size={28} />
            <span className="text-starlight truncate flex-1">{seat.name}</span>
            {seat.uid === myUid && <Chip tone="gold">você</Chip>}
            <span className="label text-starlight-muted">
              {seat.bidLocked ? 'lacrado' : 'escolhendo'}
            </span>
            <SealIcon locked={seat.bidLocked ?? false} />
          </div>
        ))}
      </div>
    </Frame>
  )
}

// Revelação automática: mostra ordem + valores, credita a Loteria e segue sem clique.
export function TurnOrderReveal({ room }: { room: Room }) {
  const diceMode = room.openingMode === 'dice-roll'
  const total = room.seats.reduce((sum, seat) => sum + (seat.openingBid ?? 0), 0)
  return (
    <Frame
      title="Rota definida"
      subtitle={diceMode ? 'Maior soma primeiro · embarque automático' : 'Lances revelados · embarque automático'}
      className="auction-frame"
      bodyClassName="auction-layout auction-layout--reveal"
    >
      {diceMode ? (
        <div className="auction-pot-reveal opening-dice-reveal">
          <div className="opening-roll" aria-hidden>
            <OpeningDie value={6} />
            <OpeningDie value={5} />
          </div>
          <div>
            <span className="label text-brass">Maior dado</span>
            <p className="display text-xl text-starlight">Ordem sem custo</p>
          </div>
        </div>
      ) : (
        <div className="auction-pot-reveal">
          <div className="lottery-stack lottery-stack--reveal" aria-hidden>
            <span className="lottery-chip">L</span>
            <span className="lottery-chip">L</span>
            <span className="lottery-chip">L</span>
          </div>
          <div>
            <span className="label text-brass">Crédito na Loteria</span>
            <p className="display text-2xl text-starlight">+{money(total)}</p>
          </div>
        </div>
      )}
      <ol className="auction-roster flex flex-col gap-1.5">
        {room.seats.map((s, i) => {
          const roll = s.openingRoll ?? [1, 1]
          return (
            <li
              key={s.uid}
              className="auction-result-row"
              style={{ animationDelay: `${i * 110}ms` }}
            >
              <span className="display text-brass text-xl w-7 text-center tabular-nums">{i + 1}º</span>
              <PlayerFace color={s.color} size={30} />
              <span className="text-starlight truncate flex-1">{s.name}</span>
              {diceMode ? (
                <span
                  className="opening-roll"
                  role="img"
                  aria-label={`Dados ${roll[0]} e ${roll[1]}, soma ${roll[0] + roll[1]}`}
                >
                  <OpeningDie value={roll[0]} />
                  <OpeningDie value={roll[1]} />
                  <strong>{roll[0] + roll[1]}</strong>
                </span>
              ) : (
                <span className="display text-brass-glow tabular-nums">{money(s.openingBid ?? 0)}</span>
              )}
            </li>
          )
        })}
      </ol>
      <div className="auction-auto-route" role="status">
        <span>Iniciando a partida para todos</span>
        <span className="auction-route-dots" aria-hidden><i /><i /><i /></span>
      </div>
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
