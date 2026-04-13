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
      'Failed to fetch dynamically imported module: https://magnata-imobiliario.test/assets/GameSurface-old.js',
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
  // Desde a 051 não existe mais catch-all de SPA: a raiz é a landing estática e o app
  // vive em /play (rewrites explícitos). A invariante que protegia o importWithReload
  // continua a mesma — um asset hasheado INEXISTENTE precisa responder 404, nunca ser
  // reescrito para uma página HTML (o que mascararia o deploy novo e quebraria a
  // detecção de release velho).
  it('nenhum rewrite captura /assets/* nem devolve o index no lugar de asset', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      rewrites: { source: string; destination: string }[]
    }
    expect(config.rewrites.some((rewrite) => rewrite.destination === '/index.html')).toBe(false)
    for (const rewrite of config.rewrites) {
      const matches = new RegExp(`^${rewrite.source}$`)
      expect(matches.test('/assets/GameSurface-old.js'), `${rewrite.source} captura assets`).toBe(false)
    }
  })
})
