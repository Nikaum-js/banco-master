import type { GameState } from '@/game/turn/types'
import type { Title } from '@/game/economy/types'
import { createSeedState } from '@/game/setup'
import { useGameStore } from '@/game/store'
import { useBusTicketUI } from '@/game/ui/busTicketUI'
import { useHandCardUI } from '@/game/ui/cards/handCardUI'
import { useTradeUI } from '@/game/ui/trade/tradeUI'

export type VisualLabSurface =
  | 'modal'
  | 'trade'
  | 'land-auction'
  | 'hand-card'
  | 'notice'
  | 'hud'
  | 'property'
  | 'airport'
  | 'utility'
  | 'hand-panel'
  | 'button-variants'
  | 'primitives'

interface VisualLabCaseDefinition {
  id: string
  category: string
  label: string
  description: string
  surface: VisualLabSurface
  suspended?: boolean
  prototype?: boolean
}

export const VISUAL_LAB_CASES = [
  { id: 'bus-ticket', category: 'Decisões centrais', label: 'Usar Bus Ticket', description: 'Escolha de destino no mesmo lado do tabuleiro.', surface: 'modal' },
  { id: 'auction-empty', category: 'Decisões centrais', label: 'Leilão sem lance', description: 'Leilão comum antes da primeira oferta.', surface: 'modal' },
  { id: 'auction-leading', category: 'Decisões centrais', label: 'Leilão com líder', description: 'Lance em andamento e caixa comprometido.', surface: 'modal' },
  { id: 'hand-discard', category: 'Decisões centrais', label: 'Mão cheia', description: 'Escolha obrigatória de uma carta para descarte.', surface: 'modal' },
  { id: 'shortcut', category: 'Decisões centrais', label: 'Atalho', description: 'Escolha de direção e destino da carta.', surface: 'modal' },
  { id: 'speed-bus', category: 'Decisões centrais', label: 'Speed Die: ônibus', description: 'Escolha entre os dois dados ou a soma.', surface: 'modal', suspended: true },
  { id: 'speed-triple', category: 'Decisões centrais', label: 'Speed Die: triplo', description: 'Seleção livre de uma casa do tabuleiro.', surface: 'modal', suspended: true },

  { id: 'card-common', category: 'Cartas', label: 'Carta comum', description: 'Revelação verde do deck Tesouro.', surface: 'modal' },
  { id: 'card-rare', category: 'Cartas', label: 'Carta rara', description: 'Revelação azul do deck Tesouro.', surface: 'modal' },
  { id: 'card-legendary', category: 'Cartas', label: 'Carta lendária', description: 'Revelação laranja do deck Acaso.', surface: 'modal' },
  { id: 'hand-target-property', category: 'Cartas', label: 'Alvo: propriedade', description: 'Seletor de alvo para uma carta ofensiva.', surface: 'hand-card' },
  { id: 'hand-target-player', category: 'Cartas', label: 'Alvo: jogador', description: 'Seletor de alvo para Auditoria Fiscal.', surface: 'hand-card' },
  { id: 'hand-panel', category: 'Cartas', label: 'Painel da mão', description: 'Cartas jogáveis, bloqueadas e com alvo.', surface: 'hand-panel' },

  { id: 'trade-compose', category: 'Negociação', label: 'Montar proposta', description: 'Compositor com títulos, dinheiro e Bus Tickets.', surface: 'trade' },
  { id: 'trade-received', category: 'Negociação', label: 'Proposta recebida', description: 'Resumo válido pronto para aceitar ou recusar.', surface: 'trade' },
  { id: 'trade-invalid', category: 'Negociação', label: 'Proposta inválida', description: 'Estado alterado depois do envio da proposta.', surface: 'trade' },

  { id: 'land-auction', category: 'Pregão', label: 'Leilão de Escassez', description: 'Três lotes concorrendo ao mesmo tempo.', surface: 'land-auction' },
  { id: 'estate-auction', category: 'Pregão', label: 'Espólio de falido', description: 'Pregão com origem de falência.', surface: 'land-auction' },

  { id: 'debt-short', category: 'HUD de decisão', label: 'Dívida sem caixa', description: 'Cobertura parcial, empréstimo e falência.', surface: 'hud' },
  { id: 'debt-payable', category: 'HUD de decisão', label: 'Dívida pagável', description: 'Caixa suficiente para quitar imediatamente.', surface: 'hud' },
  { id: 'loan-request', category: 'HUD de decisão', label: 'Pedido de empréstimo', description: 'Escolha de taxa pelo credor.', surface: 'hud' },
  { id: 'reaction-diplomacy', category: 'HUD de decisão', label: 'Reação: Diplomacia', description: 'Resposta a uma carta ofensiva.', surface: 'hud' },
  { id: 'reaction-bunker', category: 'HUD de decisão', label: 'Reação: Bunker Fiscal', description: 'Resposta a uma cobrança fiscal.', surface: 'hud' },
  { id: 'endgame', category: 'HUD de decisão', label: 'Fim de jogo', description: 'Vencedor e classificação completa.', surface: 'hud' },

  { id: 'lottery', category: 'Avisos', label: 'Prêmio da loteria', description: 'Celebração com valor e confete.', surface: 'notice' },
  { id: 'hostile-takeover', category: 'Avisos', label: 'Aquisição Hostil', description: 'Aviso informativo para a vítima.', surface: 'notice' },

  { id: 'property-ground', category: 'Títulos e venda', label: 'Cidade: terreno', description: 'Propriedade própria sem construção.', surface: 'property' },
  { id: 'property-houses', category: 'Títulos e venda', label: 'Cidade: duas casas', description: 'Aluguel ativo e ação de venda disponível.', surface: 'property' },
  { id: 'property-hotel', category: 'Títulos e venda', label: 'Cidade: hotel', description: 'Nível avançado com venda de construção.', surface: 'property' },
  { id: 'property-mortgaged', category: 'Títulos e venda', label: 'Cidade: hipotecada', description: 'Estado hipotecado e ação de desipoteca.', surface: 'property' },
  { id: 'airport-hangar', category: 'Títulos e venda', label: 'Aeroporto: hangar', description: 'Hangar construído e ação de venda.', surface: 'airport' },
  { id: 'utility-owned', category: 'Títulos e venda', label: 'Utilidade própria', description: 'Multiplicadores, hipoteca e gestão.', surface: 'utility' },

  { id: 'button-variants', category: 'Sistema visual', label: 'Comparativo de botões', description: 'Cinco pares primário e secundário para escolher uma direção.', surface: 'button-variants', prototype: true },
  { id: 'primitives', category: 'Sistema visual', label: 'Primitivos', description: 'Botões, chips e estado vazio canônicos.', surface: 'primitives' },
] as const satisfies readonly VisualLabCaseDefinition[]

