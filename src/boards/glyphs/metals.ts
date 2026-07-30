// OS QUATRO METAIS DA FULIGEM (D-071) — cor e nome público de cada mina.
//
// Vive num módulo próprio (e não em `badges.tsx` ou `squares.tsx`) porque três camadas
// diferentes precisam do MESMO par: a casa no tabuleiro, o título e o rodapé do modal do
// Bilhete de Trem. Duplicar a tabela era garantir que uma delas divergisse.
import type { MetalId } from '@/lib/boardData'

/** Nome público do metal — o que o jogador lê. */
export const METAL_LABEL: Record<MetalId, string> = {
  ferro: 'Ferro',
  carvao: 'Carvão',
  cobre: 'Cobre',
  estanho: 'Estanho',
}

/**
 * Cor de cada metal. Escolhidas para serem distinguíveis entre si E do latão do cromo do
 * tabuleiro: o cobre é o único avermelhado, o estanho o único frio-claro, o carvão o único
 * quase-preto, o ferro o único cinza-azulado.
 */
export const METAL_ACCENT: Record<MetalId, string> = {
  ferro: 'var(--color-ink-400)',
  carvao: 'var(--color-ink-950)',
  cobre: 'var(--color-group-orange)',
  estanho: 'var(--color-starlight)',
}

/** O bônus passivo de cada metal, em uma linha — texto de UI, não regra. */
export const METAL_BONUS_TEXT: Record<MetalId, string> = {
  ferro: 'Suas construções custam 25% menos.',
  carvao: 'O aluguel das suas ferrovias sobe 50%.',
  cobre: 'O aluguel das suas construções sobe 25%.',
  estanho: 'Você paga 15% menos em impostos e aluguéis.',
}
