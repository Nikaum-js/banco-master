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

export const RARITY_LABEL: Record<Rarity, string> = {
  lendaria: 'Lendária',
  rara: 'Rara',
  comum: 'Comum',
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
  aquisicaoHostil: 'No seu turno, force um adversário a te vender uma propriedade dele (sem construções) pelo preço de tabela.',
  despejo: 'No seu turno, demole 1 casa de uma propriedade de um adversário. Ela volta ao banco e o dono não recebe nada.',
  auditoriaFiscal: 'No seu turno, escolha um adversário: ele paga 10% do patrimônio ao pote do Free Parking.',
  boicote: 'No seu turno, escolha uma propriedade de um adversário: por 2 voltas ela não cobra aluguel de ninguém.',
  criseImobiliaria: 'Crise no mercado imobiliário.',
  atalho: 'Mova-se 3 casas, para a frente ou para trás (você escolhe).',
  apagao: 'Hangares ficam inativos por 1 volta.',
  greveUtilidades: 'Utilidades não cobram aluguel por 1 volta.',
  vaPrisao: 'Vá direto para a Prisão.',
  voltaGo: 'Volte para o GO e receba o bônus.',
  consertoImoveis: 'Pague pela manutenção dos seus imóveis.',
  avance3: 'Avance 3 casas.',
  volte3: 'Volte 3 casas.',
  diplomacia: 'Reação (automática): quando uma carta ofensiva for usada contra você, ela é anulada.',
  imunidade: 'No seu turno, escolha uma propriedade sua: por 2 voltas ela fica imune a Aquisição, Despejo e Boicote.',
  saiaPrisao: 'Quando estiver preso, use para sair sem pagar a multa de $50.',
  bunkerFiscal: 'Reação (automática): quando você for pagar um imposto, esse pagamento é cancelado.',
  boomEconomico: 'Boom econômico: todos lucram.',
  investidorAnjo: 'Receba um aporte de um investidor.',
  refinanciamento: 'Refinancie suas dívidas.',
  passagemOnibus: 'Ganhe uma Passagem de Ônibus.',
  erroBanco: 'Erro do banco a seu favor: receba.',
  aniversario: 'É seu aniversário: cada jogador te paga.',
  honorarios: 'Receba honorários.',
}
