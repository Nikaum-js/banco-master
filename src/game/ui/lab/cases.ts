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
  | 'players'
  | 'primitives'

interface VisualLabCaseDefinition {
  id: string
  category: string
  label: string
  description: string
  surface: VisualLabSurface
  suspended?: boolean
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

  { id: 'estate-auction', category: 'Pregão', label: 'Espólio de falido', description: 'Três lotes do falido concorrendo ao mesmo tempo.', surface: 'land-auction' },
  { id: 'scarcity-auction-6', category: 'Pregão', label: 'Escassez com seis lotes', description: 'Grade cheia, nomes longos e maior licitante de nome longo.', surface: 'land-auction' },

  { id: 'debt-short', category: 'HUD de decisão', label: 'Dívida sem caixa', description: 'Cobertura parcial, empréstimo e falência.', surface: 'hud' },
  { id: 'debt-payable', category: 'HUD de decisão', label: 'Dívida pagável', description: 'Caixa suficiente para quitar imediatamente.', surface: 'hud' },
  { id: 'loan-request', category: 'HUD de decisão', label: 'Pedido de empréstimo', description: 'Escolha de taxa pelo credor.', surface: 'hud' },
  { id: 'reaction-diplomacy', category: 'HUD de decisão', label: 'Reação: Diplomacia', description: 'Resposta a uma carta ofensiva.', surface: 'hud' },
  { id: 'reaction-bunker', category: 'HUD de decisão', label: 'Reação: Bunker Fiscal', description: 'Resposta a uma cobrança fiscal.', surface: 'hud' },
  { id: 'endgame', category: 'HUD de decisão', label: 'Fim de jogo', description: 'Vencedor e classificação completa.', surface: 'hud' },

  { id: 'loans-many', category: 'Estados visíveis', label: 'Vários empréstimos', description: 'Dois contratos entre pares distintos, nenhum do jogador da vez.', surface: 'players' },
  { id: 'loan-single', category: 'Estados visíveis', label: 'Empréstimo único', description: 'Um contrato, com o dispositivo local no papel de devedor.', surface: 'players' },
  { id: 'immunities-both', category: 'Estados visíveis', label: 'Imunidades', description: 'Por propriedade, permanente e total temporária no mesmo jogador.', surface: 'players' },
  { id: 'effects-many', category: 'Estados visíveis', label: 'Efeitos ativos', description: 'Mesa, jogador e propriedade — os três alcances de uma vez.', surface: 'players' },
  { id: 'states-crowded', category: 'Estados visíveis', label: 'Oito jogadores, tudo ativo', description: 'Pior caso de densidade do painel.', surface: 'players' },

  { id: 'lottery', category: 'Avisos', label: 'Prêmio da loteria', description: 'Celebração com valor e confete.', surface: 'notice' },
  { id: 'hostile-takeover', category: 'Avisos', label: 'Aquisição Hostil', description: 'Aviso informativo para a vítima.', surface: 'notice' },

