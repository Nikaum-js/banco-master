// Faixa de cobrança de dívida (050, SRS §12.2 / D-056).
//
// Esta superfície substitui o cartão centralizado. O motivo é mecânico, não estético: a
// cobrança é a ÚNICA decisão do jogo cuja informação necessária está fora dela. Comprar,
// leiloar, reagir a uma carta — tudo se decide com o que está no próprio cartão. Pagar uma
// dívida que o caixa não cobre se decide olhando quais propriedades ainda estão livres e
// quanto cada uma levanta. Um cartão no meio da tela cobria exatamente isso.
//
// A faixa NÃO cobre o tabuleiro: `:root:has(.debt-dock)` reserva a altura dela no palco
// (index.css), então a mesa ENCOLHE e continua inteira. Também não é modal — não escurece,
// não captura foco ao abrir, não prende foco, e Esc não fecha (§12.6): sai-se pagando,
// negociando ou declarando falência.
import { useState, useRef, useEffect, type RefObject } from 'react'
import { motion } from 'motion/react'
import { HandCoins, Landmark } from 'lucide-react'
import { PlayerFace } from '@/boards/PlayerFace'
import { useRoomStore } from '@/net/roomStore'
import { identityOf } from '@/net/identity'
import { PlayerName } from '@/net/ui/PlayerName'
import { Button, MoneyPulse } from '@/game/ui/primitives'
import { isBankrupt, liquidationValue } from '@/game/falencia/falencia'
import { eligibleLenders, loanShortfall } from '@/game/emprestimos/emprestimos'
import type { GameState } from '@/game/turn/types'
import { money as fmt } from '@/lib/money'

interface DebtDockProps {
  game: GameState
  amount: number
  creditorId: string | null
  cashPulse: { id: number; d: number } | null
  onPay: () => void
  onProposeLoan: (creditorId: string) => void
  onDeclareBankruptcy: () => void
}

