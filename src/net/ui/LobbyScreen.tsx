// Telas de sala (spec 037, T018; redesenho no lançamento) — nome + cor + avatar + assentos
// + iniciar. Vocabulário visual: a "sala de mapas" do `entryShell` (o mesmo mundo do
// tabuleiro — graticule, latão, marcas de registro).
import { useEffect, useRef, useState } from 'react'
import { Button, Chip } from '@/game/ui/primitives'
import { Dice, ROLL_DURATION_MS } from '@/game/ui/dice'
import { useMotion } from '@/game/ui/motion'
import { PlayerFace } from '@/boards/PlayerFace'
import { DEFAULT_AVATAR, type AvatarId } from '@/boards/playerAvatarCatalog'
import { DEFAULT_SKIN, type SkinId } from '@/boards/playerSkinCatalog'
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
import { AvatarPickers, AvatarPreview } from './AvatarConceptLab'
import { RoomInviteDialog } from './RoomInviteDialog'

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
  onSubmit: (name: string, color: string, avatar: AvatarId, skin: SkinId) => void
}) {
  const salaVazia: Room = { id: '', status: 'lobby', seats: [] }
  const free = availableColors(room ?? salaVazia)
  // Já vem preenchido com o nome da home (`rememberPlayerName`): aqui a pergunta que
  // sobra é a aparência — o nome só é redigitado por quem quiser trocá-lo.
  const [name, setName] = useState(() => recallPlayerName())
  const [color, setColor] = useState(free[0] ?? '')
  const [avatar, setAvatar] = useState<AvatarId>(DEFAULT_AVATAR)
  const [skin, setSkin] = useState<SkinId>(DEFAULT_SKIN)
  const chosen = free.includes(color) ? color : (free[0] ?? '')
  const message = error && (error in JOIN_ERROR_TEXT ? JOIN_ERROR_TEXT[error as JoinError] : String(error))

  return (
    <Frame
      title={title}
      subtitle={subtitle}
      className="identity-frame max-w-[54rem]"
      bodyClassName="identity-layout"
    >
      {/* A identidade vira uma ficha de viajante: preview grande e controles lado a lado,
          mesma composição mapa + ação da home. */}
      <section className="identity-passport">
        <div className="identity-passport__head">
          <p className="home-map-panel__eyebrow">Seu personagem</p>
          <span aria-hidden>BM · 01</span>
        </div>
        <AvatarPreview
          color={chosen || 'var(--color-ink-400)'}
          avatar={avatar}
          skin={skin}
        />
        <div className="identity-passport__name">
          <p className={name.trim() ? 'text-starlight' : 'text-starlight-muted/70'}>
            {name.trim() || 'Viajante sem nome'}
          </p>
        </div>
      </section>

      <section className="identity-controls">
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
          <div className="identity-color-grid">
            {free.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Cor ${c}`}
                aria-pressed={c === chosen}
                style={{ '--identity-color': c } as React.CSSProperties}
                className="identity-color-swatch"
              />
            ))}
          </div>
        </div>

        <AvatarPickers
          className="identity-avatar-pickers"
          color={chosen || 'var(--color-ink-400)'}
          avatar={avatar}
          skin={skin}
          onAvatarChange={setAvatar}
          onSkinChange={setSkin}
        />

        {message && <p className="text-signal-glow text-sm leading-snug">{message}</p>}

        <Button
          variant="ghost"
          className="identity-submit py-3 text-sm"
          disabled={!name.trim() || !chosen || busy}
          onClick={() => {
            rememberPlayerName(name)
            onSubmit(name.trim(), chosen, avatar, skin)
          }}
        >
          {busy ? 'Conectando…' : cta}
        </Button>
      </section>
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
  const [inviteOpen, setInviteOpen] = useState(false)

  function copy(): void {
    void navigator.clipboard?.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  const faltam = MIN_SEATS - room.seats.length
  const awaitingRematch = room.status === 'ended'
  const openingMode = room.openingMode ?? 'sealed-bid'
  const compactLink = link.replace(/^https?:\/\//, '')
  const waitingCopy = faltam === 1
    ? 'Falta 1 jogador para liberar a largada'
    : `Faltam ${faltam} jogadores para liberar a largada`

  return (
    <Frame
      title={awaitingRematch ? 'De volta à sala' : 'Sala aberta'}
      subtitle={awaitingRematch
        ? 'Aguardando o host preparar a revanche'
        : faltam > 0
        ? 'Aguardando jogadores…'
        : openingMode === 'sealed-bid'
          ? 'Ordem por Leilão secreto'
          : 'Ordem por Maior dado'}
      className="lobby-frame max-w-[54rem]"
      bodyClassName="lobby-layout"
    >
      <section className="lobby-column">
      {/* 1. Convite — o PRIMEIRO bloco da tela. Numa sala recém-criada não há nada a fazer
          além de chamar gente; deixar o link abaixo da lista de assentos enterrava a única
          ação que importa naquele momento. */}
      <div className="lobby-section">
        <div className="lobby-section-heading">
          <span className="label text-brass">Convite da sala</span>
          <span className="lobby-section-meta">Sala {room.id.toUpperCase()}</span>
        </div>
        <div className="lobby-invite">
          <span className="lobby-invite__mark" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M10.5 13.5a4 4 0 0 0 5.66 0l2.34-2.34a4 4 0 0 0-5.66-5.66L11.5 6.84" />
              <path d="M13.5 10.5a4 4 0 0 0-5.66 0L5.5 12.84a4 4 0 0 0 5.66 5.66l1.34-1.34" />
            </svg>
          </span>
          <span className="lobby-invite__copy">
            <strong>Link pronto para compartilhar</strong>
            <code title={link}>{compactLink}</code>
          </span>
          <button
            type="button"
            className="lobby-copy-action"
            onClick={copy}
            aria-label={copied ? 'Link da sala copiado' : 'Copiar link da sala'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              {copied ? (
                <path d="m5 12 4 4L19 6" />
              ) : (
                <>
                  <rect x="8" y="8" width="11" height="11" rx="1.5" />
                  <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-10A1.5 1.5 0 0 0 3 5.5v10A1.5 1.5 0 0 0 4.5 17H8" />
                </>
              )}
            </svg>
            {copied ? 'Copiado' : 'Copiar link'}
          </button>
        </div>
        <button
          type="button"
          className="lobby-share-action"
          onClick={() => setInviteOpen(true)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="m8.7 10.6 6.6-4.1M8.7 13.4l6.6 4.1" />
          </svg>
          Compartilhar sala
        </button>
      </div>

      {/* 2. Quem já está na sala. Assento vazio não é informação: a capacidade está no
          contador, e uma lista de oito placeholders faz uma sala de 1 parecer deserta. */}
      <div className="lobby-section">
        <div className="lobby-section-heading">
          <span className="label text-brass">Jogadores</span>
          <span className="lobby-section-meta">
            <strong>{room.seats.length}</strong> de {MAX_SEATS}
          </span>
        </div>
        <div className="lobby-roster">
        {room.seats.map((s, index) => (
          <div
            key={s.uid}
            className="lobby-player"
          >
            <span className="lobby-player__number" aria-hidden>
              {String(index + 1).padStart(2, '0')}
            </span>
            <PlayerFace color={s.color} avatar={s.avatar} skin={s.skin} size={34} />
            <span className="lobby-player__identity">
              <strong>{s.name}</strong>
              <small>
                {s.uid === myUid ? 'Seu assento' : `Jogador ${index + 1}`}
                {s.isHost ? ' · Host' : ''}
              </small>
            </span>
            <span
              className={`lobby-player__connection ${s.connected ? 'lobby-player__connection--online' : ''}`}
              title={s.connected ? `${s.name} está online` : `${s.name} está offline`}
            >
              <i aria-hidden />
              <span className="sr-only">{s.connected ? 'online' : 'offline'}</span>
            </span>
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
      </div>
      </section>

      <section className="lobby-column lobby-column--launch">
      <fieldset className="lobby-launch-fieldset">
        <legend className="label text-brass">Ritual de largada</legend>
        <p className="lobby-launch-intro">Escolha como a primeira posição será definida.</p>
        <div className="opening-mode-picker">
          {([
            {
              mode: 'sealed-bid',
              label: 'Leilão secreto',
              detail: 'Lances definem a ordem e abastecem a Loteria.',
            },
            {
              mode: 'dice-roll',
              label: 'Maior dado',
              detail: 'Cada jogador rola dois dados, um por vez e sem custo.',
            },
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
                <span className="opening-mode-option__radio" aria-hidden>
                  <i />
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
          variant="ghost"
          className="lobby-start-cta"
          disabled={faltam > 0 || starting}
          title={faltam > 0 ? `São necessários pelo menos ${MIN_SEATS} jogadores para começar` : undefined}
          onClick={onStart}
        >
          {starting
            ? 'Iniciando…'
            : faltam > 0
              ? waitingCopy
              : openingMode === 'sealed-bid'
                ? 'Abrir leilão'
                : 'Abrir disputa'}
        </Button>
      ) : (
        <p className="label text-starlight-muted text-center">
          {awaitingRematch
            ? 'Seu lugar está guardado. O host ainda está na classificação…'
            : 'Aguardando o host iniciar a partida…'}
        </p>
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
      </section>
      {inviteOpen && <RoomInviteDialog link={link} onClose={() => setInviteOpen(false)} />}
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

// Quanto tempo o resultado fica anunciado DEPOIS de o dado 3D pousar, antes de o foco
// passar ao próximo. O tumble em si (`ROLL_DURATION_MS`, o mesmo do tabuleiro) vem antes:
// enquanto o cubo gira, a tela segue dizendo "está rolando" — soma, líder e roster só
// atualizam quando o dado assenta, como na arena de dados do tabuleiro.
const OPENING_REVEAL_HOLD_MS = 1500

export function OpeningRolls({
  room,
  myUid,
  onRoll,
}: {
  room: Room
  myUid: string
  onRoll: () => void
}) {
  const rolled = room.seats.filter((seat) => seat.openingRoll !== null)
  const current = room.seats.find((seat) => seat.openingRoll === null)
  const inFlight = current?.openingRollResolvesAt != null

  // Mesmos dados 3D do tabuleiro (`game/ui/dice`), mesma coreografia: o clique abre a
  // janela pública (D-051) e os dados chacoalham; quando a autoridade revela o
  // resultado (`openingRoll` sai de null), o tumble dispara e pousa na face certa —
  // em TODAS as telas, não só na de quem clicou. `landed` divide o reveal em duas fases:
  // enquanto o cubo tomba, o resultado NÃO é anunciado (como na arena do tabuleiro);
  // pousou, a soma entra e fica em cartaz por OPENING_REVEAL_HOLD_MS.
  const { reduced } = useMotion()
  const [reveal, setReveal] = useState<{ uid: string; rollKey: number; landed: boolean } | null>(null)
  const prevRolled = useRef<Record<string, boolean> | null>(null)
  const landTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const seen: Record<string, boolean> = {}
    for (const seat of room.seats) seen[seat.uid] = seat.openingRoll !== null
    const before = prevRolled.current
    prevRolled.current = seen
    if (before === null) return // primeiro snapshot (entrada/reconexão): sem replay
    const justRolled = room.seats.find((seat) => seat.openingRoll !== null && before[seat.uid] === false)
    if (!justRolled) return
    const tumbleMs = reduced ? 0 : ROLL_DURATION_MS
    setReveal((r) => ({ uid: justRolled.uid, rollKey: (r?.rollKey ?? 0) + 1, landed: tumbleMs === 0 }))
    if (landTimer.current) clearTimeout(landTimer.current)
    if (revealTimer.current) clearTimeout(revealTimer.current)
    landTimer.current = setTimeout(() => {
      setReveal((r) => (r ? { ...r, landed: true } : r))
    }, tumbleMs)
    // Último arremesso: não devolve o foco a ninguém — o resultado fica em cartaz até a
    // autoridade fechar a disputa e trocar de tela (a janela de revelação do host).
    const isLast = room.seats.every((seat) => seat.openingRoll !== null)
    if (!isLast) {
      revealTimer.current = setTimeout(() => setReveal(null), tumbleMs + OPENING_REVEAL_HOLD_MS)
    }
  }, [room.seats, reduced])
  useEffect(() => () => {
    if (landTimer.current) clearTimeout(landTimer.current)
    if (revealTimer.current) clearTimeout(revealTimer.current)
  }, [])

  const revealSeat = reveal ? room.seats.find((seat) => seat.uid === reveal.uid) ?? null : null
  const landed = reveal?.landed ?? false
  const focus = revealSeat ?? current ?? null
  const focusRoll = revealSeat?.openingRoll ?? null
  const focusSum = focusRoll ? focusRoll[0] + focusRoll[1] : 0

  // O assento cujo dado ainda está no ar não entra em líder/roster — o fato só existe
  // publicamente quando o cubo assenta.
  const settled = rolled.filter((seat) => !(seat.uid === reveal?.uid && !landed))
  const leader = settled.reduce<Room['seats'][number] | null>((best, seat) => {
    if (!best) return seat
    const bestTotal = (best.openingRoll?.[0] ?? 0) + (best.openingRoll?.[1] ?? 0)
    const seatTotal = (seat.openingRoll?.[0] ?? 0) + (seat.openingRoll?.[1] ?? 0)
    return seatTotal > bestTotal ? seat : best
  }, null)
  const leaderTotal = (leader?.openingRoll?.[0] ?? 0) + (leader?.openingRoll?.[1] ?? 0)

  return (
    <Frame
      title="Disputa de dados"
      subtitle="Um arremesso por vez · maior soma começa"
      className="opening-rolls-frame"
      bodyClassName="opening-rolls-layout"
    >
      {focus && (
        <section
          className={`opening-rolls-focus ${inFlight && !revealSeat ? 'opening-rolls-focus--moving' : ''}`}
          role="status"
          aria-live="polite"
        >
          <div className="opening-rolls-focus__player">
            <PlayerFace color={focus.color} avatar={focus.avatar} skin={focus.skin} size={48} />
            <div>
              <span className="label text-brass">{revealSeat ? 'Na mesa' : 'Vez de jogar'}</span>
              <p className="display text-xl text-starlight">
                {revealSeat
                  ? landed ? `${focus.name} tirou ${focusSum}` : `${focus.name} está rolando`
                  : inFlight ? `${focus.name} está rolando` : `${focus.name} joga agora`}
              </p>
            </div>
          </div>

          <span
            className={`opening-rolls-dice ${inFlight && !revealSeat ? 'opening-rolls-dice--moving' : ''}`}
            role="img"
            aria-label={revealSeat && landed
              ? `Dados de ${focus.name}: ${focusRoll?.[0]} e ${focusRoll?.[1]}, soma ${focusSum}`
              : revealSeat || inFlight
                ? `Dados de ${focus.name} em movimento`
                : `Dados de ${focus.name} aguardando arremesso`}
          >
            <Dice value={focusRoll?.[0] ?? 3} rollKey={reveal?.rollKey ?? 0} />
            <Dice value={focusRoll?.[1] ?? 5} rollKey={reveal?.rollKey ?? 0} />
          </span>
        </section>
      )}

      {leader && (
        <p className="opening-rolls-leader">
          <span aria-hidden>◆</span>
          {leader.name} lidera com {leaderTotal}
        </p>
      )}

      <ol className="opening-rolls-roster">
        {room.seats.map((seat, index) => {
          const isCurrent = seat.uid === current?.uid
          // Dado ainda no ar: o roster também espera o pouso pra estampar a soma.
          const inTumble = seat.uid === reveal?.uid && !landed
          const roll = inTumble ? null : seat.openingRoll
          const sum = (roll?.[0] ?? 0) + (roll?.[1] ?? 0)
          return (
            <li
              key={seat.uid}
              className={`opening-rolls-player ${isCurrent ? 'opening-rolls-player--current' : ''}`}
            >
              <span className="opening-rolls-player__number" aria-hidden>
                {String(index + 1).padStart(2, '0')}
              </span>
              <PlayerFace color={seat.color} avatar={seat.avatar} skin={seat.skin} size={30} />
              <span className="opening-rolls-player__identity">
                <strong>{seat.name}</strong>
                <small>
                  {roll ? `Soma ${sum}` : inTumble ? 'rolando' : isCurrent ? 'na mesa' : 'aguardando'}
                </small>
              </span>
              {roll ? (
                <span
                  className="opening-roll opening-rolls-player__dice"
                  role="img"
                  aria-label={`Dados de ${seat.name}: ${roll[0]} e ${roll[1]}, soma ${sum}`}
                >
                  <OpeningDie value={roll[0]} />
                  <OpeningDie value={roll[1]} />
                  <strong>{sum}</strong>
                </span>
              ) : (
                <span className="opening-rolls-player__state">
                  {inTumble ? 'rolando' : isCurrent ? (inFlight ? 'rolando' : 'sua vez') : 'em espera'}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {reveal && !landed && revealSeat ? (
        // Dado no ar: ninguém age até ele pousar — nem o próximo da fila.
        <p className="opening-rolls-wait">A mesa acompanha {revealSeat.name}</p>
      ) : current?.uid === myUid && !inFlight ? (
        <Button className="opening-rolls-action" onClick={onRoll}>
          Rolar meus dados
        </Button>
      ) : current ? (
        <p className="opening-rolls-wait">
          {inFlight ? `A mesa acompanha ${current.name}` : `Aguardando ${current.name} rolar`}
        </p>
      ) : null}
    </Frame>
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
            <PlayerFace color={seat.color} avatar={seat.avatar} skin={seat.skin} size={28} />
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
              <PlayerFace color={s.color} avatar={s.avatar} skin={s.skin} size={30} />
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
