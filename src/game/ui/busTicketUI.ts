// UI efêmero p/ usar um Bus Ticket GUARDADO (da carta "Passagem de Ônibus" ou do
// espaço Bus Ticket, SRS §2.7) antes de rolar. `armed` = o seletor de destino
// (modal) está aberto.
import { create } from 'zustand'

export const useBusTicketUI = create<{ armed: boolean; arm: () => void; disarm: () => void }>((set) => ({
  armed: false,
  arm: () => set({ armed: true }),
  disarm: () => set({ armed: false }),
}))
