// O lugar da cobrança de dívida na tela (066, SRS §12.2 / D-066).
//
// O tabuleiro monta um slot vazio DENTRO do anel de casas (`DebtSlot`, em `DebtCall.tsx`) e
// publica o nó aqui; a cobrança se porta até ele. A alternativa era a cobrança adivinhar a
// geometria do miolo a partir da janela — e ela não é adivinhável: o tabuleiro é quadrado,
// limitado pela altura, centrado em três colunas no desktop e EMPILHADO com rolagem abaixo de
// 1100px. Um cartão `fixed` centrado na janela acerta o miolo só no primeiro desses casos.
//
// Nó em store, e não `getElementById`: quem monta primeiro (tabuleiro ou HUD) não é garantido,
// e uma busca no DOM feita no render do primeiro commit devolveria `null` para sempre.
//
// Fora do módulo de componentes pelo mesmo motivo do `tradeUI`: o tabuleiro importa o
// componente e a cobrança importa o nó — puxar o store do módulo de componentes custaria o
// fast refresh da camada.
import { create } from 'zustand'

export const useDebtSlot = create<{
  node: HTMLElement | null
  attach: (node: HTMLElement | null) => void
}>((set) => ({
  node: null,
  attach: (node) => set({ node }),
}))
