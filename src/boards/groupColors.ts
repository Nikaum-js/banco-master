// Cores dos grupos como var() de --color-group-* — seguem o TEMA ativo do
// tabuleiro (Atlas/Café) em runtime. Usadas onde Tailwind class não dá
// (style inline, gradientes, color-mix, modal etc).
//
// Mora fora do `shared.tsx` porque não é componente: enquanto vivia lá, todo arquivo
// que só queria a cor de um grupo importava o módulo de componentes do tabuleiro inteiro
// (e o HMR do Vite perdia o fast refresh dele).
export const GROUP_COLOR: Record<string, string> = {
  brown:   'var(--color-group-brown)',
  skyblue: 'var(--color-group-skyblue)',
  pink:    'var(--color-group-pink)',
  orange:  'var(--color-group-orange)',
  red:     'var(--color-group-red)',
  yellow:  'var(--color-group-yellow)',
  green:   'var(--color-group-green)',
  navy:    'var(--color-group-navy)',
  purple:  'var(--color-group-purple)',
  platinum: 'var(--color-group-platinum)', // Emirados (super-luxo) — ônix (033)
}
