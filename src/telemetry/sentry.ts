// Sentry — EXCEÇÃO deliberada à porta `Telemetry` (044, T047 / contrato §Exceções). Falha
// de jogador é outra categoria de dado: precisa de pilha, agrupamento e alerta, que uma
// tabela `insert` não dá. Por isso mora fora de `port.ts`, mas com a MESMA disciplina de
// privacidade (D-040) — lista de PERMISSÃO de campos, `sendDefaultPii: false`.
import * as Sentry from '@sentry/react'
import { onFailure, type FailureRecord } from '@/app/failureRegistry'
import { allowlistFields } from './sentryAllowlist'

/** Chamado uma vez no boot (`main.tsx`). Sem `VITE_SENTRY_DSN`, NENHUM código de
 *  monitoramento roda — nem `Sentry.init`, nem a assinatura do `failureRegistry`
 *  (FR-038/D-040: ausente = nenhum código de monitoramento roda). */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) return

  Sentry.init({
    dsn,
    release: import.meta.env.VITE_COMMIT_SHA as string | undefined,
    sendDefaultPii: false, // sem replay de sessão, sem captura de entrada do usuário (D-040)
    beforeSend(event) {
      // Lista de PERMISSÃO, não de bloqueio (contrato): uma lista de bloqueio erraria na
      // primeira spec que acrescentasse um campo novo ao registro de falha.
      if (event.extra) event.extra = allowlistFields(event.extra)
      const failure = event.contexts?.failure
      if (failure) event.contexts = { ...event.contexts, failure: allowlistFields(failure) }
      return event
    },
  })

  // A 042 continua sendo a ÚNICA fonte do `occurrenceId` (FR-039) — este `onFailure` é a
  // mudança ADITIVA que a 042 ganha aqui: nenhuma contenção, loop-breaker ou tela de falha
  // muda de comportamento por causa dele.
  onFailure((record: FailureRecord) => {
    const version = import.meta.env.VITE_COMMIT_SHA as string | undefined
    const context = allowlistFields({ ...record, version })
    Sentry.captureMessage(record.message, { level: 'error', contexts: { failure: context } })
  })
}
