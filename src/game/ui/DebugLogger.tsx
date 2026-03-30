// DebugLogger (dev) — joga o estado no console do browser a cada mudança, em vez
// de um painel na tela. Abra o DevTools (F12 → Console): cada transição loga um
// resumo técnico + o objeto `game` inteiro (expansível/inspecionável), e cada
// nova entrada do log de eventos aparece como `[log] who: what`. Headless.
import { useEffect, useRef } from 'react'
import { useGameStore } from '@/game/store'
import { BOARD } from '@/lib/boardData'

export function DebugLogger() {
  const game = useGameStore((s) => s.game)
  const lastLen = useRef(0)

  useEffect(() => {
    const t = game.turn
    const r = t.lastRoll
    // Resumo técnico legível + o objeto cru (pra expandir/copiar no console).
    console.log(
      `%c[banco] state=${t.state} seat=${game.activeSeat} doubles=${t.consecutiveDoubles} mayRollAgain=${t.mayRollAgain} pending=${t.pendingResolve} awaiting=${t.awaitingChoice} resolution=${game.resolution?.kind ?? 'null'} roll=${r ? `${r.white[0]}+${r.white[1]}/${String(r.speed)}` : '—'}`,
      'color:#22c55e',
      {
        turn: t,
        resolution: game.resolution,
        phase: game.phase,
        players: game.players.map((p) => ({
          id: p.id,
          pos: p.pos,
          casa: BOARD[p.pos]?.name,
          cash: p.cash,
          hand: p.hand,
          busTickets: p.busTickets,
          primeiraVolta: p.completouPrimeiraVolta,
          jail: p.jail,
          eliminated: p.eliminated,
        })),
        bank: game.bank,
        centerPot: game.centerPot,
        loans: game.loans,
        immunities: game.immunities,
        tempEffects: game.tempEffects,
        game, // objeto inteiro pra inspecionar / "Store as global variable"
      },
    )

    // Novas entradas do log de eventos do jogo.
    if (game.log.length > lastLen.current) {
      for (const e of game.log.slice(lastLen.current)) {
        console.log(`%c[log] ${e.who}: ${e.what}`, 'color:#d4af37')
      }
    }
    lastLen.current = game.log.length
  }, [game])

  return null
}