export type VisualLabCase = (typeof VISUAL_LAB_CASES)[number]
export type VisualLabCaseId = VisualLabCase['id']

const DEFAULT_TITLE: Title = {
  ownerId: null,
  mortgaged: false,
  houses: 0,
  hotel: false,
  hotel2: false,
  skyscraper: false,
  hangar: false,
}

function setTitle(game: GameState, pos: number, ownerId: string | null, patch: Partial<Title> = {}): void {
  game.titles[pos] = { ...DEFAULT_TITLE, ...game.titles[pos], ownerId, ...patch }
}

function baseGame(): GameState {
  const game = createSeedState(['p1', 'p2', 'p3'], Date.now() - 22 * 60_000)
  game.players[0].cash = 1_143
  game.players[0].pos = 5
  game.players[0].busTickets = 2
  game.players[1].cash = 1_992
  game.players[1].pos = 18
  game.players[1].busTickets = 1
  game.players[2].cash = 860
  game.players[2].pos = 31

  for (const pos of [1, 3, 5, 6]) setTitle(game, pos, 'p1')
  for (const pos of [13, 14, 15, 16, 18]) setTitle(game, pos, 'p2')
  for (const pos of [25, 26, 27]) setTitle(game, pos, 'p3')

  game.immunities = [
    { beneficiaryId: 'p1', granterId: 'p2', pos: 13, lapsRemaining: 2 },
  ]
  return game
}

function resetEphemeralUI(): void {
  useBusTicketUI.setState({ armed: false, boarding: false })
  useHandCardUI.setState({ cardId: null })
  useTradeUI.setState({ open: false, dismissed: false })
}

