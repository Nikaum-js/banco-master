// UI efêmero p/ usar um Bus Ticket GUARDADO (da carta "Passagem de Ônibus" ou do
// espaço Bus Ticket, SRS §2.7) antes de rolar. `armed` = o seletor de destino
// (modal) está aberto.
//
// `boarding` (044/T070, FR-031): o comando `use-bus-ticket` agora sai IMEDIATAMENTE ao
// clicar a parada — não fica mais represado atrás da animação de embarque. Isso muda o
// motor na hora, e `canUseBusTicket(game)` (o gate que `ModalLayer` usa pra decidir se o
// seletor continua na tela) passa a ser `false` no mesmo instante (o ticket já foi gasto,
// o turno já mudou de estado). Sem este flag, o modal fecharia no MESMO frame do clique —
// a animação de embarque nunca chegaria a aparecer pra quem não pediu movimento reduzido.
// `boarding` é o sinal "ainda decorando por cima do estado já avançado": mantém o seletor
// montado até `BusLine` terminar de tocar a viagem, aí sim `disarm()` fecha de verdade.
import { create } from 'zustand'

export const useBusTicketUI = create<{
  armed: boolean
  boarding: boolean
  arm: () => void
  disarm: () => void
  setBoarding: (b: boolean) => void
}>((set) => ({
  armed: false,
  boarding: false,
  arm: () => set({ armed: true, boarding: false }),
  disarm: () => set({ armed: false, boarding: false }),
  setBoarding: (b) => set({ boarding: b }),
}))
