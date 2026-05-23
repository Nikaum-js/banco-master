// Metadados de apresentação de carta (029) — extraídos do ModalLayer (022/025) para
// um módulo único, reaproveitado pelo painel "Minhas Cartas". Só apresentação; o
// motor guarda o EffectId. Mudar aqui reflete em modais E painel (fonte única).
import type { Rarity } from '@/game/cards/types'

// Raridade → cor (SRS §10.2: laranja/azul/verde; lendária > rara > comum).
export const RARITY_COLOR: Record<Rarity, string> = {
  lendaria: '#fb923c', // laranja
  rara: '#3b82f6', // azul
  comum: '#22c55e', // verde
}

// Rótulo legível por efeito.
export const CARD_LABEL: Record<string, string> = {
  aquisicaoHostil: 'Aquisição Hostil',
  despejo: 'Despejo',
  auditoriaFiscal: 'Auditoria Fiscal',
  boicote: 'Boicote',
  criseImobiliaria: 'Crise Imobiliária',
  atalho: 'Atalho',
  apagao: 'Apagão',
  greveUtilidades: 'Greve nas Utilidades',
  vaPrisao: 'Vá para a Prisão',
  voltaGo: 'Volta ao GO',
  consertoImoveis: 'Conserto de Imóveis',
  avance3: 'Avance 3',
  volte3: 'Volte 3',
  diplomacia: 'Diplomacia',
  imunidade: 'Imunidade',
  saiaPrisao: 'Saída da Prisão',
  bunkerFiscal: 'Bunker Fiscal',
  boomEconomico: 'Boom Econômico',
  investidorAnjo: 'Investidor Anjo',
  refinanciamento: 'Refinanciamento',
  passagemOnibus: 'Passagem de Ônibus',
  erroBanco: 'Erro do Banco',
  aniversario: 'Aniversário',
  honorarios: 'Honorários',
}

export function cardLabel(effect: string): string {
  return CARD_LABEL[effect] ?? effect.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}

// Descrição curta por efeito (apresentação). Fallback no nome.
export const CARD_DESC: Record<string, string> = {
  aquisicaoHostil: 'Force a venda de uma propriedade de um adversário a você.',
  despejo: 'Remove uma casa de uma propriedade adversária.',
  auditoriaFiscal: 'O alvo paga 10% do patrimônio ao pote.',
  boicote: 'Uma propriedade fica sem cobrar aluguel por 2 voltas.',
  criseImobiliaria: 'Crise no mercado imobiliário.',
  atalho: 'Mova-se 3 casas — para a frente ou para trás (você escolhe).',
  apagao: 'Hangares ficam inativos por 1 volta.',
  greveUtilidades: 'Utilidades não cobram aluguel por 1 volta.',
  vaPrisao: 'Vá direto para a Prisão.',
  voltaGo: 'Volte para o GO e receba o bônus.',
  consertoImoveis: 'Pague pela manutenção dos seus imóveis.',
  avance3: 'Avance 3 casas.',
  volte3: 'Volte 3 casas.',
  diplomacia: 'Reação: anula uma carta ofensiva contra você.',
  imunidade: 'Concede imunidade de aluguel numa propriedade.',
  saiaPrisao: 'Guarde para sair da prisão quando precisar.',
  bunkerFiscal: 'Reação: anula uma cobrança de imposto.',
  boomEconomico: 'Boom econômico — todos lucram.',
  investidorAnjo: 'Receba um aporte de um investidor.',
  refinanciamento: 'Refinancie suas dívidas.',
  passagemOnibus: 'Ganhe uma Passagem de Ônibus.',
  erroBanco: 'Erro do banco a seu favor — receba.',
  aniversario: 'É seu aniversário — cada jogador te paga.',
  honorarios: 'Receba honorários.',
}
