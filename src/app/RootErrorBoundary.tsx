// Fronteira de último recurso (spec 042, D-035, US3). Cobre a casca de sessão e o boot —
// tudo que `OnlineGate`/`App` decidem renderizar. Classe porque `componentDidCatch` não tem
// equivalente em hook. `leaveOnFatalError()` roda em `componentDidCatch` — commit da fronteira
// já aconteceu (a promessa de FR-006 é sobre o que o jogador PERCEBE: o browser só pinta
// depois que a call stack síncrona termina, e `componentDidCatch` roda dentro dela).
//
// Deriva `mode`/`roomId` da PRÓPRIA URL, nunca de `getActiveSession()` — a sessão pode estar
// no meio da queda que este componente está tratando (edge case "a exceção acontece na
// própria tela de falha": a última linha de defesa não lê nada que possa estar envenenado).
import { Component, type ReactNode } from 'react'
import { getActiveSession } from '@/net/activeSession'
import { parseRoomLink } from '@/net/session'
import { registerFailure } from './failureRegistry'
import { FailureScreen, type FailureMode } from './FailureScreen'

interface RootBoundaryState {
  error: unknown
  occurrenceId: string | null
}

function readMode(): { mode: FailureMode; roomId: string | null } {
  const q = new URLSearchParams(window.location.search)
  if (q.has('local') || q.has('players')) return { mode: 'local', roomId: null }
  const link = parseRoomLink(window.location.search)
  if (link.roomId) return { mode: 'room', roomId: link.roomId }
  return { mode: 'local', roomId: null } // boot/home: sem sala ainda — mesmo caminho de "recomeçar"
}

export class RootErrorBoundary extends Component<{ children: ReactNode }, RootBoundaryState> {
  state: RootBoundaryState = { error: null, occurrenceId: null }

  static getDerivedStateFromError(error: unknown): Partial<RootBoundaryState> {
    return { error }
  }

  componentDidCatch(error: unknown): void {
    getActiveSession()?.leaveOnFatalError() // FR-006 — antes do jogador PERCEBER a tela de falha
    const occurrenceId = registerFailure({ where: 'root', error })
    this.setState({ occurrenceId })
  }

  render(): ReactNode {
    if (this.state.error) {
      const { mode, roomId } = readMode()
      return (
        <FailureScreen
          variant="root"
          mode={mode}
          roomId={roomId}
          occurrenceId={this.state.occurrenceId ?? ''}
          canRetry={false}
        />
      )
    }
    return this.props.children
  }
}
