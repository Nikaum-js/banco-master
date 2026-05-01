// UI efêmero p/ usar um Bus Ticket GUARDADO (da carta "Passagem de Ônibus") antes
// de rolar. `armed` = o seletor de destino (modal) está aberto. O espaço de Bus
// Ticket (D-021) usa outro caminho (awaitingChoice='bus-ride'), não este.
import { create } from 'zustand'

export const useBusTicketUI = create<{ armed: boolean; arm: () => void; disarm: () => void }>((set) => ({
  armed: false,
  arm: () => set({ armed: true }),
  disarm: () => set({ armed: false }),
}))