export function DebtDock({
  game,
  amount,
  creditorId,
  cashPulse,
  onPay,
  onProposeLoan,
  onDeclareBankruptcy,
}: DebtDockProps) {
  const room = useRoomStore((s) => s.room)
  const [lendersOpen, setLendersOpen] = useState(false)
  const dockRef = useReservedHeight()

  const debtor = game.players[game.turnOrder[game.activeSeat]]
  const debtorIdentity = identityOf(room, debtor.id)
  const creditor = creditorId ? identityOf(room, creditorId) : null

  const canPay = debtor.cash >= amount
  const missing = Math.max(0, amount - debtor.cash)
  // O número que faltava na tela: o teto de caixa que o jogador ainda consegue reunir
  // vendendo construções e hipotecando tudo. É a MESMA medida que autoriza a falência
  // (§9.1) — a faixa nunca pode dizer "ainda dá" com o botão de falir habilitado.
  const capacity = liquidationValue(game, debtor.id)
  const canFalir = isBankrupt(game, debtor.id, amount)
  const covered = Math.max(0, Math.min(1, debtor.cash / amount))
  // Até onde a liquidação levaria a barra — a "sombra" à frente do caixa atual.
  const reachable = Math.max(0, Math.min(1, capacity / amount))

  const shortfall = loanShortfall(game)
  const lenders = eligibleLenders(game)

  return (
    <motion.section
      ref={dockRef}
      className="debt-dock"
      role="region"
      aria-label="Cobrança de dívida"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
    >
      {/* 1. A quem se deve — mesmo eixo credor↔devedor do cartão antigo, deitado. */}
      <div className="debt-dock__parties">
        <PlayerFace color={debtorIdentity.color} avatar={debtorIdentity.avatar} skin={debtorIdentity.skin} size={30} />
        <span className="debt-dock__arrow" aria-hidden>→</span>
        {creditor ? (
          <PlayerFace color={creditor.color} avatar={creditor.avatar} skin={creditor.skin} size={30} />
        ) : (
          <span className="debt-dock__bank"><Landmark size={16} aria-hidden /></span>
        )}
        <span className="debt-dock__to">
          <span className="label text-cream-muted">Você deve a</span>
          <strong className="label text-cream">
            {creditorId ? <PlayerName playerId={creditorId} /> : 'Banco'}
          </strong>
        </span>
      </div>

      {/* 2. Quanto, e o quanto disso já está coberto. */}
      <div className="debt-dock__amount">
        <strong className="currency debt-dock__value">{fmt(amount)}</strong>
      </div>

      <div className="debt-dock__gauge">
        <div className="debt-dock__bar">
          {/* Alcance por liquidação, atrás do caixa: mostra que ainda há saída antes de o
              jogador precisar descobrir isso hipotecando às cegas. */}
          <div className="debt-dock__bar-reach" style={{ width: `${reachable * 100}%` }} />
          <motion.div
            className={`debt-dock__bar-fill${canPay ? ' is-covered' : ''}`}
            initial={{ width: 0 }}
            animate={{ width: `${covered * 100}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          />
        </div>
        <div className="debt-dock__facts">
          <span className="relative inline-block">
            Caixa <strong className="currency text-cream">{fmt(debtor.cash)}</strong>
            <MoneyPulse pulse={cashPulse} className="left-1/2 -translate-x-1/2 -top-4" />
          </span>
          {missing > 0 && <span className="debt-dock__missing">Falta <strong className="currency">{fmt(missing)}</strong></span>}
          <span>Levanta até <strong className={`currency ${canFalir ? 'text-signal-glow' : 'text-cream'}`}>{fmt(capacity)}</strong></span>
        </div>
      </div>

      {/* 3. Ações. A escolha de credor abre acima da faixa — sete adversários eram sete
          botões empilhados, e era isso que fazia o cartão antigo crescer. */}
      <div className="debt-dock__actions">
        <Button onClick={onPay} disabled={!canPay} className="debt-dock__pay">Pagar {fmt(amount)}</Button>
        {lenders.length > 0 && (
          <div className="debt-dock__lenders">
            <Button
              variant="secondary"
              onClick={() => setLendersOpen((open) => !open)}
              aria-expanded={lendersOpen}
              aria-haspopup="menu"
            >
              <HandCoins size={15} aria-hidden />
              <span>Pedir {fmt(shortfall)}</span>
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
        <Button variant="danger" onClick={onDeclareBankruptcy} disabled={!canFalir} aria-label="Declarar falência">
          <span className="debt-dock__label-full">Declarar falência</span>
          <span className="debt-dock__label-short">Falir</span>
        </Button>
      </div>

      {/* 4. O que fazer agora, em uma linha — a frase muda com a situação real. */}
      <p className="debt-dock__hint">
        {canPay
          ? 'Caixa suficiente: pague para seguir o turno.'
          : canFalir
            ? 'Nem liquidando tudo cobre. Negocie ou declare falência.'
            : 'Hipoteque ou venda no tabuleiro: ainda dá para pagar.'}
      </p>
    </motion.section>
  )
}

/**
 * Publica a altura REAL da faixa em `--debt-dock-h`, que o palco usa para encolher o
 * tabuleiro (index.css).
 *
 * A primeira versão reservava um número fixo por breakpoint, e a verificação em 740×360
 * mostrou por que isso não podia funcionar: a faixa media 119px onde o CSS prometia 68, os
 * botões tinham quebrado em duas linhas, e o tabuleiro voltou a ficar por baixo — exatamente
 * o defeito que a D-056 existe para matar. Altura de conteúdo em texto de tamanho variável
 * não é previsível o bastante para ser escrita à mão em três breakpoints.
 *
 * Medir fecha o buraco por construção: a reserva É a altura, em qualquer viewport, com
 * qualquer nome de jogador.
 */
function useReservedHeight(): RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const publish = (): void => root.style.setProperty('--debt-dock-h', `${Math.ceil(el.getBoundingClientRect().height)}px`)
    publish()
    // `ResizeObserver` não existe em toda suíte de teste em jsdom; a medida inicial já vale.
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(publish) : null
    observer?.observe(el)
    return () => {
      observer?.disconnect()
      root.style.removeProperty('--debt-dock-h')
    }
  }, [])
  return ref
}

// Escolha de credor (§15.2), ancorada acima da faixa. Fecha ao escolher, ao clicar fora ou
// com Esc — este Esc fecha a LISTA, nunca a cobrança (§12.6 continua valendo para a faixa).
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
    <div ref={ref} className="debt-dock__menu" role="menu" aria-label="Escolher credor">
      <p className="label text-cream-muted debt-dock__menu-title">Pedir {fmt(shortfall)} emprestado a</p>
      {lenders.map((id) => {
        const lender = identityOf(room, id)
        return (
          <button key={id} type="button" role="menuitem" className="debt-dock__menu-item" onClick={() => onPick(id)}>
            <PlayerFace color={lender.color} avatar={lender.avatar} skin={lender.skin} size={22} />
            <span><PlayerName playerId={id} /></span>
          </button>
        )
      })}
    </div>
  )
}
