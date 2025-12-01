// Metadados de apresentação de carta (029) — extraídos do ModalLayer (022/025) para
// um módulo único, reaproveitado pelo painel "Minhas Cartas". Só apresentação; o
// motor guarda o EffectId. Mudar aqui reflete em modais E painel (fonte única).
import type { Rarity } from '@/game/cards/types'
import { activeCatalog } from '@/game/ui/theme/boardTheme'

// Raridade → cor (SRS §10.2: laranja/azul/verde; lendária > rara > comum).
export const RARITY_COLOR: Record<Rarity, string> = {
  lendaria: 'var(--color-rarity-lendaria)', // laranja
  rara: 'var(--color-rarity-rara)', // azul
  comum: 'var(--color-rarity-comum)', // verde
}

export const RARITY_LABEL: Record<Rarity, string> = {
  lendaria: 'Lendária',
  rara: 'Rara',
  comum: 'Comum',
}

// Losangos do selo de raridade na carta revelada. Existem para a hierarquia
// (lendária > rara > comum) não depender SÓ de cor: laranja e verde a 4.5:1 num
// fundo de tinta continuam sendo duas cores para quem não as distingue.
export const RARITY_PIPS: Record<Rarity, number> = {
  lendaria: 3,
  rara: 2,
  comum: 1,
}

// Rótulo legível por efeito.
export const CARD_LABEL: Record<string, string> = {
  aquisicaoHostil: 'Aquisição Hostil',
  confiscoGeral: 'Confisco Geral',
  impostoFederal: 'Imposto Federal',
  permutaForcada: 'Permuta Forçada',
  boicote: 'Boicote',
  embargoDeObras: 'Embargo de Obras',
  criseImobiliaria: 'Crise Imobiliária',
  estatizacao: 'Estatização',
  atalho: 'Atalho',
  greve: 'Greve',
  desvalorizacaoCambial: 'Desvalorização Cambial',
  obrasNaPista: 'Obras na Pista',
  multaAmbiental: 'Multa Ambiental',
  vaPrisao: 'Vá para a Prisão',
  voltaGo: 'Volta ao GO',
  consertoImoveis: 'Conserto de Imóveis',
  avance3: 'Avance 3',
  volte3: 'Volte 3',
  diplomacia: 'Diplomacia',
  imunidade: 'Imunidade Total',
  valorizacao: 'Valorização',
  saiaPrisao: 'Saída da Prisão',
  bunkerFiscal: 'Bunker Fiscal',
  boomEconomico: 'Boom Econômico',
  investidorAnjo: 'Investidor Anjo',
  passagemOnibus: 'Passagem de Ônibus',
  resgateDoPote: 'Resgate do Pote',
  obraRelampago: 'Obra Relâmpago',
  incentivoFiscal: 'Incentivo Fiscal',
  erroBanco: 'Erro do Banco',
  aniversario: 'Aniversário',
  honorarios: 'Honorários Médicos',
}

export function cardLabel(effect: string): string {
  // 055/D-069: o mapa ativo pode APRESENTAR outro rótulo (ex.: "Bilhete de Trem"
  // para passagemOnibus na Fuligem). O efeito, o id e o log do motor não mudam.
  return activeCatalog().cardText[effect]?.label
    ?? CARD_LABEL[effect]
    ?? effect.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}

// Descrição curta por efeito (apresentação; valores = mapa Cidades do Mundo).
// Consuma via `cardDesc()` — é lá que o override do mapa ativo entra.
export const CARD_DESC: Record<string, string> = {
  aquisicaoHostil: 'No seu turno, force um adversário a te vender uma propriedade dele (sem construções) pela metade do preço de tabela.',
  confiscoGeral: 'No seu turno, escolha uma propriedade construída de um adversário: todas as construções dela desmoronam. Ele mantém o terreno e não recebe nada.',
  impostoFederal: 'No seu turno, escolha um adversário: ele paga 25% do patrimônio à Loteria.',
  permutaForcada: 'No seu turno, troque uma propriedade sua por uma de um adversário, sem restrição de preço. Nenhuma das duas pode ter construção.',
  boicote: 'No seu turno, escolha uma propriedade de um adversário: por 2 voltas ela não cobra aluguel de ninguém.',
  embargoDeObras: 'No seu turno, escolha um adversário: por 2 voltas ele não pode construir.',
  criseImobiliaria: 'Crise no mercado: cada adversário paga 10% do patrimônio à Loteria. Você não paga.',
  estatizacao: 'Por 2 voltas, todo aluguel pago na mesa vai direto para a Loteria em vez do dono.',
  atalho: 'Mova-se 3 casas, para a frente ou para trás (você escolhe).',
  greve: 'Greve geral por 1 volta: Hangares ficam inativos e utilidades não cobram aluguel.',
  desvalorizacaoCambial: 'Pague 10% do seu dinheiro em caixa à Loteria.',
  obrasNaPista: 'Vá ao aeroporto mais próximo. Se tiver dono, pague aluguel em dobro.',
  multaAmbiental: 'Pague $50 + $50 por hotel ou arranha-céu que possui, à Loteria.',
  vaPrisao: 'Vá direto para a Prisão.',
  voltaGo: 'Volte para o GO e receba o bônus em dobro.',
  consertoImoveis: 'Pague pela manutenção dos seus imóveis: $25 por casa e $100 por hotel.',
  avance3: 'Avance 3 casas.',
  volte3: 'Volte 3 casas.',
  diplomacia: 'Reação opcional: quando uma carta ofensiva for usada contra você, escolha usar esta carta para anulá-la.',
  imunidade: 'No seu turno, ative: por 1 volta você não paga aluguel nem imposto algum, e não pode ser alvo de efeito negativo.',
  valorizacao: 'No seu turno, escolha uma propriedade sua: por 1 volta ela cobra aluguel em dobro.',
  saiaPrisao: 'Quando estiver preso, use para sair sem pagar a multa de $50.',
  bunkerFiscal: 'Reação opcional: quando você for pagar um imposto, escolha usar esta carta para cancelar o pagamento.',
  boomEconomico: 'Todos os jogadores não eliminados recebem $200.',
  investidorAnjo: 'Sua próxima compra de propriedade sai com 20% de desconto.',
  passagemOnibus: 'Ganhe uma Passagem de Ônibus.',
  resgateDoPote: 'Receba metade da Loteria acumulada no centro do tabuleiro.',
  obraRelampago: 'Sua próxima construção sai de graça (casa, hotel, arranha-céu ou Hangar).',
  incentivoFiscal: 'Receba $50 por propriedade hipotecada que possui.',
  erroBanco: 'Erro do banco a seu favor: receba $200.',
  aniversario: 'É seu aniversário: cada jogador te paga $50.',
  honorarios: 'Pague $50 de honorários médicos à Loteria.',
}

export function cardDesc(effect: string): string {
  return activeCatalog().cardText[effect]?.desc ?? CARD_DESC[effect] ?? 'Carta sorteada.'
}
