import { describe, expect, it } from 'vitest'
import { createLoopBreaker, type KeyValueStore } from '@/app/loopBreaker'

function memoryStore(): KeyValueStore {
  const map = new Map<string, string>()
  return {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => void map.set(k, v),
  }
}

describe('loopBreaker (T009)', () => {
  it('primeira ocorrência de uma assinatura é first', () => {
    const breaker = createLoopBreaker(memoryStore())
    expect(breaker.check('bm:boundary:match', 'sig-a')).toBe('first')
  })

  it('repetição da mesma assinatura é repeat', () => {
    const breaker = createLoopBreaker(memoryStore())
    breaker.check('bm:boundary:match', 'sig-a')
    expect(breaker.check('bm:boundary:match', 'sig-a')).toBe('repeat')
  })

  it('assinatura diferente reseta para first', () => {
    const breaker = createLoopBreaker(memoryStore())
    breaker.check('bm:boundary:match', 'sig-a')
    breaker.check('bm:boundary:match', 'sig-a')
    expect(breaker.check('bm:boundary:match', 'sig-b')).toBe('first')
  })

  it('não toca sessionStorage de verdade quando um store fake é passado', () => {
    const store = memoryStore()
    const breaker = createLoopBreaker(store)
    breaker.check('bm:boundary:match', 'sig-a')
    expect(store.get('bm:boundary:match')).toBe('sig-a')
  })
})
