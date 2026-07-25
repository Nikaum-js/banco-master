// Liga o `useGameStore` (Zustand, consumido pela UI) ao `client` multiplayer (spec 037, T017).
//
// ADITIVO por decisão de risco: NÃO refatora `store.ts`. Em single-player o store segue
// idêntico (cada método aplica o reducer local). Ao entrar numa sala, `connectMultiplayer`
// substitui os métodos de ação por versões que EMITEM comandos (`client.send`) — pessimista,
// sem aplicar local — e injeta o `game` difundido no store a cada convergência. A UI não muda:
// ela chama os mesmos métodos; só o destino muda.
import { useGameStore } from '@/game/store'
import type { Client } from './client'

// Conecta o store ao client. Retorna um desligador. Enquanto ativo, toda ação da UI vira um
// comando enviado ao host; o estado só reflete quando o comando aceito volta pela difusão.
export function connectMultiplayer(client: Client): () => void {
  // Espelha o `game` do client no store a cada mudança (difusão/snapshot/resync).
  const unsub = client.subscribe(() => {
    const g = client.game()
    if (g) useGameStore.setState({ game: g })
  })
  const g0 = client.game()
  if (g0) useGameStore.setState({ game: g0 })

  const send = client.send

  // Sobrescreve os métodos de ação: cada um constrói o `GameAction` correspondente e envia.
  // Ações de sistema (pausa, fecho de leilão por prazo) são do host — no-op vindas da UI.
  useGameStore.setState({
    rollDice: () => send({ kind: 'roll' }),
    resolvePending: () => send({ kind: 'resolve-pending' }),
    finalizeTurn: () => send({ kind: 'finalize' }),
    jailDecision: (d) => send({ kind: 'jail-decision', decision: d }),
    chooseBusMove: (opt) => send({ kind: 'choose-bus-move', opt }),
    chooseTripleDest: (pos) => send({ kind: 'choose-triple-dest', dest: pos }),
    useBusTicket: (dest) => send({ kind: 'use-bus-ticket', dest }),
    buyProperty: () => send({ kind: 'buy-property' }),
    declineProperty: () => send({ kind: 'decline-property' }),
    placeBid: (playerId, amount) => send({ kind: 'place-bid', playerId, amount }),
    passBid: (playerId) => send({ kind: 'pass-bid', playerId }),
    placeLandBid: (playerId, pos, amount) => send({ kind: 'place-land-bid', playerId, pos, amount }),
    buildHouse: (pos) => send({ kind: 'build-house', pos }),
    sellBuilding: (pos) => send({ kind: 'sell-building', pos }),
    buildHangar: (pos) => send({ kind: 'build-hangar', pos }),
    sellHangar: (pos) => send({ kind: 'sell-hangar', pos }),
    mortgageProperty: (pos) => send({ kind: 'mortgage', pos }),
    unmortgageProperty: (pos) => send({ kind: 'unmortgage', pos }),
    playHandCard: (cardId, target, targetPlayer) => send({ kind: 'play-hand-card', cardId, target, targetPlayer }),
    discardCard: (cardId) => send({ kind: 'discard-card', cardId }),
    chooseCardShortcut: (dir) => send({ kind: 'choose-card-shortcut', dir }),
    confirmCardReveal: () => send({ kind: 'confirm-card-reveal' }),
    payDebt: () => send({ kind: 'pay-debt' }),
    declareBankruptcy: () => send({ kind: 'declare-bankruptcy' }),
    grantLoan: (creditorId, principal, ratePct) => send({ kind: 'grant-loan', creditorId, principal, ratePct }),
    proposeLoan: (creditorId) => send({ kind: 'propose-loan', creditorId }),
    respondLoan: (accept, ratePct) => send({ kind: 'respond-loan', accept, ratePct }),
    payOffLoan: () => send({ kind: 'pay-off-loan' }),
    executeTrade: (trade) => send({ kind: 'execute-trade', trade }),
    proposeTrade: (trade) => send({ kind: 'propose-trade', trade }),
    acceptTrade: () => send({ kind: 'accept-trade' }),
    rejectTrade: () => send({ kind: 'reject-trade' }),
    respondReaction: (use) => send({ kind: 'respond-reaction', use }),
    dismissNotice: () => send({ kind: 'dismiss-notice' }),
    // Pausa e "novo jogo"/fecho manual de pregão são orquestrados pelo host — no-op da UI aqui.
    setPaused: () => {},
    resetGame: () => {},
    closeLandAuction: () => {},
  })

  return () => unsub()
}
