// Store de UI mínimo da negociação: o compositor e a proposta selecionada são estados
// independentes. A coleção real continua no GameState; aqui vive só a navegação local.
//
// Fora do `TradeLayer.tsx` porque não é componente: o `shared.tsx` importa só o store, e
// puxá-lo do módulo de componentes custava o fast refresh da camada de troca.
import { create } from 'zustand'

export const useTradeUI = create<{
  open: boolean
  selectedProposalId: number | null
  show: () => void
  hide: () => void
  view: (proposalId: number) => void
  closeProposal: () => void
}>((set) => ({
  open: false,
  selectedProposalId: null,
  show: () => set({ open: true, selectedProposalId: null }),
  hide: () => set({ open: false }),
  view: (proposalId) => set({ open: false, selectedProposalId: proposalId }),
  closeProposal: () => set({ selectedProposalId: null }),
}))
