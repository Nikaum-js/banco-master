// Store de UI mínimo da negociação: abre/fecha o compositor (o botão "Negociar" mora no
// `ActionsPanel`) e controla o "fechar sem responder" da proposta recebida — `dismissed`
// esconde o modal, mas a proposta segue na mesa (o painel lateral reabre via `respond()`).
//
// Fora do `TradeLayer.tsx` porque não é componente: o `shared.tsx` importa só o store, e
// puxá-lo do módulo de componentes custava o fast refresh da camada de troca.
import { create } from 'zustand'

export const useTradeUI = create<{
  open: boolean
  dismissed: boolean
  show: () => void
  hide: () => void
  dismiss: () => void
  respond: () => void
}>((set) => ({
  open: false,
  dismissed: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
  dismiss: () => set({ dismissed: true }),
  respond: () => set({ dismissed: false }),
}))
