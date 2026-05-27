// HUD de decisões (022.1 / redesign 035) — CARD de decisão flutuante e CENTRALIZADO,
// com personalidade visual ("Café Coado + dourado"). Climas distintos:
//   • Dívida     → "conta vencida": valor enorme com glow/pulso, eixo credor↔devedor
//                  com o PlayerFace do credor (conecta com o tabuleiro). Falência só
//                  habilita quando insolvente de verdade (§9.1).
//   • Empréstimo → solicitação ao credor (§15.2): o credor define a taxa e aceita/recusa.
//   • Reação     → "interrupção/alerta" sóbria e dourada (Diplomacia / Bunker Fiscal).
//   • Fim        → celebração do vencedor (confete + coroa) — NÃO mexer.
// NÃO usa backdrop bloqueante na dívida: o container é pointer-events-none e só o
// card recebe cliques (pointer-events-auto), então o tabuleiro segue clicável pra
// hipotecar/vender e juntar caixa antes de "Pagar". Demais climas podem ter leve dim.
// Ações OPCIONAIS não moram aqui: Bus Ticket é canhoto na DiceArena; quitar
// empréstimo vive no LoanPanel lateral. Sem nada pendente → não renderiza.
import { type ReactNode, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { HandCoins, Landmark, ShieldAlert } from 'lucide-react'
import { PlayerFace } from '@/boards/shared'
import { PLAYER_COLORS } from '@/game/ui/panels/playersView'
import { useGameStore } from '@/game/store'
import { useLocalView, useRoomStore } from '@/net/roomStore'
import { PlayerName } from '@/net/ui/PlayerName'
import { WaitingBar } from '@/net/ui/WaitingBar'
import { isBankrupt } from '@/game/falencia/falencia'
import { eligibleLenders, interestOf, loanShortfall } from '@/game/emprestimos/emprestimos'
import { activeHudView } from '@/game/ui/panels/activeHudView'
import { EndGameScreen } from '@/game/ui/EndGameScreen'
import { Button, Chip, MoneyPulse } from '@/game/ui/primitives'
import { useMoneyPulse } from '@/game/ui/useMoneyPulse'
import { useMotion } from '@/game/ui/motion'
import type { LoanRequest } from '@/game/economy/types'
import { money as fmt } from '@/lib/money'

const GOLD_TEXT: React.CSSProperties = {
  backgroundImage: 'var(--gradient-brass-shine)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  filter: 'drop-shadow(0 3px 12px color-mix(in srgb, var(--color-brass) 60%, transparent))',
}

// Gradiente "signal quente" pro número da dívida — vermelho com brilho,
// clima de fatura vencida (não dourado de prêmio).
const SIGNAL_TEXT: React.CSSProperties = {
  backgroundImage: 'var(--gradient-signal-shine)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  filter: 'drop-shadow(0 3px 14px color-mix(in srgb, var(--color-signal) 55%, transparent))',
}


// Cor do jogador por id (mesma paleta de assento do tabuleiro/tokens). Mantém o
// credor visualmente ligado à sua carinha no board.
function colorOfPlayer(players: { id: string }[], id: string | null): string | null {
  if (!id) return null
  const i = players.findIndex((p) => p.id === id)
  return i >= 0 ? PLAYER_COLORS[i % PLAYER_COLORS.length] : null
}

// Cascas de largura total sobre o primitivo Button — hierarquia do card de
// decisão: primária (latão + glow), neutra (secondary) e destrutiva (danger).
function PrimaryBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-2.5 shadow-[0_2px_10px_-2px_color-mix(in_srgb,var(--color-brass)_50%,transparent)]"
    >
      {children}
    </Button>
  )
}
function GhostBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button variant="secondary" onClick={onClick} className="w-full">
      {children}
    </Button>
  )
}
function DangerBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Button variant="danger" onClick={onClick} disabled={disabled} className="w-full">
      {children}
    </Button>
  )
}

