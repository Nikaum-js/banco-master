// VIEW-MODEL DO PAINEL DE JOGADORES — card 7 do review de arquitetura (2026-07-25).
//
// Puro e testável, e por isso era o ÚNICO dos 37 exports de `boards/shared.tsx` com teste.
// Estava encalhado no meio de um arquivo React de 3.656 linhas por pura co-locação com o
// `PlayersPanel`; seus irmãos (`deedView`, `handView`, `tradesView`, `activeModal`) já
// moravam em `game/ui/`. Agora mora junto deles.
import { identityOf } from '@/net/identity'
import { seatByUid, type Room } from '@/net/room'
import type { GameState } from '@/game/turn/types'
import type { AvatarId } from '@/boards/playerAvatarCatalog'
import type { SkinId } from '@/boards/playerSkinCatalog'

// ---------------------------------------------------------------------
// Mockups de painéis laterais — fiel ao HUD do SRS §12.3.
// Refletidos: saldo, cartas em mão (contador), Bus Tickets, empréstimos,
// imunidades, Pote de Férias, Speed Die, GO progressivo, log de eventos.
// ---------------------------------------------------------------------
export type Player = {
  id?: string               // playerId do motor ('p1'..'p8') — chave estável (nomes duplicam)
  name: string
  color: string
  avatar: AvatarId
  skin: SkinId
  connected?: boolean       // spec 038 — status de sessão no painel (§12.3/FR-015)
  you?: boolean             // spec 038 — o assento deste dispositivo
  money: number
  pos: number
  cardsInHand: number       // SRS §10.3 — privado, só contador é visível
  busTickets: number        // SRS §10.7 — contador separado
  loanActive?: boolean      // SRS §15
  immune?: boolean          // SRS §13.8 / §10 — imunidade ativa
  speedDieReady?: boolean   // SRS §13.2 — após 1ª volta
  active?: boolean
  bankrupt?: boolean
}

// --- Ponte com o motor (020): estado reativo dos painéis ---------------------
// Paleta de token por assento (disjunta das cores de grupo). Espelhada em
// `src/net/room.ts` (SEAT_COLORS), que é a fonte para a escolha no lobby — e a razão de
// cada valor está lá (D-045: OKLCH, croma coeso, ordem por ponto-mais-distante).
export const PLAYER_COLORS = ['#d9a650', '#3b8bd0', '#36dde7', '#00bca5', '#e77376', '#7b9d41', '#b665a2', '#b0a5ff']

// Mapeia o GameState real → view-model `Player` dos painéis. PURO (testável).
// A identidade (nome/cor/avatar/skin) vem da SALA quando há uma (spec 038/046); sem sala, do fallback —
// nunca do `GameState`, que segue sem PII (D-019). É aqui que `p1..pN` some da UI.
export function playersView(game: GameState, room: Room | null = null, myUid: string | null = null): Player[] {
  const activeId = game.players[game.turnOrder[game.activeSeat]]?.id
  const mySeat = room && myUid ? seatByUid(room, myUid) : undefined
  const playersInTurnOrder = game.turnOrder
    .map((playerIndex) => game.players[playerIndex])
    .filter((player): player is GameState['players'][number] => player !== undefined)

  return playersInTurnOrder.map((p) => {
    const identity = identityOf(room, p.id)
    return {
      id: p.id,
      name: identity.name,
      color: identity.color,
      avatar: identity.avatar,
      skin: identity.skin,
      connected: room ? (room.seats.find((s) => s.playerId === p.id)?.connected ?? true) : true,
      you: mySeat?.playerId === p.id,
      money: p.cash,
      pos: p.pos,
      cardsInHand: p.hand.length, // só o contador é público (privacidade §10.3)
      busTickets: p.busTickets,
      speedDieReady: p.completouPrimeiraVolta,
      active: p.id === activeId,
      bankrupt: p.eliminated,
      loanActive: game.loans.some((l) => l.debtorId === p.id),
      immune: game.immunities.some((i) => i.beneficiaryId === p.id),
    }
  })
}
