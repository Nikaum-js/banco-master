// HUD de decisões (022.1 / redesign 035) — CARD de decisão flutuante e CENTRALIZADO,
// com personalidade visual ("Café Coado + dourado"). Climas distintos:
//   • Empréstimo → solicitação ao credor (§15.2): o credor define a taxa e aceita/recusa.
//   • Reação     → "interrupção/alerta" sóbria e dourada (Diplomacia / Bunker Fiscal).
//   • Fim        → celebração do vencedor (confete + coroa) — NÃO mexer.
// Ações OPCIONAIS não moram aqui: Bus Ticket é canhoto na DiceArena; quitar
// empréstimo vive no LoanPanel lateral. Sem nada pendente → não renderiza.
//
// 050/D-056: a DÍVIDA saiu daqui e virou faixa ancorada (`debt/DebtDock.tsx`). Ela era a
// exceção deste arquivo — o único clima que não podia bloquear a tela, porque a decisão de
// hipotecar ou vender se toma olhando o tabuleiro. Manter uma exceção como cartão não
// resolvia o problema real: não adianta o tabuleiro estar clicável se ele está atrás.
//
// 044/T024 (US3/D-039): reação e empréstimo (`dim`) BLOQUEIAM a tela de verdade (o backdrop
// cobre tudo e recebe clique) — viram diálogo de verdade (role="dialog", trap de foco,
// restauração), via `useDialogA11y`/`ModalTitleContext` de `shell.tsx` (mesmo mecanismo do
// `Overlay`, sem duplicar). SEM `dismissible`: são decisões (D-039 ponto 2 cita "reação"
// nominalmente) — Esc não fecha.
import { type ReactNode, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { HandCoins, Landmark, ShieldAlert } from 'lucide-react'
import { PlayerFace } from '@/boards/PlayerFace'
import { useGameStore } from '@/game/store'
import { useLocalView, useRoomStore } from '@/net/roomStore'
import { identityOf } from '@/net/identity'
import { getActiveSession } from '@/net/activeSession'
import { WaitingBar } from '@/net/ui/WaitingBar'
import { interestOf } from '@/game/emprestimos/emprestimos'
import { DebtDock } from '@/game/ui/debt/DebtDock'
import { activeHudView } from '@/game/ui/panels/activeHudView'
import { EndGameScreen } from '@/game/ui/EndGameScreen'
import { Button, Chip } from '@/game/ui/primitives'
import { useMoneyPulse } from '@/game/ui/useMoneyPulse'
import { useMotion } from '@/game/ui/motion'
import { useDialogA11y, ModalTitleContext } from '@/game/ui/a11y/dialog'
import { ModalHeader } from '@/game/ui/shell'
import type { LoanRequest } from '@/game/economy/types'
import { money as fmt } from '@/lib/money'

const GOLD_TEXT: React.CSSProperties = {
  backgroundImage: 'var(--gradient-brass-shine)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  filter: 'drop-shadow(0 3px 12px color-mix(in srgb, var(--color-brass) 60%, transparent))',
}

// Cascas de largura total sobre o primitivo Button — hierarquia do card de
// decisão: primária e neutra (secondary).
function PrimaryBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Button onClick={onClick} disabled={disabled} className="w-full py-2.5">
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
// Casca do card de decisão CENTRALIZADO. `dim` liga um leve escurecedor de fundo
// (reação/fim podem usar; dívida NÃO, pra não bloquear o tabuleiro). Sem `dim`, o
// container é pointer-events-none e o tabuleiro segue clicável.
function DecisionShell({
  dim = false,
  children,
}: { dim?: boolean; children: ReactNode }) {
  // 044/T024: só o clima `dim` bloqueia a tela de verdade (backdrop cobre tudo e recebe
  // clique) — só ele vira diálogo (foco entra, trap, restaura). A dívida (`dim=false`)
  // fica de fora: pointer-events-none no container, tabuleiro tem que continuar alcançável.
  const containerRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useDialogA11y(containerRef, { active: dim })
  return (
    <ModalTitleContext.Provider value={titleId}>
      <div
        ref={dim ? containerRef : undefined}
        role={dim ? 'dialog' : undefined}
        aria-modal={dim ? true : undefined}
        aria-labelledby={dim ? titleId : undefined}
        tabIndex={dim ? -1 : undefined}
        className={`fixed inset-0 z-[60] flex items-center justify-center p-4 outline-none ${dim ? 'bg-coffee-950/70 backdrop-blur-[2px]' : 'pointer-events-none'}`}
      >
        {children}
      </div>
    </ModalTitleContext.Provider>
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
      className="atlas-surface atlas-surface--decision pointer-events-auto relative max-w-[94vw] overflow-hidden"
      style={{
        width,
        '--atlas-surface-accent': accent,
        boxShadow: `inset 0 1px 0 color-mix(in srgb, ${accent} 12%, transparent), 0 0 0 4px color-mix(in srgb, var(--color-ink-950) 72%, transparent), 0 0 0 5px color-mix(in srgb, ${accent} 18%, transparent), var(--shadow-dropdown), 0 0 34px -10px ${glow}`,
      } as React.CSSProperties}
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
  const room = useRoomStore((s) => s.room)
  const online = room !== null
  // Feedback de caixa (044/T020 — FR-029): a faixa de cobrança mostra o caixa do devedor
  // mudando ao vivo (hipoteca/venda pra cobrir a fatura) sem NENHUM aviso; mesmo pulso que
  // `PlayerRow`/`PotCard` já usam (`primitives.tsx`), não um vocabulário novo.
  const cashPulse = useMoneyPulse(active.cash)
  // PRECEDÊNCIA das cinco telas do HUD vem de `activeHudView` (testada), não da ordem dos
  // `return` abaixo. Adicionar uma sexta tela é editar a tabela, não adivinhar a posição.
  const hud = activeHudView(game)

  // ---- Fim de jogo — classificação completa (044, US2/D-038) ----
  // Substitui a antiga celebração isolada do vencedor: toda tela agora mostra a mesma
  // classificação, do 1º ao último (FR-001), derivada de `matchSummary(game)` dentro do
  // próprio `EndGameScreen`. Online volta à MESMA sala pela sessão ativa (049/D-052);
  // local continua criando um jogo novo no store.
  if (hud?.kind === 'winner') {
    return (
      <AnimatePresence>
        <EndGameScreen
          game={game}
          online={online}
          onExit={() => {
            if (online) void getActiveSession()?.returnToLobby()
            else resetGame()
          }}
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
        <LoanRequestCard req={hud.req} onRespond={respondLoan} />
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

  // ---- Dívida pendente — FAIXA ancorada, não cartão (050/D-056) ----
  // O cartão centralizado saiu daqui de propósito: ele cobria o centro do tabuleiro e as
  // casas em volta, que é exatamente onde a decisão de hipotecar/vender é tomada. A faixa
  // reserva altura do palco (`:root:has(.debt-dock)` em index.css), então a mesa encolhe e
  // continua inteira. Ela também não é modal — sem backdrop, sem trap, sem Esc (§12.6).
  if (hud?.kind === 'debt') {
    if (!view.mayAct('pay-debt')) {
      return (
        <AnimatePresence>
          <WaitingBar playerId={active.id} what="pagamento de dívida" />
        </AnimatePresence>
      )
    }
    return (
      <AnimatePresence>
        <DebtDock
          game={game}
          amount={hud.amount}
          creditorId={hud.creditorId}
          cashPulse={cashPulse}
          onPay={payDebt}
          onProposeLoan={proposeLoan}
          onDeclareBankruptcy={declareBankruptcy}
        />
      </AnimatePresence>
    )
  }

  // Ações opcionais NÃO moram mais aqui: Bus Ticket virou canhoto na zona de
  // ação da DiceArena; quitar empréstimo sempre existiu no LoanPanel lateral.
  return null // sem decisão pendente
}

// Cabeçalho das reações — a mesma prancha integrada dos demais modais. O
// `DecisionShell` continua dono do contexto acessível e do ciclo de vida.
function ReactionHead({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return <ModalHeader icon={icon} title={title} subtitle={subtitle} />
}

const RATE_OPTIONS = [10, 20, 30, 40, 50] as const

// Card da solicitação de empréstimo, na ÓTICA DO CREDOR (§15.2/§15.3): vê quem pede e
// quanto, ESCOLHE a taxa de juros (10–50%) e Empresta ou Recusa. Dim ligado (decisão do
// credor, não precisa do tabuleiro). Estado local só pra taxa selecionada.
function LoanRequestCard({
  req,
  onRespond,
}: {
  req: LoanRequest
  onRespond: (accept: boolean, ratePct: number) => void
}) {
  const [rate, setRate] = useState<number>(20)
  const room = useRoomStore((s) => s.room)
  const debtor = identityOf(room, req.debtorId)
  const interest = interestOf(req.principal, rate) // §15.4 — fórmula do motor, não uma cópia

  return (
    <DecisionShell dim>
      <CardFrame accent="var(--color-brass)" glow="color-mix(in srgb, var(--color-brass) 45%, transparent)" width={400}>
        <ReactionHead icon={<HandCoins size={20} className="text-gold-glow" />} title="Empréstimo" subtitle={`${debtor.name} pede a você`} />
        <div className="p-5">
          {/* Quem pede + quanto */}
          <div className="flex items-center justify-center gap-3">
            <PlayerFace color={debtor.color} avatar={debtor.avatar} skin={debtor.skin} size={44} />
            <div className="text-left">
              <p className="label text-cream-muted leading-none">{debtor.name} precisa de</p>
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
