// TEMA DO APP (skin inteira) — por dispositivo, persistido em localStorage, fora do
// GameState. Aplica `data-board-theme` no <html> e o CSS resolve o resto: como TODA a UI
// resolve cor por `var(--color-*)` e fonte por `var(--font-*)`, trocar o atributo troca
// paleta, tipografia, fundo, cromo das casas e o miolo do tabuleiro sem re-render.
//
// Antes daqui, o eixo tinha dois valores ("Atlas da Meia-Noite" e o legado "Café Coado") e
// mexia só em cor. Agora são dois MUNDOS completos, e cada um tem também a sua tela de
// entrada (`net/ui/home/`): tema e home são o MESMO eixo, não dois seletores separados.
//
//   atlas — Atlas da Meia-Noite: carta náutica noturna, tinta azul, latão, Bebas condensada.
//   neon  — Fliperama Neon: roxo/ciano/rosa, corpo em monoespaçada, varredura de tubo.
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const BOARD_THEMES = ['atlas', 'neon'] as const
export type BoardTheme = (typeof BOARD_THEMES)[number]

export const BOARD_THEME_LABEL: Record<BoardTheme, string> = {
  atlas: 'Atlas da Meia-Noite',
  neon: 'Fliperama Neon',
}

/** O que cada tema faz, em uma linha — vai no `title` do botão de troca. */
export const BOARD_THEME_HINT: Record<BoardTheme, string> = {
  atlas: 'carta náutica · latão · tinta azul',
  neon: 'synthwave · pixel · tubo de imagem',
}

// Valor vindo do localStorage é dado de fora: `vault`/`cafe` (temas removidos) ou lixo
// qualquer voltariam como tema inexistente e deixariam o <html> num estado sem CSS.
function coerce(t: unknown): BoardTheme {
  return BOARD_THEMES.includes(t as BoardTheme) ? (t as BoardTheme) : 'atlas'
}

// O atributo é escrito SEMPRE, inclusive no atlas: os blocos de tema no CSS são
// explícitos, e o atlas continua sendo o default do `@theme` (vale antes da re-hidratação,
// no primeiro paint, quando nenhum atributo existe ainda).
function applyTheme(t: BoardTheme): void {
  document.documentElement.dataset.boardTheme = t
}

export interface BoardThemeState {
  theme: BoardTheme
  setTheme: (t: BoardTheme) => void
  /** Próximo tema do ciclo — é o que o botão do canto inferior esquerdo chama. */
  cycle: () => void
}

export const useBoardTheme = create<BoardThemeState>()(
  persist(
    (set, get) => ({
      theme: 'atlas',
      setTheme: (t) => {
        const theme = coerce(t)
        set({ theme })
        applyTheme(theme)
      },
      cycle: () => {
        const i = BOARD_THEMES.indexOf(get().theme)
        get().setTheme(BOARD_THEMES[(i + 1) % BOARD_THEMES.length])
      },
    }),
    {
      name: 'bm.board-theme',
      storage: createJSONStorage(() => localStorage),
      // Aplica (e sanea) o tema salvo assim que re-hidrata no boot.
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const theme = coerce(state.theme)
        state.theme = theme
        applyTheme(theme)
      },
    },
  ),
)