// Casca do card de decisão CENTRALIZADO. `dim` liga um leve escurecedor de fundo
// (reação/fim podem usar; dívida NÃO, pra não bloquear o tabuleiro). Sem `dim`, o
// container é pointer-events-none e o tabuleiro segue clicável.
function DecisionShell({
  dim = false,
  children,
}: { dim?: boolean; children: ReactNode }) {
  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 ${dim ? 'bg-coffee-950/70 backdrop-blur-[2px]' : 'pointer-events-none'}`}
    >
      {children}
    </div>
  )
}

// Moldura do card — borda dourada fina, sombra dropdown, textura sutil. Entrada com
// spring (escala + leve subida).
function CardFrame({
  accent,
  glow,
  width = 420,
  children,
}: { accent: string; glow: string; width?: number; children: ReactNode }) {
  const { reduced } = useMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.9, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 8 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 26 }}
      className="pointer-events-auto relative max-w-[94vw] bg-coffee-800 rounded-[var(--radius-modal)] overflow-hidden"
      style={{
        width,
        border: `1.5px solid ${accent}`,
        boxShadow: `var(--shadow-dropdown), 0 0 0 1px color-mix(in srgb, var(--color-ink-950) 60%, transparent), 0 0 34px -10px ${glow}`,
      }}
    >
      {/* textura de papel + brilho de topo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, var(--color-brass) 10%, transparent) 0%, transparent 55%)',
        }}
        aria-hidden
      />
      <div className="relative">{children}</div>
    </motion.div>
  )
}

export function GameHUD() {
  const game = useGameStore((s) => s.game)
  const dispatch = useGameStore((s) => s.dispatch)
  const resetGame = useGameStore((s) => s.resetGame)
  const payDebt = (): void => dispatch({ kind: 'pay-debt' })
  const declareBankruptcy = (): void => dispatch({ kind: 'declare-bankruptcy' })
  const proposeLoan = (creditorId: string): void => dispatch({ kind: 'propose-loan', creditorId })
  const respondLoan = (accept: boolean, ratePct: number): void => dispatch({ kind: 'respond-loan', accept, ratePct })
  const respondReaction = (use: boolean): void => dispatch({ kind: 'respond-reaction', use })

  const active = game.players[game.turnOrder[game.activeSeat]]
  const view = useLocalView() // spec 038: controles só do assento local (FR-002)
  const online = useRoomStore((s) => s.room !== null)
  const { reduced } = useMotion()
  // Feedback de caixa (044/T020 — FR-029): a tela de dívida mostra o caixa do devedor
  // mudando ao vivo (hipoteca/venda pra cobrir a fatura) sem NENHUM aviso; mesmo pulso que
  // `PlayerRow`/`PotCard` já usam (`primitives.tsx`), não um vocabulário novo.
  const cashPulse = useMoneyPulse(active.cash)
  // PRECEDÊNCIA das cinco telas do HUD vem de `activeHudView` (testada), não da ordem dos
  // `return` abaixo. Adicionar uma sexta tela é editar a tabela, não adivinhar a posição.
  const hud = activeHudView(game)

  const activeColor = colorOfPlayer(game.players, active.id) ?? 'var(--color-brass)'

  // ---- Fim de jogo — classificação completa (044, US2/D-038) ----
  // Substitui a antiga celebração isolada do vencedor: toda tela agora mostra a mesma
  // classificação, do 1º ao último (FR-001), derivada de `matchSummary(game)` dentro do
  // próprio `EndGameScreen`. O botão de saída mantém o comportamento de sempre — online
  // não tem revanche (spec 038, FR-027); local pode recomeçar.
  if (hud?.kind === 'winner') {
    return (
      <AnimatePresence>
        <EndGameScreen
          game={game}
          online={online}
          onExit={() => (online ? (window.location.search = '') : resetGame())}
        />
      </AnimatePresence>
    )
  }

  // ---- Solicitação de empréstimo aguardando o credor (§15.2/§15.3) ----
  if (hud?.kind === 'loan-request') {
    if (!view.mayAct('respond-loan')) {
      return (
        <AnimatePresence>
          <WaitingBar playerId={hud.req.creditorId} what="resposta ao empréstimo" />
        </AnimatePresence>
      )
    }
    return (
      <AnimatePresence>
        <LoanRequestCard req={hud.req} players={game.players} onRespond={respondLoan} />
      </AnimatePresence>
    )
  }

  // ---- Reação: Diplomacia ----
  if (hud?.kind === 'reaction-diplomacia') {
    if (!view.mayAct('respond-reaction')) {
      return (
        <AnimatePresence>
          <WaitingBar playerId={hud.reactorId} what="reação à carta ofensiva" />
        </AnimatePresence>
      )
    }
    return (
      <AnimatePresence>
        <DecisionShell dim>
          <CardFrame accent="var(--color-brass)" glow="color-mix(in srgb, var(--color-brass) 45%, transparent)" width={400}>
            <ReactionHead icon={<ShieldAlert size={20} className="text-gold-glow" />} title="Reação" subtitle="Carta ofensiva contra você" />
            <div className="p-5">
              <div className="flex items-center justify-center gap-2">
                <span className="label text-cream-muted">Efeito</span>
                <Chip tone="gold" className="text-sm normal-case">{hud.effect}</Chip>
              </div>
              <div className="flex gap-2 mt-5">
                <PrimaryBtn onClick={() => respondReaction(true)}>Usar Diplomacia</PrimaryBtn>
                <GhostBtn onClick={() => respondReaction(false)}>Recusar</GhostBtn>
              </div>
            </div>
          </CardFrame>
        </DecisionShell>
      </AnimatePresence>
    )
  }

  // ---- Reação: Bunker Fiscal ----
  if (hud?.kind === 'reaction-bunker') {
    if (!view.mayAct('respond-reaction')) {
      return (
        <AnimatePresence>
          <WaitingBar playerId={hud.reactorId} what="reação ao imposto" />
        </AnimatePresence>
      )
    }
    return (
      <AnimatePresence>
        <DecisionShell dim>
          <CardFrame accent="var(--color-brass)" glow="color-mix(in srgb, var(--color-brass) 45%, transparent)" width={400}>
            <ReactionHead icon={<Landmark size={20} className="text-gold-glow" />} title="Reação" subtitle="Imposto sobre você" />
            <div className="p-5">
              <p className="text-center currency leading-none" style={{ fontSize: 40, ...GOLD_TEXT }}>{fmt(hud.amount)}</p>
              <div className="flex gap-2 mt-5">
                <PrimaryBtn onClick={() => respondReaction(true)}>Usar Bunker</PrimaryBtn>
                <GhostBtn onClick={() => respondReaction(false)}>Recusar</GhostBtn>
              </div>
            </div>
          </CardFrame>
        </DecisionShell>
      </AnimatePresence>
    )
  }

  // ---- Dívida pendente — "conta vencida" ----
  if (hud?.kind === 'debt') {
    if (!view.mayAct('pay-debt')) {
      return (
        <AnimatePresence>
          <WaitingBar playerId={active.id} what="pagamento de dívida" />
        </AnimatePresence>
      )
    }
    const shortfall = loanShortfall(game)
    const canPay = active.cash >= hud.amount
    // Elegibilidade vem do MOTOR (§15.2): antes esta lista refazia à mão 5 das 8 guardas
    // de `proposeLoan`, e deixava `paused` de fora.
    const lenders = eligibleLenders(game).map((id) => game.players.find((p) => p.id === id)!)
    const creditorColor = colorOfPlayer(game.players, hud.creditorId)
    // % do valor já coberto pelo caixa atual — alimenta a barra credor↔devedor.
    const covered = Math.max(0, Math.min(1, active.cash / hud.amount))
    // §9.1: só pode declarar falência se nem liquidando tudo cobre a dívida.
    const canFalir = isBankrupt(game, active.id, hud.amount)

    return (
      <AnimatePresence>
        {/* SEM dim: tabuleiro precisa continuar clicável (hipotecar/vender). */}
        <DecisionShell>
          <CardFrame accent="var(--color-signal)" glow="color-mix(in srgb, var(--color-signal) 50%, transparent)" width={420}>
            {/* Cabeçalho de fatura — faixa cobre/vermelho */}
            <div
              className="px-5 py-3 border-b-2 border-coffee-950"
              style={{ background: 'var(--gradient-signal)' }}
            >
              <p className="label tracking-[var(--tracking-caps)]" style={{ color: 'color-mix(in srgb, var(--color-signal-glow) 35%, white)' }}>Conta vencida</p>
              <h3 className="display text-2xl leading-none text-cream mt-0.5">Dívida</h3>
            </div>

            <div className="p-5">
              {/* Eixo CREDOR ↔ DEVEDOR — carinhas dos dois lados (credor = PlayerFace
                  na cor do assento; banco = ícone Landmark). Liga visualmente ao board. */}
              <div className="flex items-center justify-between gap-3">
                {/* Devedor (jogador da vez) */}
                <div className="flex flex-col items-center gap-1 w-20">
                  <PlayerFace color={activeColor} size={40} />
                  <span className="label text-cream truncate max-w-full">
                    <PlayerName playerId={active.id} />
                  </span>
                </div>

                {/* Trilho de fluxo com seta animada do devedor → credor. Loop ambiente de
                    1.1s, fora do vocabulário por design (D7 — coreografia de urgência da
                    "conta vencida", mesma categoria da exceção do fim de jogo); some sob
                    movimento reduzido — a seta parada ainda comunica o sentido do fluxo. */}
                <div className="relative flex-1 h-px my-4">
                  <div className="absolute inset-0 top-1/2 -translate-y-1/2 h-[2px] bg-coffee-500" />
                  {!reduced && (
                    <>
                      <motion.div
                        className="absolute top-1/2 -translate-y-1/2 h-[2px]"
                        style={{ background: 'linear-gradient(90deg, transparent, var(--color-signal-glow))' }}
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <motion.span
                        className="absolute top-1/2 -translate-y-1/2 text-signal-glow text-lg leading-none"
                        initial={{ left: '0%', opacity: 0 }}
                        animate={{ left: '92%', opacity: [0, 1, 1, 0] }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        →
                      </motion.span>
                    </>
                  )}
                  {reduced && (
                    <span className="absolute top-1/2 -translate-y-1/2 left-[92%] text-signal-glow text-lg leading-none">→</span>
                  )}
                </div>

                {/* Credor — PlayerFace na cor do assento, ou banco */}
                <div className="flex flex-col items-center gap-1 w-20">
                  {hud.creditorId && creditorColor ? (
                    <PlayerFace color={creditorColor} size={40} />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-coffee-900 border border-brass/50">
                      <Landmark size={20} className="text-gold" />
                    </div>
                  )}
                  <span className="label text-cream truncate max-w-full">{hud.creditorId ?? 'Banco'}</span>
                </div>
              </div>

              {/* Valor devido — número enorme em cobre, com pulso de glow contínuo. Outro
                  loop ambiente fora do vocabulário (D7); sem ele sob movimento reduzido, o
                  glow fica fixo no ponto médio — o valor (o FATO) nunca deixou de aparecer. */}
              <motion.p
                className="text-center currency leading-none mt-4"
                style={{ fontSize: 46, ...SIGNAL_TEXT }}
                animate={reduced ? {
                  filter: 'drop-shadow(0 3px 17px color-mix(in srgb, var(--color-signal) 55%, transparent))',
                } : {
                  filter: [
                    'drop-shadow(0 3px 14px color-mix(in srgb, var(--color-signal) 40%, transparent))',
                    'drop-shadow(0 3px 20px color-mix(in srgb, var(--color-signal) 70%, transparent))',
                    'drop-shadow(0 3px 14px color-mix(in srgb, var(--color-signal) 40%, transparent))',
                  ],
                }}
                transition={reduced ? { duration: 0 } : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                {fmt(hud.amount)}
              </motion.p>

              {/* Barra de cobertura: quanto o caixa já cobre da dívida */}
              <div className="mt-3">
                <div className="h-2 rounded-full bg-coffee-950 overflow-hidden border border-coffee-600">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: canPay
                        ? 'linear-gradient(90deg, var(--color-brass-soft), var(--color-brass-glow))'
                        : 'linear-gradient(90deg, var(--color-signal-deep), var(--color-signal-glow))',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${covered * 100}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="label text-cream-muted relative inline-block">
                    Caixa <span className="text-cream currency">{fmt(active.cash)}</span>
                    <MoneyPulse pulse={cashPulse} className="left-1/2 -translate-x-1/2 -top-4" />
                  </span>
                  {shortfall > 0 && (
                    <span className="label text-signal-glow">
                      Falta <span className="currency">{fmt(shortfall)}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <PrimaryBtn onClick={payDebt} disabled={!canPay}>Pagar {fmt(hud.amount)}</PrimaryBtn>
                {lenders.map((p) => {
                  const lc = colorOfPlayer(game.players, p.id)
                  return (
                    <Button
                      key={p.id}
                      variant="secondary"
                      onClick={() => proposeLoan(p.id)}
                      className="w-full justify-start gap-2"
                    >
                      {lc && <PlayerFace color={lc} size={22} />}
                      <span className="flex-1 text-left">
                        Pedir {fmt(shortfall)} a <PlayerName playerId={p.id} />
                      </span>
                      <HandCoins size={15} className="text-gold-glow shrink-0" />
                    </Button>
                  )
                })}
                <DangerBtn onClick={declareBankruptcy} disabled={!canFalir}>Declarar falência</DangerBtn>
              </div>

              {!canPay && (
                <p className="text-center label text-cream-muted mt-3 normal-case">
                  {canFalir
                    ? 'Hipoteque ou venda no tabuleiro pra cobrir o que falta.'
                    : 'Hipoteque ou venda no tabuleiro: ainda dá pra pagar.'}
                </p>
              )}
            </div>
          </CardFrame>
        </DecisionShell>
      </AnimatePresence>
    )
  }

  // Ações opcionais NÃO moram mais aqui: Bus Ticket virou canhoto na zona de
  // ação da DiceArena; quitar empréstimo sempre existiu no LoanPanel lateral.
  return null // sem decisão pendente
}

// Cabeçalho das reações — faixa dourada, ícone num selo redondo escuro, título +
// subtítulo curto. Clima de "interrupção/alerta" sóbrio.
function ReactionHead({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div
      className="relative flex items-center gap-3 px-5 py-3 border-b-2 border-coffee-950"
      style={{ background: 'var(--gradient-brass)' }}
    >
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 14, delay: 0.1 }}
        className="w-9 h-9 rounded-full flex items-center justify-center bg-coffee-900 shrink-0"
        style={{ boxShadow: 'inset 0 0 0 1.5px color-mix(in srgb, var(--color-brass-glow) 60%, transparent)' }}
      >
        {icon}
      </motion.div>
      <div className="min-w-0">
        <h3 className="display text-xl leading-none text-coffee-900">{title}</h3>
        <p className="label text-coffee-900/80 leading-none mt-1 normal-case">{subtitle}</p>
      </div>
    </div>
  )
}

const RATE_OPTIONS = [10, 20, 30, 40, 50] as const

// Card da solicitação de empréstimo, na ÓTICA DO CREDOR (§15.2/§15.3): vê quem pede e
// quanto, ESCOLHE a taxa de juros (10–50%) e Empresta ou Recusa. Dim ligado (decisão do
// credor, não precisa do tabuleiro). Estado local só pra taxa selecionada.
function LoanRequestCard({
  req,
  players,
  onRespond,
}: {
  req: LoanRequest
  players: { id: string }[]
  onRespond: (accept: boolean, ratePct: number) => void
}) {
  const [rate, setRate] = useState<number>(20)
  const debtorColor = colorOfPlayer(players, req.debtorId) ?? 'var(--color-brass)'
  const interest = interestOf(req.principal, rate) // §15.4 — fórmula do motor, não uma cópia

  return (
    <DecisionShell dim>
      <CardFrame accent="var(--color-brass)" glow="color-mix(in srgb, var(--color-brass) 45%, transparent)" width={400}>
        <ReactionHead icon={<HandCoins size={20} className="text-gold-glow" />} title="Empréstimo" subtitle={`${req.debtorId} pede a você`} />
        <div className="p-5">
          {/* Quem pede + quanto */}
          <div className="flex items-center justify-center gap-3">
            <PlayerFace color={debtorColor} size={44} />
            <div className="text-left">
              <p className="label text-cream-muted leading-none">{req.debtorId} precisa de</p>
              <p className="currency leading-none mt-1" style={{ fontSize: 30, ...GOLD_TEXT }}>{fmt(req.principal)}</p>
            </div>
          </div>

          {/* Taxa de juros — definida pelo credor (§15.3) */}
          <p className="label text-cream-muted text-center mt-5">Sua taxa de juros</p>
          <div className="flex gap-1.5 mt-2">
            {RATE_OPTIONS.map((r) => {
              const on = r === rate
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRate(r)}
                  className={`flex-1 py-2 rounded-[var(--radius-sharp)] font-bold text-sm transition-all ${
                    on
                      ? 'bg-gold text-coffee-900 shadow-[var(--shadow-glow)]'
                      : 'bg-coffee-700 border border-coffee-500 text-cream-muted hover:border-gold'
                  }`}
                >
                  {r}%
                </button>
              )
            })}
          </div>
          <p className="label text-cream-muted text-center mt-3 normal-case">
            Você recebe <span className="currency text-gold-glow">{fmt(interest)}</span> de juros a cada volta dele pelo GO
          </p>

          <div className="flex gap-2 mt-5">
            <PrimaryBtn onClick={() => onRespond(true, rate)}>Emprestar a {rate}%</PrimaryBtn>
            <GhostBtn onClick={() => onRespond(false, rate)}>Recusar</GhostBtn>
          </div>
        </div>
      </CardFrame>
    </DecisionShell>
  )
}
