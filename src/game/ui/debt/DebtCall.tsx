// Cobrança de dívida (050 → 066, SRS §12.2 / D-066).
//
// A superfície precisa cumprir três coisas ao mesmo tempo, e só um lugar da tela cumpre as
// três:
//   1. não esconder casa nenhuma — pagar uma dívida que o caixa não cobre se decide olhando
//      quais propriedades ainda estão livres e quanto cada uma levanta (D-056);
//   2. não mover a mesa — abrir ou fechar a cobrança não pode reposicionar o tabuleiro;
//   3. não ser modal — sem backdrop, sem captura de foco, Esc não fecha (§12.6): sai-se
//      pagando, negociando ou declarando falência.
//
// A faixa ancorada na base (D-056) cumpria (1) pagando (2): reservava a própria altura no
// palco, então o tabuleiro pulava para cima ao abrir e caía de volta ao fechar. O MIOLO do
// tabuleiro cumpre as três de graça — é área sem casa, tem tamanho próprio e não empurra
// nada. Por isso o cartão é portado para o slot que o tabuleiro monta lá dentro
// (`debtSlot.tsx`), e não posicionado pela janela.
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { HandCoins, Landmark } from 'lucide-react'
import { PlayerFace } from '@/boards/PlayerFace'
import { useRoomStore } from '@/net/roomStore'
import { identityOf } from '@/net/identity'
import { PlayerName } from '@/net/ui/PlayerName'
import { Button, MoneyPulse } from '@/game/ui/primitives'
import { isBankrupt, liquidationValue } from '@/game/falencia/falencia'
import { eligibleLenders, loanShortfall } from '@/game/emprestimos/emprestimos'
import { useMotion } from '@/game/ui/motion'
import { useDebtSlot } from './debtSlot'
import type { GameState } from '@/game/turn/types'
import { money as fmt } from '@/lib/money'

/**
 * O pedaço do miolo do tabuleiro reservado à cobrança — sempre montado, quase sempre vazio.
 *
 * Fica aqui, ao lado de quem o preenche, porque a única razão de ele existir é esta cobrança.
 * Não recebe clique (`pointer-events: none`, index.css): dados e histórico seguem vivos atrás
 * do cartão e o tabuleiro inteiro continua operável — a cobrança não é modal (§12.6).
 */
export function DebtSlot() {
  const attach = useDebtSlot((s) => s.attach)
  return <div className="debt-slot" ref={attach} />
}

interface DebtCallProps {
  game: GameState
  amount: number
  creditorId: string | null
  cashPulse: { id: number; d: number } | null
  onPay: () => void
  onProposeLoan: (creditorId: string) => void
  onDeclareBankruptcy: () => void
}

