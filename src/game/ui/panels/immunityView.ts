// VIEW-MODEL DAS IMUNIDADES (058/US4).
//
// O indicador anterior era `immune?: boolean` em `playersView`, calculado com
// `game.immunities.some((i) => i.beneficiaryId === p.id)`, e a linha do jogador mostrava
// "IMU" com `title="Imunidade ativa"`. Isso joga fora TUDO o que `game.immunities` já
// carrega — beneficiário, propriedade, quem concedeu e prazo — e ainda confunde duas coisas
// que o SRS mantém separadas:
//
//   · **Imunidade de aluguel** (§8.4): negociada numa troca, vale para UMA propriedade, tem
//     concedente e dura N voltas OU é permanente. É moeda de troca — um benefício cujo
//     escopo é ilegível não pode ser precificado.
//   · **Imunidade Total** (§10.6, carta): protege o JOGADOR inteiro de aluguel, imposto e
//     efeito negativo, por 1 volta.
//
// "Contra quem" só aparece quando a regra registra vínculo (`granterId`). Onde não há, a
// interface OMITE em vez de inventar.
//
// Nada aqui é privado: "Imunidades ativas são exibidas no HUD e no painel de propriedades
// para todos" (§8.4).
import { identityOf, type PlayerIdentity } from '@/net/identity'
import type { Room } from '@/net/room'
import type { GameState } from '@/game/turn/types'

export interface PropertyImmunityRow {
  scope: 'propriedade'
  beneficiary: PlayerIdentity
  pos: number
  /** Quem concedeu, quando a troca registrou (§8.4). `null` = vínculo não registrado. */
  granter: PlayerIdentity | null
  /** Voltas restantes, ou `null` para **permanente** — que é um estado, não um zero. */
  lapsRemaining: number | null
}

export interface TotalImmunityRow {
  scope: 'total'
  beneficiary: PlayerIdentity
  lapsRemaining: number
}

export type ImmunityRow = PropertyImmunityRow | TotalImmunityRow

export interface PlayerImmunities {
  rows: ImmunityRow[]
  count: number
  hasTotal: boolean
  propertyCount: number
}

/** Imunidades de UM jogador, das duas naturezas, prontas para a linha e para o detalhe. */
export function immunitiesOf(
  game: GameState,
  playerId: string,
  room: Room | null = null,
): PlayerImmunities {
  const rows: ImmunityRow[] = []

  for (const immunity of game.immunities) {
    if (immunity.beneficiaryId !== playerId) continue
    rows.push({
      scope: 'propriedade',
      beneficiary: identityOf(room, immunity.beneficiaryId),
      pos: immunity.pos,
      granter: immunity.granterId ? identityOf(room, immunity.granterId) : null,
      lapsRemaining: immunity.lapsRemaining,
    })
  }

  for (const effect of game.tempEffects) {
    // `ownerId` no `imunidade-total` é o próprio beneficiário: a carta não tem alvo, ela
    // protege quem a jogou (§10.6).
    if (effect.kind !== 'imunidade-total' || effect.ownerId !== playerId) continue
    rows.push({
      scope: 'total',
      beneficiary: identityOf(room, playerId),
      lapsRemaining: effect.lapsRemaining,
    })
  }

  return {
    rows,
    count: rows.length,
    hasTotal: rows.some((r) => r.scope === 'total'),
    propertyCount: rows.filter((r) => r.scope === 'propriedade').length,
  }
}

/**
 * Duração em texto. **Permanente** é um estado próprio — apresentá-lo como "0 voltas" ou
 * deixar o campo vazio inverte o sentido de uma imunidade que vale até o fim da partida.
 */
export function immunityDurationLabel(lapsRemaining: number | null): string {
  if (lapsRemaining === null) return 'Permanente'
  return lapsRemaining === 1 ? 'resta 1 volta' : `restam ${lapsRemaining} voltas`
}
