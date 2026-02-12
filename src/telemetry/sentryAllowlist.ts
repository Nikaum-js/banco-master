// Lista de PERMISSÃO de campos que saem para o Sentry (044, contrato §Exceções — teste
// obrigatório 5). Separada de `sentry.ts` para ficar testável sem importar `@sentry/react`
// — só a regra de filtragem, pura.
//
// Lista de PERMISSÃO, não de bloqueio: uma lista de bloqueio erraria na primeira spec que
// acrescentasse um campo novo ao registro de falha (D-040).
const ALLOWED_FIELDS = ['occurrenceId', 'where', 'phase', 'seq', 'message', 'version'] as const

export function allowlistFields(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of ALLOWED_FIELDS) {
    if (field in obj) out[field] = obj[field]
  }
  return out
}
