// Fronteira de jogo (spec 042, D-035, US1/US2/US4). Envolve SÓ o conteúdo servido por
// `OnlineGate` — nunca o próprio gate — porque é isso que garante, por construção, que a
// sessão (conexão, presença, autoridade, relógio de prazos) nunca sente a queda (D1 do plan):
// o pai que possui esses efeitos simplesmente não desmonta quando só o filho é substituído.
//
// Remontar é uma TENTATIVA, não um laço (FR-011): a assinatura da falha (nome+mensagem, nunca
// stack — instável entre builds) passa pelo `loopBreaker`, que sobrevive a reload via
// `sessionStorage`. Segunda vez com a MESMA assinatura, mesmo depois de F5, para de oferecer
// retry — é assim que o crash-loop do estado envenenado (log sem descritor) não vira armadilha.
import { Component, type ReactNode } from 'react'
import { registerFailure } from './failureRegistry'
import { createLoopBreaker, type LoopBreaker } from './loopBreaker'
import { FailureScreen } from './FailureScreen'

const STORAGE_KEY = 'bm:boundary:match'

interface MatchBoundaryProps {
  roomId: string | null
  children: ReactNode
  loopBreaker?: LoopBreaker // injetável — os testes usam um store em memória
}

interface MatchBoundaryState {
  error: unknown
  occurrenceId: string | null
  canRetry: boolean
  attempt: number // muda o `key` do filho — é o que força a remontagem de verdade
}

function signatureOf(error: unknown): string {
  if (error instanceof Error) return `${error.name}|${error.message}`
  return String(error)
}

export class MatchErrorBoundary extends Component<MatchBoundaryProps, MatchBoundaryState> {
  state: MatchBoundaryState = { error: null, occurrenceId: null, canRetry: true, attempt: 0 }

  static getDerivedStateFromError(error: unknown): Partial<MatchBoundaryState> {
    return { error }
  }

  componentDidCatch(error: unknown): void {
    const breaker = this.props.loopBreaker ?? createLoopBreaker()
    const outcome = breaker.check(STORAGE_KEY, signatureOf(error))
    const occurrenceId = registerFailure({ where: 'match', error })
    this.setState({ occurrenceId, canRetry: outcome === 'first' })
  }

  retry = (): void => {
    this.setState((s) => ({ error: null, occurrenceId: null, canRetry: true, attempt: s.attempt + 1 }))
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <FailureScreen
          variant="match"
          mode={this.props.roomId ? 'room' : 'local'}
          roomId={this.props.roomId}
          occurrenceId={this.state.occurrenceId ?? ''}
          canRetry={this.state.canRetry}
          onRetry={this.retry}
        />
      )
    }
    // `key` muda a cada retry — é o gatilho de remontagem de verdade (FR-010), não um
    // simples "esconder e mostrar de novo" que reaproveitaria a instância quebrada.
    return <div key={this.state.attempt}>{this.props.children}</div>
  }
}
