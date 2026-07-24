// Tema visual do tabuleiro (skin) — por dispositivo, persistido em localStorage,
// fora do GameState. Só troca a pele: aplica data-board-theme no <html> e o CSS
// resolve tudo via var(--color-*) ([data-board-theme] no index.css).
// Default: "Atlas da Meia-Noite" · alternativo: "Café Coado" (identidade legada).
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type BoardTheme = 'atlas' | 'cafe'

export const BOARD_THEME_LABEL: Record<BoardTheme, string> = {
  atlas: 'Atlas da Meia-Noite',
  cafe: 'Café Coado',
}

// Atlas é o default do CSS (sem atributo); só o café marca o <html>.
function applyTheme(t: BoardTheme) {
  if (t === 'cafe') document.documentElement.dataset.boardTheme = 'cafe'
  else delete document.documentElement.dataset.boardTheme
}

export interface BoardThemeState {
  theme: BoardTheme
  setTheme: (t: BoardTheme) => void
  toggle: () => void
}

export const useBoardTheme = create<BoardThemeState>()(
  persist(
    (set, get) => ({
      theme: 'atlas',
      setTheme: (t) => {
        set({ theme: t })
        applyTheme(t)
      },
      toggle: () => get().setTheme(get().theme === 'atlas' ? 'cafe' : 'atlas'),
    }),
    {
      name: 'bm.board-theme',
      storage: createJSONStorage(() => localStorage),
      // Aplica o tema salvo assim que re-hidrata no boot.
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      },
    },
  ),
)
