import { describe, expect, it } from 'vitest'
import { validateSupabaseEnv } from '@/config/supabaseEnv'

describe('validateSupabaseEnv', () => {
  const valid = {
    url: 'https://abcdefgh.supabase.co',
    anonKey: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  }

  it('aceita URL HTTPS e publishable key do Supabase', () => {
    expect(validateSupabaseEnv(valid)).toEqual([])
  })

  it('aceita anon key legada em JWT', () => {
    expect(validateSupabaseEnv({
      ...valid,
      anonKey: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.signature',
    })).toEqual([])
  })

  it('recusa URL preenchida sem protocolo HTTP(S)', () => {
    expect(validateSupabaseEnv({ ...valid, url: 'abcdefgh.supabase.co' })).toContain('invalid-url')
  })

  it('recusa chave preenchida com formato inválido', () => {
    expect(validateSupabaseEnv({ ...valid, anonKey: 'valor-invalido' })).toContain('invalid-anon-key')
  })
})
