// Preferências de áudio (spec 035) — por dispositivo, persistidas em localStorage
// (FR-012/FR-013/FR-014). Fora do GameState. Áudio LIGADO por padrão (muted=false).
// Os setters atualizam o store E o ganho master do engine.
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { setMasterGain } from './engine'

export interface AudioPrefsState {
  muted: boolean
  volume: number // 0..1
  setMuted: (m: boolean) => void
  setVolume: (v: number) => void
}

export const useAudioPrefs = create<AudioPrefsState>()(
  persist(
    (set, get) => ({
      muted: false,
      volume: 0.6,
      setMuted: (m) => {
        set({ muted: m })
        setMasterGain(get().volume, m)
      },
      setVolume: (v) => {
        const vol = Math.min(1, Math.max(0, v))
        set({ volume: vol })
        setMasterGain(vol, get().muted)
      },
    }),
    {
      name: 'bm.audio',
      storage: createJSONStorage(() => localStorage),
      // Aplica o ganho assim que as prefs salvas re-hidratam no boot.
      onRehydrateStorage: () => (state) => {
        if (state) setMasterGain(state.volume, state.muted)
      },
    },
  ),
)
