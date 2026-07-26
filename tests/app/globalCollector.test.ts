// @vitest-environment jsdom
// Coletor de último recurso (spec 042, T035, FR-019). Handler/timer/promessa rejeitada não
// passam por fronteira de React — só `window.onerror`/`onunhandledrejection` os vê.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installGlobalFailureCollector } from '@/app/globalCollector'

let uninstall: (() => void) | null = null

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  uninstall?.()
  uninstall = null
  vi.restoreAllMocks()
})

describe('installGlobalFailureCollector (T035)', () => {
  it('um ErrorEvent sintético chama registerFailure sem lançar pra fora do listener', () => {
    uninstall = installGlobalFailureCollector()
    const event = new ErrorEvent('error', { error: new Error('handler explodiu'), message: 'handler explodiu' })

    expect(() => window.dispatchEvent(event)).not.toThrow()
    expect(console.error).toHaveBeenCalledTimes(1)
    const [, record] = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(record.where).toBe('window.error')
  })

  it('um unhandledrejection sintético chama registerFailure sem lançar pra fora do listener', () => {
    uninstall = installGlobalFailureCollector()
    const rejected = Promise.reject(new Error('promessa rejeitada'))
    const event = new PromiseRejectionEvent('unhandledrejection', { promise: rejected, reason: new Error('promessa rejeitada') })

    expect(() => window.dispatchEvent(event)).not.toThrow()
    expect(console.error).toHaveBeenCalledTimes(1)
    const [, record] = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(record.where).toBe('window.unhandledrejection')

    rejected.catch(() => {}) // silencia o rejection real da promise no ambiente de teste
  })
})
