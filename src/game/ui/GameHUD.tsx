// HUD mínimo funcional — barra de controle que dirige o store (motor 002–006).
// Demo LOCAL de 1 cliente (multiplayer fica para M3). Mostra o estado do turno
// e expõe os comandos conforme o estado da máquina (rolar/resolver/comprar/finalizar/prisão).
import type { ReactNode } from 'react'
import { useGameStore } from '@/game/store'
import { BOARD } from '@/lib/boardData'

function priceOf(pos: number): number {
  const sq = BOARD[pos]
  return 'price' in sq ? sq.price : 0
}

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
  const rollDice = useGameStore((s) => s.rollDice)
  const resolvePending = useGameStore((s) => s.resolvePending)
  const finalizeTurn = useGameStore((s) => s.finalizeTurn)
  const buyProperty = useGameStore((s) => s.buyProperty)
  const declineProperty = useGameStore((s) => s.declineProperty)
  const jailDecision = useGameStore((s) => s.jailDecision)
  const chooseCardShortcut = useGameStore((s) => s.chooseCardShortcut)
  const discardCard = useGameStore((s) => s.discardCard)
  const placeBid = useGameStore((s) => s.placeBid)
  const passBid = useGameStore((s) => s.passBid)
  const payDebt = useGameStore((s) => s.payDebt)
  const declareBankruptcy = useGameStore((s) => s.declareBankruptcy)

  const active = game.players[game.turnOrder[game.activeSeat]]
  const turn = game.turn
  const roll = turn.lastRoll
  const res = game.resolution
  const here = BOARD[active.pos]

  let actions: ReactNode = null
  if (game.phase === 'ended') {
    const winner = game.players.find((p) => !p.eliminated)
    actions = <span className="text-gold font-bold">🏆 Fim de jogo — vencedor: {winner?.id ?? '—'}</span>
  } else if (res?.kind === 'debt') {
    actions = (
      <>
        <span>💸 Dívida ${res.amount} {res.creditorId ? `a ${res.creditorId}` : 'ao banco'} — venda/hipoteque e pague, ou faleça</span>
        <Btn onClick={payDebt}>Pagar</Btn>
        <Btn onClick={declareBankruptcy}>Falir</Btn>
      </>
    )
  } else if (res?.kind === 'purchase') {
    actions = (
      <>
        <span>
          Comprar <b>{BOARD[res.pos].name}</b> por <b>${priceOf(res.pos)}</b>?
        </span>
        <Btn onClick={buyProperty}>Comprar</Btn>
        <Btn onClick={declineProperty}>Recusar → leilão</Btn>
      </>
    )
  } else if (res?.kind === 'auction' || res?.kind === 'house-auction') {
    const a = res.auction
    actions = (
      <>
        <span>
          Leilão · lance <b>${a.currentBid}</b> ({a.highBidder ?? '—'})
        </span>
        <Btn onClick={() => placeBid(active.id, a.currentBid + 50)}>Lance +$50</Btn>
        {res.kind === 'auction' && <Btn onClick={() => passBid(active.id)}>Passar</Btn>}
        <span className="text-cream-muted text-xs">(fecha sozinho em ~10s)</span>
      </>
    )
  } else if (res?.kind === 'card-discard') {
    actions = (
      <>
        <span>Mão cheia — descarte 1:</span>
        {active.hand.map((id) => (
          <Btn key={id} onClick={() => discardCard(id)}>
            {id}
          </Btn>
        ))}
      </>
    )
  } else if (res?.kind === 'card-shortcut') {
    actions = (
      <>
        <span>Atalho — mover 3:</span>
        <Btn onClick={() => chooseCardShortcut('frente')}>Frente</Btn>
        <Btn onClick={() => chooseCardShortcut('tras')}>Trás</Btn>
      </>
    )
  } else if (turn.state === 'prisao-decisao') {
    actions = (
      <>
        <span>🔒 Preso — tentativa {active.jail.attempts + 1}/3</span>
        <Btn onClick={() => jailDecision('pay')}>Pagar $50</Btn>
        <Btn onClick={() => jailDecision('try')}>Tentar dupla</Btn>
      </>
    )
  } else if (turn.state === 'aguardando-rolagem') {
    actions = <Btn onClick={rollDice}>🎲 Rolar Dados</Btn>
  } else if (turn.state === 'casa-a-resolver') {
    actions = <Btn onClick={resolvePending}>Resolver: {here.name}</Btn>
  } else if (turn.state === 'aguardando-finalizacao') {
    actions = <Btn onClick={finalizeTurn}>{turn.mayRollAgain ? 'Dupla → rolar de novo' : 'Finalizar Turno'}</Btn>
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-coffee-900/95 border-t-2 border-coffee-500 text-cream px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className="font-bold text-gold">Vez: {active.id}</span>
      <span>💰 ${active.cash}</span>
      <span>📍 {here.name} ({active.pos})</span>
      <span>🎴 {active.hand.length}/3</span>
      <span>🎫 {active.busTickets}</span>
      <span>🎲 {roll ? `${roll.white[0]}+${roll.white[1]}${typeof roll.speed === 'number' ? `+${roll.speed}` : roll.speed ? `+${roll.speed}` : ''}` : '—'}</span>
      <span className="text-cream-muted">🏦 {game.bank.houses}🏠 {game.bank.hotels}🏨</span>
      <span className="text-gold-glow">🅿️ ${game.centerPot}</span>
      <span className="ml-auto flex flex-wrap items-center gap-2">{actions}</span>
    </div>
  )
}
