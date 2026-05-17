// Sinal de animação de token (024.1) — ponte entre LiveTokens (que anima o peão
// andando casa a casa) e GameDriver (que resolve a casa). Enquanto o peão do
// jogador da vez ainda está andando, `animating = true` e o driver SEGURA a
// resolução (senão o modal de compra abriria antes do peão chegar).
//
// `rolling` (UI): os dados estão na animação de arremesso. Enquanto true, o peão
// NÃO anda — só começa a se mover quando o dado para de rolar (senão o peão sai
// andando antes do dado cair).
import { create } from 'zustand'

export const useTokenAnim = create<{
  animating: boolean
  rolling: boolean
  set: (b: boolean) => void
  setRolling: (b: boolean) => void
}>((set) => ({
  animating: false,
  rolling: false,
  set: (b) => set((s) => (s.animating === b ? s : { animating: b })),
  setRolling: (b) => set((s) => (s.rolling === b ? s : { rolling: b })),
}))