export function prepareVisualLabCase(id: VisualLabCaseId): void {
  const game = baseGame()
  const now = Date.now()
  resetEphemeralUI()

  switch (id) {
    case 'bus-ticket':
      useBusTicketUI.setState({ armed: true })
      break
    case 'auction-empty':
      game.resolution = {
        kind: 'auction',
        auction: { pos: 33, currentBid: 0, highBidder: null, activeBidders: ['p1', 'p2', 'p3'], deadline: now + 8_000 },
      }
      break
    case 'auction-leading':
      game.resolution = {
        kind: 'auction',
        auction: { pos: 33, currentBid: 420, highBidder: 'p2', activeBidders: ['p1', 'p2', 'p3'], deadline: now + 6_000 },
      }
      break
    case 'hand-discard':
      game.players[0].hand = ['aquisicao-hostil-1', 'boicote-1', 'imunidade-1']
      game.resolution = { kind: 'card-discard', deckId: 'acaso', drawnId: 'atalho-1' }
      break
    case 'shortcut':
      game.resolution = { kind: 'card-shortcut', deckId: 'acaso', cardId: 'atalho-1' }
      break
    case 'speed-bus':
      game.turn.lastRoll = { white: [3, 5], speed: 'onibus', isDouble: false, move: 8, special: 'onibus' }
      game.turn.awaitingChoice = 'onibus'
      break
    case 'speed-triple':
      game.turn.lastRoll = { white: [3, 3], speed: 3, isDouble: true, move: 9, special: 'triple' }
      game.turn.awaitingChoice = 'triple'
      break
    case 'card-common':
      game.resolution = { kind: 'card-reveal', deckId: 'tesouro', cardId: 'passagem-onibus-1' }
      break
    case 'card-rare':
      game.resolution = { kind: 'card-reveal', deckId: 'tesouro', cardId: 'boom-economico-1' }
      break
    case 'card-legendary':
      game.resolution = { kind: 'card-reveal', deckId: 'acaso', cardId: 'aquisicao-hostil-1' }
      break
    case 'hand-target-property':
      game.players[0].hand = ['aquisicao-hostil-1']
      useHandCardUI.setState({ cardId: 'aquisicao-hostil-1' })
      break
    case 'hand-target-player':
      game.players[0].hand = ['auditoria-fiscal-1']
      useHandCardUI.setState({ cardId: 'auditoria-fiscal-1' })
      break
    case 'hand-panel':
      game.players[0].hand = ['aquisicao-hostil-1', 'auditoria-fiscal-1', 'diplomacia-1']
      break
    case 'trade-compose':
      useTradeUI.setState({ open: true })
      break
    case 'trade-received':
      game.pendingTrade = {
        fromId: 'p1',
        toId: 'p2',
        fromProps: [1, 3],
        fromCash: 150,
        toProps: [13],
        toCash: 100,
        fromBusTickets: 1,
        toBusTickets: 1,
      }
      break
    case 'trade-invalid':
      game.pendingTrade = {
        fromId: 'p1',
        toId: 'p2',
        fromProps: [13],
        fromCash: 2_000,
        toProps: [1],
        toCash: 0,
      }
      break
    case 'land-auction':
      for (const pos of [33, 34, 35]) setTitle(game, pos, null)
      game.landAuction = {
        origin: 'scarcity',
        bankruptId: null,
        bidders: ['p1', 'p2', 'p3'],
        lots: [
          { pos: 33, currentBid: 240, highBidder: 'p1', deadline: now + 7_800 },
          { pos: 34, currentBid: 0, highBidder: null, deadline: now + 6_900 },
          { pos: 35, currentBid: 320, highBidder: 'p2', deadline: now + 5_600 },
        ],
      }
      break
    case 'estate-auction':
      for (const pos of [25, 26, 27]) setTitle(game, pos, null)
      game.landAuction = {
        origin: 'bankruptcy',
        bankruptId: 'p3',
        bidders: ['p1', 'p2'],
        lots: [
          { pos: 25, currentBid: 310, highBidder: 'p2', deadline: now + 7_600 },
          { pos: 26, currentBid: 260, highBidder: 'p1', deadline: now + 6_400 },
          { pos: 27, currentBid: 0, highBidder: null, deadline: now + 5_300 },
        ],
      }
      break
    case 'debt-short':
      game.players[0].cash = 350
      game.resolution = { kind: 'debt', amount: 900, creditorId: 'p2' }
      break
    case 'debt-payable':
      game.players[0].cash = 1_400
      game.resolution = { kind: 'debt', amount: 900, creditorId: 'p2' }
      break
    case 'loan-request':
      game.pendingLoan = { debtorId: 'p1', creditorId: 'p2', principal: 550 }
      break
    case 'reaction-diplomacy':
      game.resolution = {
        kind: 'reaction-diplomacia',
        reactorId: 'p2',
        attackerId: 'p1',
        effect: 'Aquisição Hostil',
        cardId: 'diplomacia-1',
        deck: 'tesouro',
        targetPos: 13,
        targetPlayer: null,
      }
      break
    case 'reaction-bunker':
      game.resolution = { kind: 'reaction-bunker', reactorId: 'p1', amount: 640 }
      break
    case 'endgame':
      game.phase = 'ended'
      game.players[1].eliminated = true
      game.players[1].cash = 0
      game.players[2].eliminated = true
      game.players[2].cash = 0
      for (const title of Object.values(game.titles)) {
        if (title.ownerId === 'p2' || title.ownerId === 'p3') title.ownerId = null
      }
      game.eliminationOrder = [
        { playerId: 'p3', round: 12 },
        { playerId: 'p2', round: 18 },
      ]
      game.round = 22
      game.endedAt = now
      break
    case 'lottery':
      game.notice = { kind: 'free-parking', playerId: 'p1', amount: 1_250 }
      break
    case 'hostile-takeover':
      game.notice = { kind: 'hostile-takeover', victimId: 'p2', attackerId: 'p1', pos: 13 }
      break
    case 'property-ground':
      break
    case 'property-houses':
      for (const pos of [1, 3, 5]) setTitle(game, pos, 'p1', { houses: 2 })
      break
    case 'property-hotel':
      for (const pos of [1, 3, 5]) setTitle(game, pos, 'p1', { houses: 4, hotel: true })
      break
    case 'property-mortgaged':
      setTitle(game, 1, 'p1', { mortgaged: true })
      break
    case 'airport-hangar':
      setTitle(game, 6, 'p1', { hangar: true })
      break
    case 'utility-owned':
      setTitle(game, 14, 'p1')
      break
    case 'button-variants':
    case 'primitives':
      break
    default: {
      const exhaustive: never = id
      throw new Error(`Caso visual não tratado: ${exhaustive}`)
    }
  }

  useGameStore.setState({ game })
}
