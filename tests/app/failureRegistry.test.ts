import { describe, expect, it, vi } from 'vitest'
import { registerFailure } from '@/app/failureRegistry'

describe('registerFailure (T007)', () => {
  it('devolve um occurrenceId determinístico quando mintId é injetado', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const id = registerFailure(
      { where: 'match', phase: 'playing', seq: 3, error: new Error('boom') },
      { mintId: () => 'ABC123', now: () => 1_000 },
    )
    expect(id).toBe('ABC123')
    expect(spy).toHaveBeenCalledWith('[magnata-imobiliario:failure]', {
      occurrenceId: 'ABC123',
      where: 'match',
      phase: 'playing',
      seq: 3,
      message: 'boom',
      at: 1_000,
    })
    spy.mockRestore()
  })

  it('o registro só tem os campos declarados — nunca passa GameState/Room/mão de cartas (FR-018)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    registerFailure({ where: 'host.accept', error: 'string simples' }, { mintId: () => 'X', now: () => 0 })
    const [, record] = spy.mock.calls[0]
    expect(Object.keys(record as object).sort()).toEqual(['at', 'message', 'occurrenceId', 'phase', 'seq', 'where'])
    spy.mockRestore()
  })

  it('duas chamadas com o mintId real geram ids diferentes', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const a = registerFailure({ where: 'match', error: new Error('a') })
    const b = registerFailure({ where: 'match', error: new Error('b') })
    expect(a).not.toBe(b)
    spy.mockRestore()
  })
})
