// Store de UI efêmero da mão: qual carta está escolhendo alvo (null = fechado).
// Fora do `HandCardLayer.tsx` porque não é componente — o `HandPanel` só precisa do store,
// e importá-lo do módulo de componentes custava o fast refresh da camada de cartas.
import { create } from 'zustand'

export const useHandCardUI = create<{ cardId: string | null; open: (id: string) => void; close: () => void }>((set) => ({
  cardId: null,
  open: (id) => set({ cardId: id }),
  close: () => set({ cardId: null }),
}))
