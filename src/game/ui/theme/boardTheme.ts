// MAPA ATIVO DO APP (055/D-069) — o eixo visual e o mapa jogável são o MESMO eixo.
// Aplica `data-board-theme` no <html> e o CSS resolve o resto: toda a UI resolve cor por
// `var(--color-*)` e fonte por `var(--font-*)`, então trocar o atributo troca paleta,
// tipografia, fundo, cromo das casas e o miolo do tabuleiro sem re-render.
//
// Quem define o valor:
//   1. a SALA publicada (fonte da verdade — `roomStore.setRoom` aplica `room.boardId`);
//   2. a seleção do host na home, antes de criar a sala;
//   3. `?map=fuligem` em partida local de desenvolvimento.
//
//   atlas   — Cidades do Mundo: carta náutica noturna, tinta azul, latão, Bebas condensada.
//   fuligem — Cidade da Fuligem: Revolução Industrial, carvão, ferro, cobre, luz de fornalha.
import { create } from 'zustand'
import { BOARD_IDS, catalogOf, coerceBoardId, type BoardId, type MapCatalog } from '@/lib/mapCatalog'

export const BOARD_THEMES = BOARD_IDS
/** Mantido como alias do id de mapa: tema do app ≡ mapa ativo (D-069). */
export type BoardTheme = BoardId

// O atributo é escrito SEMPRE, inclusive no atlas: os blocos de tema no CSS são
// explícitos, e o atlas continua sendo o default do `@theme` (vale antes da re-hidratação,
// no primeiro paint, quando nenhum atributo existe ainda).
function applyTheme(t: BoardTheme): void {
  document.documentElement.dataset.boardTheme = t
}

export interface BoardThemeState {
  theme: BoardTheme
  setTheme: (t: BoardTheme) => void
  /** Próximo mapa do ciclo — usado pelo seletor da home. */
  cycle: () => void
}

export const useBoardTheme = create<BoardThemeState>()(
  (set, get) => ({
    // Nunca persistido no browser: o valor de verdade vem da sala (D-069); antes de haver
    // sala, atlas é o primeiro paint documentado.
    theme: 'atlas',
    setTheme: (t) => {
      const theme = coerceBoardId(t)
      set({ theme })
      applyTheme(theme)
    },
    cycle: () => {
      const i = BOARD_THEMES.indexOf(get().theme)
      get().setTheme(BOARD_THEMES[(i + 1) % BOARD_THEMES.length])
    },
  }),
)

/** Catálogo do mapa ativo — leitura imperativa (views puras, módulos sem React). */
export function activeCatalog(): MapCatalog {
  return catalogOf(useBoardTheme.getState().theme)
}

/** As 48 casas de APRESENTAÇÃO do mapa ativo. O motor continua lendo `BOARD` direto —
 * o esqueleto econômico é idêntico entre mapas (paridade provada em tests/lib). */
export function activeBoard(): MapCatalog['board'] {
  return activeCatalog().board
}

/** Rótulos dos contratos do motor no mapa ativo (Aeroporto/Ferrovia, Loteria/Sorte
 * Grande, casa/oficina…). */
export function activeLabels(): MapCatalog['labels'] {
  return activeCatalog().labels
}

/** Versão com inicial maiúscula de um rótulo minúsculo do catálogo. */
export function capLabel(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Catálogo do mapa ativo, reativo (componentes que precisam re-renderizar na troca). */
export function useMapCatalog(): MapCatalog {
  return catalogOf(useBoardTheme((s) => s.theme))
}