export function DebtCall({
  game,
  amount,
  creditorId,
  cashPulse,
  onPay,
  onProposeLoan,
  onDeclareBankruptcy,
}: DebtCallProps) {
  const room = useRoomStore((s) => s.room)
  const [lendersOpen, setLendersOpen] = useState(false)
  const slot = useDebtSlot((s) => s.node)
  const { reduced } = useMotion()

  const debtor = game.players[game.turnOrder[game.activeSeat]]
  const debtorIdentity = identityOf(room, debtor.id)
  const creditor = creditorId ? identityOf(room, creditorId) : null

  const canPay = debtor.cash >= amount
  const missing = Math.max(0, amount - debtor.cash)
  // O número que faltava na tela: o teto de caixa que o jogador ainda consegue reunir
  // vendendo construções e hipotecando tudo. É a MESMA medida que autoriza a falência
  // (§9.1) — a cobrança nunca pode dizer "ainda dá" com o botão de falir habilitado.
  const capacity = liquidationValue(game, debtor.id)
  const canFalir = isBankrupt(game, debtor.id, amount)
  const covered = Math.max(0, Math.min(1, debtor.cash / amount))
  // Até onde a liquidação levaria a barra — a "sombra" à frente do caixa atual.
  const reachable = Math.max(0, Math.min(1, capacity / amount))

  const shortfall = loanShortfall(game)
  const lenders = eligibleLenders(game)

  const card = (
    <motion.section
      className="debt-call"
      role="region"
      aria-label="Cobrança de dívida"
      initial={reduced ? false : { opacity: 0, scale: 0.94, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 26 }}
    >
      {/* 1. A quem se deve — o mesmo eixo credor↔devedor de sempre. */}
      <header className="debt-call__parties">
        <PlayerFace color={debtorIdentity.color} avatar={debtorIdentity.avatar} skin={debtorIdentity.skin} size={28} />
        <span className="debt-call__arrow" aria-hidden>→</span>
        {creditor ? (
          <PlayerFace color={creditor.color} avatar={creditor.avatar} skin={creditor.skin} size={28} />
        ) : (
          <span className="debt-call__bank"><Landmark size={15} aria-hidden /></span>
        )}
        <span className="debt-call__to">
          <span className="label text-cream-muted">Você deve a</span>
          <strong className="label text-cream">
            {creditorId ? <PlayerName playerId={creditorId} /> : 'Banco'}
          </strong>
        </span>
      </header>

      {/* 2. Quanto, e o quanto disso já está coberto. */}
      <strong className="currency debt-call__value">{fmt(amount)}</strong>

      <div className="debt-call__gauge">
        <div className="debt-call__bar">
          {/* Alcance por liquidação, atrás do caixa: mostra que ainda há saída antes de o
              jogador precisar descobrir isso hipotecando às cegas. */}
          <div className="debt-call__bar-reach" style={{ width: `${reachable * 100}%` }} />
          <motion.div
            className={`debt-call__bar-fill${canPay ? ' is-covered' : ''}`}
            initial={{ width: 0 }}
            animate={{ width: `${covered * 100}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          />
        </div>
        <div className="debt-call__facts">
          <span className="relative inline-block">
            Caixa <strong className="currency text-cream">{fmt(debtor.cash)}</strong>
            <MoneyPulse pulse={cashPulse} className="left-1/2 -translate-x-1/2 -top-4" />
          </span>
          {missing > 0 && <span className="debt-call__missing">Falta <strong className="currency">{fmt(missing)}</strong></span>}
          <span>Levanta até <strong className={`currency ${canFalir ? 'text-signal-glow' : 'text-cream'}`}>{fmt(capacity)}</strong></span>
        </div>
      </div>

      {/* 3. Ações. A escolha de credor abre a partir do cartão — sete adversários eram sete
          botões empilhados, e era isso que fazia o cartão original crescer. */}
      <div className="debt-call__actions">
        {/* O valor sai do rótulo na forma compacta (CSS): num miolo de 230px ele era o que
            empurrava os três botões para fora do tabuleiro. Ele continua no nome acessível,
            e a cifra já está em corpo 2rem duas linhas acima. */}
        <Button onClick={onPay} disabled={!canPay} className="debt-call__pay" aria-label={`Pagar ${fmt(amount)}`}>
          Pagar <span className="debt-call__btn-amount">{fmt(amount)}</span>
        </Button>
        <div className="debt-call__alt">
          {lenders.length > 0 && (
            <div className="debt-call__lenders">
              <Button
                variant="secondary"
                onClick={() => setLendersOpen((open) => !open)}
                aria-expanded={lendersOpen}
                aria-haspopup="menu"
                aria-label={`Pedir ${fmt(shortfall)} emprestado`}
                className="w-full"
              >
                <HandCoins size={15} aria-hidden />
                <span>Pedir <span className="debt-call__btn-amount">{fmt(shortfall)}</span></span>
              </Button>
              {lendersOpen && (
                <LenderMenu
                  lenders={lenders}
                  shortfall={shortfall}
                  onPick={(id) => { onProposeLoan(id); setLendersOpen(false) }}
                  onDismiss={() => setLendersOpen(false)}
                />
              )}
            </div>
          )}
          <Button variant="danger" onClick={onDeclareBankruptcy} disabled={!canFalir} aria-label="Declarar falência" className="debt-call__falir">
            <span className="debt-call__label-full">Declarar falência</span>
            <span className="debt-call__label-short">Falir</span>
          </Button>
        </div>
      </div>

      {/* 4. O que fazer agora, em uma linha — a frase muda com a situação real. */}
      <p className="debt-call__hint">
        {canPay
          ? 'Caixa suficiente: pague para seguir o turno.'
          : canFalir
            ? 'Nem liquidando tudo cobre. Negocie ou declare falência.'
            : 'Hipoteque ou venda no tabuleiro: ainda dá para pagar.'}
      </p>
    </motion.section>
  )

  // Com tabuleiro na tela, o cartão vive no miolo dele. Sem slot (VisualLab, teste que monta
  // só o HUD) ele se centra na janela: a cobrança nunca deixa de aparecer por causa de onde
  // foi montada — ausência de slot é caso legítimo, não erro.
  return slot ? createPortal(card, slot) : <div className="debt-call-free">{card}</div>
}

// Escolha de credor (§15.2), ancorada ao próprio botão. Fecha ao escolher, ao clicar fora ou
// com Esc — este Esc fecha a LISTA, nunca a cobrança (§12.6 continua valendo para o cartão).
function LenderMenu({
  lenders,
  shortfall,
  onPick,
  onDismiss,
}: {
  lenders: string[]
  shortfall: number
  onPick: (creditorId: string) => void
  onDismiss: () => void
}) {
  const room = useRoomStore((s) => s.room)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onDismiss() }
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) onDismiss()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onDismiss])

  return (
    <div ref={ref} className="debt-call__menu" role="menu" aria-label="Escolher credor">
      <p className="label text-cream-muted debt-call__menu-title">Pedir {fmt(shortfall)} emprestado a</p>
      {lenders.map((id) => {
        const lender = identityOf(room, id)
        return (
          <button key={id} type="button" role="menuitem" className="debt-call__menu-item" onClick={() => onPick(id)}>
            <PlayerFace color={lender.color} avatar={lender.avatar} skin={lender.skin} size={22} />
            <span><PlayerName playerId={id} /></span>
          </button>
        )
      })}
    </div>
  )
}
