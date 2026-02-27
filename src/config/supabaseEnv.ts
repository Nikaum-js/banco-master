export type SupabaseEnvIssue =
  | 'missing-url'
  | 'invalid-url'
  | 'missing-anon-key'
  | 'invalid-anon-key'

export interface SupabasePublicEnv {
  url?: string
  anonKey?: string
}

function isHttpUrl(value: string): boolean {
  if (value !== value.trim()) return false
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
  } catch {
    return false
  }
}

function isSupabasePublicKey(value: string): boolean {
  if (value !== value.trim()) return false
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(value)) return true
  return /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
}

/** Valida apenas configuração pública; nunca devolve nem registra os valores recebidos. */
export function validateSupabaseEnv({ url, anonKey }: SupabasePublicEnv): SupabaseEnvIssue[] {
  const issues: SupabaseEnvIssue[] = []

  if (!url) issues.push('missing-url')
  else if (!isHttpUrl(url)) issues.push('invalid-url')

  if (!anonKey) issues.push('missing-anon-key')
  else if (!isSupabasePublicKey(anonKey)) issues.push('invalid-anon-key')

  return issues
}
