// Sinal de animação de token (024.1) — ponte entre LiveTokens (que anima o peão
// andando casa a casa) e GameDriver (que resolve a casa). Enquanto o peão do
// jogador da vez ainda está andando, `animating = true` e o driver SEGURA a
// resolução (senão o modal de compra abriria antes do peão chegar).
import { create } from 'zustand'

export const useTokenAnim = create<{ animating: boolean; set: (b: boolean) => void }>((set) => ({
  animating: false,
  set: (b) => set((s) => (s.animating === b ? s : { animating: b })),
}))
