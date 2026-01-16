// Tela de falha (spec 042, D-035). Superfície de SESSÃO — nunca de partida: não recebe
// `GameState` nem `Room` como prop (edge case "a exceção acontece na própria tela de falha" —
// a última linha de defesa não pode depender de nada que possa estar envenenado). Tudo que
// ela mostra vem de props estáticas, derivadas da URL por quem a monta, nunca de um store.
import { Home, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { ModalHeader, ModalShell, Overlay } from '@/game/ui/shell'
import { Button } from '@/game/ui/primitives'
import { roomLink } from '@/net/session'

export type FailureVariant = 'match' | 'root'
export type FailureMode = 'room' | 'local' | 'entry'

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
  if (mode === 'entry') {
    return 'Não foi possível abrir esta sessão. Volte ao início e tente novamente.'
  }
  return variant === 'root'
    ? 'Esta partida local não pode ser recuperada — não há nada salvo fora desta aba.'
    : 'Algo deu errado na exibição desta partida local.'
}

export function FailureScreen({ variant, mode, roomId, occurrenceId, canRetry, onRetry }: FailureScreenProps) {
  return (
    <Overlay z={90}>
      <ModalShell className="w-full max-w-[26rem]">
        <ModalHeader
          tone="signal"
          icon={<TriangleAlert size={24} strokeWidth={2.4} aria-hidden />}
          title={TITLE[variant]}
          subtitle={variant === 'root' ? 'A interface não conseguiu continuar' : 'A partida continua protegida'}
        />
        <div className="p-5 flex flex-col gap-4">
          <div className="rounded-[var(--radius-card)] border border-coffee-500 bg-coffee-950/35 p-4">
            <p className="text-cream leading-relaxed">{bodyText(variant, mode)}</p>

            {mode === 'room' && (
              <p className="mt-3 flex items-start gap-2 text-cream-muted/90 leading-snug text-xs">
                <ShieldCheck size={15} className="mt-px shrink-0 text-gold" aria-hidden />
                Nada se perde: saldo, propriedades, cartas e prazos ficam exatamente como estão.
              </p>
            )}
          </div>

          {canRetry && onRetry && (
            <Button className="w-full" onClick={onRetry}>
              <RefreshCw size={15} aria-hidden />
              Voltar para a partida
            </Button>
          )}
          {variant === 'match' && !canRetry && (
            <p className="label text-signal-glow text-center">
              Parou de tentar remontar sozinho — a mesma falha se repetiu.
            </p>
          )}

          {mode === 'room' && roomId && (
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => { window.location.href = roomLink(roomId, window.location.origin) }}
            >
              <RefreshCw size={15} aria-hidden />
              Reabrir a sala
            </Button>
          )}
          {mode === 'local' && (
            <Button className="w-full" variant={canRetry ? 'secondary' : 'primary'} onClick={() => { window.location.href = '/jogar?local=1' }}>
              <RefreshCw size={15} aria-hidden />
              Recomeçar
            </Button>
          )}
          {mode === 'entry' && (
            <Button className="w-full" onClick={() => { window.location.href = '/jogar' }}>
              <Home size={15} aria-hidden />
              Voltar ao início
            </Button>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-coffee-500/80 pt-3">
            <span className="label text-cream-muted/70">Ocorrência:</span>
            <code className="rounded-[var(--radius-sharp)] border border-coffee-500 bg-coffee-950/50 px-2 py-1 text-[10px] font-bold tracking-[0.14em] text-gold">
              {occurrenceId}
            </code>
          </div>
        </div>
      </ModalShell>
    </Overlay>
  )
}