  { id: 'property-ground', category: 'Títulos e venda', label: 'Cidade: terreno', description: 'Propriedade própria sem construção.', surface: 'property' },
  { id: 'property-houses', category: 'Títulos e venda', label: 'Cidade: duas casas', description: 'Aluguel ativo e ação de venda disponível.', surface: 'property' },
  { id: 'property-hotel', category: 'Títulos e venda', label: 'Cidade: hotel', description: 'Nível avançado com venda de construção.', surface: 'property' },
  { id: 'property-mortgaged', category: 'Títulos e venda', label: 'Cidade: hipotecada', description: 'Estado hipotecado e ação de desipoteca.', surface: 'property' },
  { id: 'airport-hangar', category: 'Títulos e venda', label: 'Aeroporto: hangar', description: 'Hangar construído e ação de venda.', surface: 'airport' },
  { id: 'utility-owned', category: 'Títulos e venda', label: 'Utilidade própria', description: 'Multiplicadores, hipoteca e gestão.', surface: 'utility' },
  { id: 'airport-free', category: 'Títulos e venda', label: 'Aeroporto: sem dono', description: 'Título livre — a posse é dita, não inferida.', surface: 'airport' },
  { id: 'airport-owned', category: 'Títulos e venda', label: 'Aeroporto: com dono', description: 'Proprietário nomeado no título.', surface: 'airport' },
  { id: 'airport-mortgaged', category: 'Títulos e venda', label: 'Aeroporto: hipotecado', description: 'Dono e hipoteca ao mesmo tempo.', surface: 'airport' },
  { id: 'utility-free', category: 'Títulos e venda', label: 'Utilidade: sem dono', description: 'Título livre — a posse é dita, não inferida.', surface: 'utility' },
  { id: 'utility-mortgaged', category: 'Títulos e venda', label: 'Utilidade: hipotecada', description: 'Dono e hipoteca ao mesmo tempo.', surface: 'utility' },

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

function baseGame(playerCount = 3): GameState {
  const ids = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`)
  const game = createSeedState(ids, Date.now() - 22 * 60_000)
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
  useTradeUI.setState({ open: false, selectedProposalId: null })
}

export function prepareVisualLabCase(id: VisualLabCaseId): void {
  // Só o caso de densidade quer a mesa cheia: oito linhas é o pior caso do painel, e
  // montá-lo em todos os casos mudaria o enquadramento dos outros trinta.
  const game = baseGame(id === 'states-crowded' ? 8 : 3)
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
      game.players[0].hand = ['imposto-federal-1']
      useHandCardUI.setState({ cardId: 'imposto-federal-1' })
      break
    case 'hand-panel':
      game.players[0].hand = ['aquisicao-hostil-1', 'imposto-federal-1', 'diplomacia-1']
      break
    case 'trade-compose':
      useTradeUI.setState({ open: true, selectedProposalId: null })
      break
    case 'trade-received':
      game.tradeProposals = [{
        id: 1,
        trade: {
          fromId: 'p1',
          toId: 'p2',
          fromProps: [1, 3],
          fromCash: 150,
          toProps: [13],
          toCash: 100,
          fromBusTickets: 1,
          toBusTickets: 1,
        },
      }]
      useTradeUI.setState({ open: false, selectedProposalId: 1 })
      break
    case 'trade-invalid':
      game.tradeProposals = [{
        id: 1,
        trade: {
          fromId: 'p1',
          toId: 'p2',
          fromProps: [13],
          fromCash: 2_000,
          toProps: [1],
          toCash: 0,
        },
      }]
      useTradeUI.setState({ open: false, selectedProposalId: 1 })
      break
    case 'scarcity-auction-6': {
      // Pregão de ESCASSEZ com a grade cheia (D-078). Os seis lotes saem do tabuleiro
      // ativo, com lances e prazos distintos — é o estado em que a caixa mais aperta.
      const livres = Object.keys(game.titles).map(Number).slice(0, 6)
      for (const pos of livres) setTitle(game, pos, null)
      game.landAuction = {
        bankruptId: null,
        origin: 'scarcity',
        bidders: ['p1', 'p2', 'p3'],
        lots: livres.map((pos, i) => ({
          pos,
          currentBid: i === 0 ? 420 : i === 1 ? 180 : 0,
          highBidder: i === 0 ? 'p2' : i === 1 ? 'p1' : null,
          deadline: now + 24_000 - i * 3_100,
        })),
      }
      break
    }
    case 'estate-auction':
      for (const pos of [25, 26, 27]) setTitle(game, pos, null)
      game.landAuction = {
        bankruptId: 'p3',
        origin: 'bankruptcy',
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
    // 058/US1 — os três estados de posse que aeroporto e utilidade nunca disseram.
    case 'airport-free':
      setTitle(game, 6, null)
      break
    case 'airport-owned':
      setTitle(game, 6, 'p2')
      break
    case 'airport-mortgaged':
      setTitle(game, 6, 'p2', { mortgaged: true })
      break
    case 'utility-free':
      setTitle(game, 14, null)
      break
    case 'utility-mortgaged':
      setTitle(game, 14, 'p2', { mortgaged: true })
      break

    // 058/US3–US5 — os estados que o painel de jogadores passou a mostrar por inteiro.
    case 'loans-many':
      game.activeSeat = 0 // a vez é de p1, que não é parte de contrato nenhum
      game.loans = [
        { debtorId: 'p2', creditorId: 'p3', principal: 400, ratePct: 20, lapsElapsed: 0 },
        { debtorId: 'p3', creditorId: 'p2', principal: 250, ratePct: 45, lapsElapsed: 2 },
      ]
      break
    case 'loan-single':
      game.loans = [{ debtorId: 'p1', creditorId: 'p2', principal: 300, ratePct: 30, lapsElapsed: 1 }]
      break
    case 'immunities-both':
      game.immunities = [
        { beneficiaryId: 'p2', granterId: 'p1', pos: 1, lapsRemaining: 3 },
        { beneficiaryId: 'p2', granterId: 'p3', pos: 3, lapsRemaining: null },
      ]
      game.tempEffects = [{ kind: 'imunidade-total', ownerId: 'p2', pos: null, lapsRemaining: 1 }]
      break
    case 'effects-many':
      game.tempEffects = [
        { kind: 'estatizacao', ownerId: 'p1', pos: null, lapsRemaining: 1 },
        { kind: 'embargo', ownerId: 'p1', pos: null, lapsRemaining: 2, targetId: 'p3' },
        { kind: 'boicote', ownerId: 'p2', pos: 5, lapsRemaining: 2 },
        { kind: 'valorizacao', ownerId: 'p3', pos: 25, lapsRemaining: 1 },
      ]
      break
    case 'states-crowded':
      game.loans = [
        { debtorId: 'p2', creditorId: 'p3', principal: 400, ratePct: 20, lapsElapsed: 0 },
        { debtorId: 'p3', creditorId: 'p1', principal: 900, ratePct: 50, lapsElapsed: 2 },
      ]
      game.immunities = [
        { beneficiaryId: 'p2', granterId: 'p1', pos: 1, lapsRemaining: 2 },
        { beneficiaryId: 'p3', pos: 3, lapsRemaining: null },
      ]
      game.tempEffects = [
        { kind: 'estatizacao', ownerId: 'p1', pos: null, lapsRemaining: 1 },
        { kind: 'embargo', ownerId: 'p1', pos: null, lapsRemaining: 2, targetId: 'p2' },
        { kind: 'boicote', ownerId: 'p2', pos: 5, lapsRemaining: 2 },
        { kind: 'imunidade-total', ownerId: 'p3', pos: null, lapsRemaining: 1 },
      ]
      break
    case 'primitives':
      break
    default: {
      const exhaustive: never = id
      throw new Error(`Caso visual não tratado: ${exhaustive}`)
    }
  }

  useGameStore.setState({ game })
}
