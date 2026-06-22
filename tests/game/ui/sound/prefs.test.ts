import { describe, it, expect, vi, beforeEach } from 'vitest'

// Engine é mockado: testamos só a lógica do store (estado + chamada de ganho), sem Web Audio.
const setMasterGain = vi.fn()
vi.mock('@/game/ui/sound/engine', () => ({ setMasterGain: (...a: unknown[]) => setMasterGain(...a) }))

// localStorage em memória (ambiente node não tem DOM). Instalado antes de importar o store.
function installStorage(initial: Record<string, string> = {}) {
  const mem = new Map<string, string>(Object.entries(initial))
  const ls = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size
    },
  }
  ;(globalThis as unknown as { localStorage: typeof ls }).localStorage = ls
  return mem
}

async function freshStore() {
  vi.resetModules()
  return (await import('@/game/ui/sound/prefs')).useAudioPrefs
}

beforeEach(() => {
  setMasterGain.mockClear()
})

describe('useAudioPrefs (035 — controle de áudio)', () => {
  it('defaults: áudio ligado, volume 0.6 (FR-012)', async () => {
    installStorage()
    const store = await freshStore()
    expect(store.getState().muted).toBe(false)
    expect(store.getState().volume).toBe(0.6)
  })

  it('setMuted/setVolume atualizam o estado E aplicam o ganho master (FR-013)', async () => {
    installStorage()
    const store = await freshStore()
    store.getState().setMuted(true)
    expect(store.getState().muted).toBe(true)
    expect(setMasterGain).toHaveBeenLastCalledWith(0.6, true) // mute ⇒ ganho efetivo 0 no engine

    store.getState().setVolume(0.25)
    expect(store.getState().volume).toBe(0.25)
    expect(setMasterGain).toHaveBeenLastCalledWith(0.25, true)
  })

  it('volume é clampado em [0,1]', async () => {
    installStorage()
    const store = await freshStore()
    store.getState().setVolume(5)
    expect(store.getState().volume).toBe(1)
    store.getState().setVolume(-2)
    expect(store.getState().volume).toBe(0)
  })

  it('persiste e re-hidrata as prefs entre instâncias (FR-014)', async () => {
    const mem = installStorage()
    const store1 = await freshStore()
    store1.getState().setVolume(0.3)
    store1.getState().setMuted(true)
    expect(mem.get('bm.audio')).toBeTruthy() // gravou no localStorage

    // Nova instância lendo o MESMO storage → estado re-hidratado.
    installStorage(Object.fromEntries(mem))
    const store2 = await freshStore()
    expect(store2.getState().volume).toBe(0.3)
    expect(store2.getState().muted).toBe(true)
  })
})
