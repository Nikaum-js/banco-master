import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  importWithReload,
  type ReloadMarkerStore,
} from '@/app/lazyImportRecovery'

function memoryStore(): ReloadMarkerStore {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  }
}

describe('recuperação de chunk lazy entre deploys', () => {
  it('recarrega a página uma única vez quando o chunk da versão aberta desapareceu', async () => {
    const error = new TypeError(
      'Failed to fetch dynamically imported module: https://banco-master.test/assets/GameSurface-old.js',
    )
    const store = memoryStore()
    const reload = vi.fn()

    void importWithReload(
      () => Promise.reject(error),
      { release: 'commit-a', store, reload },
    )
    await Promise.resolve()
    await Promise.resolve()

    expect(reload).toHaveBeenCalledOnce()

    await expect(importWithReload(
      () => Promise.reject(error),
      { release: 'commit-a', store, reload },
    )).rejects.toBe(error)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('permite uma nova recuperação quando a versão aberta muda', async () => {
    const error = new TypeError('Importing a module script failed.')
    const store = memoryStore()
    const reload = vi.fn()

    void importWithReload(
      () => Promise.reject(error),
      { release: 'commit-a', store, reload },
    )
    await Promise.resolve()
    await Promise.resolve()
    void importWithReload(
      () => Promise.reject(error),
      { release: 'commit-b', store, reload },
    )
    await Promise.resolve()
    await Promise.resolve()

    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('não recarrega para uma exceção de avaliação do módulo', async () => {
    const error = new Error('GameSurface exportou um valor inválido')
    const reload = vi.fn()

    await expect(importWithReload(
      () => Promise.reject(error),
      { release: 'commit-a', store: memoryStore(), reload },
    )).rejects.toBe(error)
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('roteamento de assets na Vercel', () => {
  it('mantém deep links na SPA sem reescrever asset inexistente para index.html', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      rewrites: { source: string; destination: string }[]
    }
    const spa = config.rewrites.find((rewrite) => rewrite.destination === '/index.html')
    expect(spa).toBeDefined()

    const matches = new RegExp(`^${spa!.source}$`)
    expect(matches.test('/sala/atlas')).toBe(true)
    expect(matches.test('/assets/GameSurface-old.js')).toBe(false)
  })
})
