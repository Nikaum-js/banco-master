// POSSE DE UM TÍTULO — primitiva única (058, US1).
//
// A escritura de CIDADE mostrava dono desde a 003; aeroporto, utilidade e mina, não — e não
// por regressão, mas por ausência desde a origem: cada popover foi escrito separadamente e
// só o de cidade ganhou o bloco. Na jogatina isso significa que o dono de um aeroporto só é
// descobrível pela luz colorida da célula no tabuleiro, que em 360px é ambígua entre dois
// assentos de cor próxima.
//
// Uma primitiva, quatro consumidores. Quatro cópias divergindo é exatamente como a utilidade
// ficou meses sem dizer quem era o dono sem ninguém notar.
//
// O estado LIVRE também é dito em voz alta — nenhuma das quatro superfícies o dizia. Omitir
// a linha quando não há dono transforma "à venda" numa inferência a partir da AUSÊNCIA de
// interface, que é o oposto de informar.
import { useGameStore } from '@/game/store'
import { useRoomStore } from '@/net/roomStore'
import { identityOf } from '@/net/identity'
import { PlayerFace } from '@/boards/PlayerFace'
import { Chip } from '@/game/ui/primitives'

/**
 * Bloco de posse de um título comprável — cidade, aeroporto, utilidade ou mina.
 *
 * Lê `titles[pos]` do motor e resolve a identidade pela SALA (D-019: o `GameState` não
 * carrega nome, cor nem avatar). Sem sala, `identityOf` cai no fallback de sempre.
 *
 * **Nome completo sem depender de ponteiro** (FR-005): o nome visível pode quebrar em duas
 * linhas em vez de sumir em reticências, e o nome acessível do bloco carrega a frase inteira
 * ("Dono: Fulano, hipotecada"). `title` continua ali para quem tem mouse, mas ele não é mais
 * o único caminho — num celular, `title` não existe.
 */
export function TitleOwnership({ pos }: { pos: number }) {
  const ownerId = useGameStore((s) => s.game.titles[pos]?.ownerId ?? null)
  const mortgaged = useGameStore((s) => s.game.titles[pos]?.mortgaged ?? false)
  const room = useRoomStore((s) => s.room)

  // Título sem dono não pode estar hipotecado (só o dono hipoteca). Se um estado assim
  // chegar mesmo assim, "livre" prevalece — é a leitura que não mente sobre quem cobra.
  if (!ownerId) {
    return (
      <div className="property-deed__status" data-ownership="free">
        <span className="property-deed__free">
          <i aria-hidden />
          Sem dono · à venda
        </span>
      </div>
    )
  }

  const owner = identityOf(room, ownerId)
  const label = mortgaged ? `Dono: ${owner.name}. Hipotecada.` : `Dono: ${owner.name}`

  return (
    <div className="property-deed__status" data-ownership="owned" aria-label={label} title={label}>
      <div className="property-deed__owner">
        <PlayerFace
          color={owner.color}
          avatar={owner.avatar}
          skin={owner.skin}
          size={30}
          className="property-deed__owner-avatar"
        />
        <span className="property-deed__owner-copy">
          <span aria-hidden>Dono</span>
          <strong>{owner.name}</strong>
        </span>
      </div>
      {mortgaged && <Chip tone="alert" className="ml-auto text-nano">Hipotecada</Chip>}
    </div>
  )
}
