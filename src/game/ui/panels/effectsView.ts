// VIEW-MODEL DOS EFEITOS ATIVOS (058/US5).
//
// `effectRow`, no `boards/shared.tsx`, produzia prosa fixa: "Alvo sem construir" sem nomear
// o alvo, "Jogador protegido de cobranças" sem nomear o jogador, "Aluguéis vão à Loteria"
// sem dizer que atinge a mesa inteira. E não era desleixo: a função **não recebia a sala**,
// então não tinha como resolver identidade nenhuma — o id `p2` jamais poderia aparecer na
// tela (D-019/FR-009), e o resto do jogo já resolve identidade em `identityOf`.
//
// Efeitos ativos são públicos por regra (§12.3), e são o que explica um aluguel que não
// chegou ou uma construção bloqueada. Sem alvo e sem alcance, a linha informa que "algo
// está acontecendo" — que é o mesmo que não informar.
//
// A DURAÇÃO VEM DE `lapsRemaining`, sempre. É o que fez a D-080 (Estatização de 2 voltas
// para 1) não exigir uma única edição de texto de painel.
import { identityOf, type PlayerIdentity } from '@/net/identity'
import type { Room } from '@/net/room'
import type { TempEffect } from '@/game/economy/types'
import { activeBoard, activeLabels } from '@/game/ui/theme/boardTheme'

/** Alcance do efeito — a informação que faltava, e a que mais muda a leitura. */
export type EffectScope = 'mesa' | 'jogador' | 'propriedade'

export interface EffectRow {
  key: string
  /** Nome do efeito, como o jogador o conhece pela carta. */
  label: string
  scope: EffectScope
  /** Quem é afetado ou beneficiado — `null` quando o efeito é da mesa. */
  subject: PlayerIdentity | null
  /** Propriedade afetada — `null` fora do escopo de propriedade. */
  pos: number | null
  place: string | null
  /** Consequência em uma frase, já com alvo e lugar resolvidos. */
  consequence: string
  lapsRemaining: number
  /** Letra do selo na casa, para leitura cruzada painel ⇄ tabuleiro. */
  tag: string
  tone: 'logo' | 'gold'
}

/** "1 volta" / "2 voltas" — plural correto, derivado do estado. */
export function lapsLabel(laps: number): string {
  return laps === 1 ? '1 volta' : `${laps} voltas`
}

/**
 * Projeta um `TempEffect` para leitura.
 *
 * `room` pode ser `null` (partida sem sala): `identityOf` cai no fallback "Jogador N", que é
 * exatamente o comportamento que o resto da interface já tem.
 */
export function effectRow(effect: TempEffect, index: number, room: Room | null = null): EffectRow {
  const labels = activeLabels()
  const place = effect.pos !== null ? (activeBoard()[effect.pos]?.name ?? null) : null
  const lottery = labels.lottery

  // `ownerId` é quem ORIGINOU o efeito (o relógio da expiração corre no GO dele). Para
  // embargo, o afetado é `targetId`; para imunidade total, originador e beneficiário são a
  // mesma pessoa.
  const owner = identityOf(room, effect.ownerId)

  switch (effect.kind) {
    case 'apagao':
      return {
        key: `a${index}`, label: `Greve (${labels.hangar})`, scope: 'mesa', subject: null,
        pos: null, place: null,
        consequence: `Toda ${labels.hangar} fica inativa — aeroportos voltam ao aluguel base`,
        lapsRemaining: effect.lapsRemaining, tag: 'A', tone: 'logo',
      }
    case 'greve':
      return {
        key: `g${index}`, label: 'Greve (Utilidades)', scope: 'mesa', subject: null,
        pos: null, place: null,
        consequence: 'As utilidades não cobram aluguel de ninguém',
        lapsRemaining: effect.lapsRemaining, tag: 'G', tone: 'logo',
      }
    case 'boicote':
      return {
        key: `b${index}`, label: 'Boicote', scope: 'propriedade', subject: null,
        pos: effect.pos, place,
        consequence: `${place ?? 'A propriedade'} não cobra aluguel de ninguém`,
        lapsRemaining: effect.lapsRemaining, tag: 'B', tone: 'logo',
      }
    case 'imunidade-temp':
      // Sem fonte viva desde a D-064 (a carta virou Imunidade Total); continua representável
      // para snapshot em voo, e a interface não pode quebrar ao encontrá-lo.
      return {
        key: `i${index}`, label: 'Imunidade temporária', scope: 'propriedade', subject: null,
        pos: effect.pos, place,
        consequence: `${place ?? 'A propriedade'} não pode ser alvo de efeito`,
        lapsRemaining: effect.lapsRemaining, tag: 'I', tone: 'gold',
      }
    case 'estatizacao':
      return {
        key: `e${index}`, label: 'Estatização', scope: 'mesa', subject: null,
        pos: null, place: null,
        consequence: `Todos os aluguéis da mesa vão para a ${lottery} em vez do dono`,
        lapsRemaining: effect.lapsRemaining, tag: 'E', tone: 'logo',
      }
    case 'valorizacao':
      return {
        key: `v${index}`, label: 'Valorização', scope: 'propriedade', subject: owner,
        pos: effect.pos, place,
        consequence: `${place ?? 'A propriedade'} cobra aluguel em dobro`,
        lapsRemaining: effect.lapsRemaining, tag: 'V', tone: 'gold',
      }
    case 'embargo': {
      // O afetado é o ALVO, não quem jogou a carta — e era exatamente este nome que faltava.
      const alvo = effect.targetId ? identityOf(room, effect.targetId) : null
      return {
        key: `em${index}`, label: 'Embargo de Obras', scope: 'jogador', subject: alvo,
        pos: null, place: null,
        consequence: alvo ? `${alvo.name} não pode construir` : 'O alvo não pode construir',
        lapsRemaining: effect.lapsRemaining, tag: 'O', tone: 'logo',
      }
    }
    case 'imunidade-total':
      return {
        key: `it${index}`, label: 'Imunidade Total', scope: 'jogador', subject: owner,
        pos: null, place: null,
        consequence: `${owner.name} não paga aluguel nem imposto e não pode ser alvo de efeito`,
        lapsRemaining: effect.lapsRemaining, tag: 'I', tone: 'gold',
      }
  }
}

/** Todos os efeitos ativos, na ordem em que o motor os mantém. */
export function effectsView(effects: readonly TempEffect[], room: Room | null = null): EffectRow[] {
  return effects.map((effect, index) => effectRow(effect, index, room))
}
