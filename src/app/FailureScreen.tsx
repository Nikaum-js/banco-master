// Tela de falha (spec 042, D-035). Superfície de SESSÃO — nunca de partida: não recebe
// `GameState` nem `Room` como prop (edge case "a exceção acontece na própria tela de falha" —
// a última linha de defesa não pode depender de nada que possa estar envenenado). Tudo que
// ela mostra vem de props estáticas, derivadas da URL por quem a monta, nunca de um store.
import { ModalHeader, ModalShell } from '@/game/ui/shell'
import { Button } from '@/game/ui/primitives'
import { roomLink } from '@/net/session'

export type FailureVariant = 'match' | 'root'
export type FailureMode = 'room' | 'local'

export interface FailureScreenProps {
  variant: FailureVariant
  mode: FailureMode
  roomId: string | null
  occurrenceId: string
  canRetry: boolean
  onRetry?: () => void
}

const TITLE: Record<FailureVariant, string> = {
  match: 'Algo quebrou na tela',
  root: 'A sessão foi interrompida',
}

// FR-013/FR-014: em sala, a sessão sobrevive (fronteira de jogo) OU a queda virou desconexão
// (fronteira de último recurso) — os dois casos afirmam o que está preservado. Em local, só
// a fronteira de último recurso promete "não recuperável" — a de jogo apenas remonta em
// memória (o `useGameStore` não foi tocado pela queda da vista), então não finge perda.
function bodyText(variant: FailureVariant, mode: FailureMode): string {
  if (mode === 'room') {
    return variant === 'match'
      ? 'Algo deu errado na exibição. Isso não é o fim da partida.'
      : 'A sessão nesta aba caiu — sua ausência foi avisada à mesa como uma queda de conexão comum.'
  }
  return variant === 'root'
    ? 'Esta partida local não pode ser recuperada — não há nada salvo fora desta aba.'
    : 'Algo deu errado na exibição desta partida local.'
}

export function FailureScreen({ variant, mode, roomId, occurrenceId, canRetry, onRetry }: FailureScreenProps) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-coffee-950">
      <ModalShell className="w-full max-w-md">
        <ModalHeader title={TITLE[variant]} center />
        <div className="p-4 flex flex-col gap-4">
          <p className="text-cream leading-snug">{bodyText(variant, mode)}</p>

          {mode === 'room' && (
            <p className="text-cream-muted/85" style={{ fontSize: 10 }}>
              Nada se perde: saldo, propriedades, cartas e prazos ficam exatamente como estão.
            </p>
          )}

          {canRetry && onRetry && <Button onClick={onRetry}>Voltar para a partida</Button>}
          {variant === 'match' && !canRetry && (
            <p className="label text-signal-glow">
              Parou de tentar remontar sozinho — a mesma falha se repetiu.
            </p>
          )}

          {mode === 'room' && roomId && (
            <Button
              variant="secondary"
              onClick={() => { window.location.href = roomLink(roomId, window.location.origin) }}
            >
              Reabrir a sala
            </Button>
          )}
          {mode === 'local' && (
            <Button variant={canRetry ? 'secondary' : 'primary'} onClick={() => { window.location.href = '/?local=1' }}>
              Recomeçar
            </Button>
          )}

          <p className="text-cream-muted/85" style={{ fontSize: 10 }}>Ocorrência: {occurrenceId}</p>
        </div>
      </ModalShell>
    </div>
  )
}
