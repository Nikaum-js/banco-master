// Migração de snapshot legado (041, data-model — Migração de dados). Salas persistidas
// ANTES desta spec têm `game.paused` como booleano; `normalizeSnapshot` converte na leitura,
// o mesmo ponto onde `normalizeLog` já normaliza o log (021/040) — nunca regride o que a 021
// garante.
import { describe, expect, it } from 'vitest'
import { normalizeSnapshot } from '@/net/supabaseTransport'
import type { PersistedSnapshot } from '@/net/transport'

function legacyGame(paused: unknown): PersistedSnapshot['game'] {
  return { paused, log: [{ who: 'bank', what: 'algo aconteceu' }] } as unknown as PersistedSnapshot['game']
}

describe('normalizeSnapshot — migração de paused legado', () => {
  it('paused: true vira { causes: ["disconnect"], since: <leitura> }', () => {
    const out = normalizeSnapshot(legacyGame(true), () => 12_345)
    expect(out.paused).toEqual({ causes: ['disconnect'], since: 12_345 })
  })

  it('paused: false vira null', () => {
    const out = normalizeSnapshot(legacyGame(false), () => 999)
    expect(out.paused).toBeNull()
  })

  it('paused ausente vira null', () => {
    const out = normalizeSnapshot(legacyGame(undefined), () => 999)
    expect(out.paused).toBeNull()
  })

  it('paused já no formato novo (PauseState) passa intacto', () => {
    const already = { causes: ['persistence'], since: 777 }
    const out = normalizeSnapshot(legacyGame(already), () => 999)
    expect(out.paused).toEqual(already)
  })

  it('o log continua normalizado (não regride 021/040)', () => {
    const out = normalizeSnapshot(legacyGame(false), () => 0)
    expect(out.log).toEqual([{ kind: 'legacy', who: 'bank', what: 'algo aconteceu' }])
  })

  it('since NUNCA é 0 por padrão — vem do relógio de leitura injetado', () => {
    let calls = 0
    const out = normalizeSnapshot(legacyGame(true), () => { calls += 1; return 55 })
    expect(calls).toBe(1)
    expect((out.paused as { since: number }).since).toBe(55)
  })
})
