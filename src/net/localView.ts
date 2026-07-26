// Perspectiva do jogador LOCAL (spec 038, US1). Responde "quem sou eu nesta partida e o
// que, nesta tela, é meu para decidir". Puro: não conhece React, transporte nem Supabase.
//
// A pergunta "esta decisão é minha?" tem UMA fonte — `actorOfKind`/`actorOf` de
// `src/game/commands.ts`, a MESMA tabela que o host consulta para descartar comando de
// remetente ilegítimo. É por isso que affordance e autoridade não podem divergir aqui: não
// existe uma segunda lista para esquecer de atualizar.
//
// IMPORTANTE — isto NÃO é validação. Um cliente adulterado que ignore o `mayAct` tem o
// comando descartado pelo host (FR-004/FR-007 da 037, provado em `antispoof.test.ts` e no
// smoke contra a infra real). Aqui é só o que a interface oferece.
import { actorOfKind, isSenderActed, type PlayerAction } from '@/game/commands'
import { activePlayer } from '@/game/turn/turnMachine'
import type { GameState } from '@/game/turn/types'
import type { ConnectionState } from './client'
import { seatByUid, type Room } from './room'

// 'local' = sem sala (cliente único de desenvolvimento): todos os assentos são deste
// dispositivo, então nada é bloqueado — o comportamento pré-038, preservado (FR-029).
export type LocalRole = 'actor' | 'observer' | 'eliminated' | 'local'

export interface LocalView {
  readonly seatId: string | null
  readonly role: LocalRole
  isMe(playerId: string): boolean
  mayAct(kind: PlayerAction['kind']): boolean
  readonly waitingFor: string | null
}

// De quem o jogo está esperando agora — vira "aguardando <nome>" na UI. Decisões fora do
// turno (resposta a troca, reação, resposta de empréstimo) têm prioridade sobre o jogador
// da vez: é literalmente quem trava o jogo neste instante.
export function waitingForOf(game: GameState): string | null {
  if (game.phase !== 'playing') return null
  const r = game.resolution
  if (r?.kind === 'reaction-diplomacia' || r?.kind === 'reaction-bunker') return r.reactorId
  if (game.pendingTrade) return game.pendingTrade.toId
  if (game.pendingLoan) return game.pendingLoan.creditorId
  return activePlayer(game).id
}

function isEliminated(game: GameState, playerId: string | null): boolean {
  if (!playerId) return false
  return game.players.find((p) => p.id === playerId)?.eliminated ?? false
}

// Monta a visão local. `room`/`myUid` nulos ⇒ modo local (single-player). `connection`
// (041, FR-007) exige conexão para agir — desconectado não pode acionar NENHUM ponto de
// decisão, inclusive os que não dependem da vez (lance de leilão, resposta a proposta,
// reação). Modo local não tem casca de rede: sempre `'connected'`, nunca bloqueia (SC-007).
export function localView(game: GameState, room: Room | null, myUid: string | null, connection: ConnectionState = 'connected'): LocalView {
  const seat = room && myUid ? seatByUid(room, myUid) : undefined
  const seatId = seat?.playerId ?? null
  const waitingFor = waitingForOf(game)

  // Sem assento: cliente único — o dispositivo joga por todos, nada é bloqueado.
  if (!seatId) {
    return {
      seatId: null,
      role: 'local',
      isMe: (playerId) => playerId === waitingFor,
      mayAct: () => true,
      waitingFor,
    }
  }

  const eliminated = isEliminated(game, seatId)
  const role: LocalRole = eliminated ? 'eliminated' : waitingFor === seatId ? 'actor' : 'observer'

  return {
    seatId,
    role,
    isMe: (playerId) => playerId === seatId,
    mayAct(kind) {
      if (eliminated) return false // fora da partida: acompanha, não decide (FR-007)
      if (connection !== 'connected') return false // desconectado não aciona nada (041, FR-007)
      if (game.paused) return false // pausa rejeita comando de jogo (FR-014/FR-017 da 037)
      // Ator declarado pelo remetente (lance, proposta de troca): todo jogador é ator
      // legítimo em NOME PRÓPRIO. Se o motor aceita agora — ser licitante ativo, ter caixa —
      // é outra pergunta, respondida pelos gates que já existem.
      if (isSenderActed(kind)) return true
      return actorOfKind(game, kind) === seatId
    },
    waitingFor,
  }
}
