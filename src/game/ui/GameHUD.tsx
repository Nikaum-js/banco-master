// HUD de decisões (022.1) — barra inferior enxuta. Rolar/resolver/finalizar agora
// são automáticos (DiceArena central + GameDriver) e saíram daqui. A barra só
// aparece quando há uma DECISÃO real para o jogador da vez: prisão, dívida,
// reação (Diplomacia/Bunker), fim de jogo, ou ações opcionais antes de rolar
// (usar Bus Ticket / quitar empréstimo). Sem decisão pendente, não renderiza nada.
import { useState, type ReactNode } from 'react'
import { useGameStore } from '@/game/store'
import { sideOf } from '@/game/turn/turnMachine'
import { BOARD } from '@/lib/boardData'

function Btn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded bg-gold text-coffee-900 font-bold text-sm hover:brightness-110 active:translate-y-px"
    >
      {children}
    </button>
  )
}

export function GameHUD() {
  const game = useGameStore((s) => s.game)
  const jailDecision = useGameStore((s) => s.jailDecision)
  const payDebt = useGameStore((s) => s.payDebt)
  const declareBankruptcy = useGameStore((s) => s.declareBankruptcy)
  const useBusTicket = useGameStore((s) => s.useBusTicket)
  const grantLoan = useGameStore((s) => s.grantLoan)
  const payOffLoan = useGameStore((s) => s.payOffLoan)
  const respondReaction = useGameStore((s) => s.respondReaction)
  const [busArmed, setBusArmed] = useState(false)

  const active = game.players[game.turnOrder[game.activeSeat]]
  const turn = game.turn
  const res = game.resolution
  const loanOfActive = game.loans.find((l) => l.debtorId === active.id) // empréstimo do devedor (010)
  const canPayOff = loanOfActive && active.cash >= loanOfActive.principal

  let actions: ReactNode = null
  if (game.phase === 'ended') {
    const winner = game.players.find((p) => !p.eliminated)
    actions = <span className="text-gold font-bold">🏆 Fim de jogo — vencedor: {winner?.id ?? '—'}</span>
  } else if (res?.kind === 'reaction-diplomacia') {
    actions = (
      <>
        <span>⚡ {res.reactorId}: {res.effect} contra você — usar Diplomacia?</span>
        <Btn onClick={() => respondReaction(true)}>Usar</Btn>
        <Btn onClick={() => respondReaction(false)}>Recusar</Btn>
      </>
    )
  } else if (res?.kind === 'reaction-bunker') {
    actions = (
      <>
        <span>⚡ Imposto ${res.amount} — usar Bunker Fiscal?</span>
        <Btn onClick={() => respondReaction(true)}>Usar</Btn>
        <Btn onClick={() => respondReaction(false)}>Recusar</Btn>
      </>
    )
  } else if (res?.kind === 'debt') {
    const shortfall = res.amount - active.cash
    // §15.2: pedir empréstimo (default principal = déficit, taxa 20%) a quem tiver caixa
    const lenders = loanOfActive
      ? []
      : game.players.filter((p) => p.id !== active.id && !p.eliminated && p.cash >= shortfall && shortfall > 0)
    actions = (
      <>
        <span>💸 Dívida ${res.amount} {res.creditorId ? `a ${res.creditorId}` : 'ao banco'} — venda/hipoteque e pague, peça empréstimo, ou faleça</span>
        <Btn onClick={payDebt}>Pagar</Btn>
        {lenders.map((p) => (
          <Btn key={p.id} onClick={() => grantLoan(p.id, shortfall, 20)}>
            🤝 Pedir ${shortfall} de {p.id} @20%
          </Btn>
        ))}
        <Btn onClick={declareBankruptcy}>Falir</Btn>
      </>
    )
  } else if (turn.state === 'prisao-decisao') {
    const lastTry = active.jail.attempts >= 2 // 3ª tentativa: falhar = paga $50 e sai (regra)
    actions = (
      <>
        <span>
          🔒 Preso — tentativa {active.jail.attempts + 1}/3
          {lastTry && <b className="text-logo"> (se falhar, paga $50 e sai)</b>}
        </span>
        <Btn onClick={() => jailDecision('pay')}>Pagar $50 e sair</Btn>
        <Btn onClick={() => jailDecision('try')}>Tentar dupla</Btn>
      </>
    )
  } else if (turn.state === 'aguardando-rolagem') {
    // Antes de rolar (rolagem é no DiceArena central): só ações OPCIONAIS.
    const canBus = active.busTickets >= 1 && sideOf(active.pos) !== null
    if (busArmed && canBus) {
      const dests = BOARD.filter((sq) => sideOf(sq.pos) === sideOf(active.pos) && sq.pos !== active.pos)
      actions = (
        <>
          <span>🎫 Para onde? (lado atual):</span>
          {dests.map((sq) => (
            <Btn key={sq.pos} onClick={() => { useBusTicket(sq.pos); setBusArmed(false) }}>
              {sq.name} ({sq.pos})
            </Btn>
          ))}
          <Btn onClick={() => setBusArmed(false)}>Cancelar</Btn>
        </>
      )
    } else if (canBus || canPayOff) {
      actions = (
        <>
          {canBus && <Btn onClick={() => setBusArmed(true)}>🎫 Usar Bus Ticket ({active.busTickets})</Btn>}
          {canPayOff && <Btn onClick={payOffLoan}>🤝 Quitar empréstimo (${loanOfActive!.principal})</Btn>}
        </>
      )
    }
  }
  // casa-a-resolver / aguardando-finalizacao: sem botão — o GameDriver resolve e
  // finaliza sozinho (022.1).

  if (!actions) return null // sem decisão pendente → barra some

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-coffee-900/95 border-t-2 border-coffee-500 text-cream px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className="font-bold text-gold">Vez: {active.id}</span>
      <span className="ml-auto flex flex-wrap items-center gap-2">{actions}</span>
    </div>
  )
}
