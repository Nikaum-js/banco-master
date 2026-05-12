// Confirmação da desistência (§9.6 / D-057).
//
// É a única ação do jogo sem desfazer, e a única em que o jogador destrói o próprio
// patrimônio de propósito — então a confirmação não pergunta "tem certeza?" no vazio: mostra
// quantas propriedades saem, quanto de caixa some e PARA QUEM vai tudo. O herdeiro é o dado
// que ninguém deduz olhando a tela (§9.6: havendo empréstimo ativo, o credor herda), e é
// justamente o que muda a decisão de quem deve a alguém.
//
// Vai ao `document.body` por portal porque nasce dentro do painel lateral, que rola e tem
// `overflow: hidden` na seção — um `position: fixed` ali dentro sairia recortado.
import { createPortal } from 'react-dom'
import { DoorOpen } from 'lucide-react'
import { Overlay, ModalShell, ModalHeader } from '@/game/ui/shell'
import { Button } from '@/game/ui/primitives'
import { PlayerName } from '@/net/ui/PlayerName'
import { concedeView } from './concedeView'
import type { GameState } from '@/game/turn/types'
import { money as fmt } from '@/lib/money'

export function ConcedeDialog({
  game,
  playerId,
  onConfirm,
  onCancel,
}: {
  game: GameState
  playerId: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (typeof document === 'undefined') return null
  const view = concedeView(game, playerId)

  return createPortal(
    // `dismissible`: Esc e clique fora CANCELAM. É o inverso do default do `Overlay` (D-039),
    // e de propósito — aqui o caminho fácil precisa ser o de ficar na partida, não o de sair.
    <Overlay z={69} dismissible onClick={onCancel}>
      <ModalShell className="w-[min(26rem,100%)]">
        <ModalHeader
          tone="signal"
          icon={<DoorOpen size={22} aria-hidden />}
          title="Desistir da partida?"
          subtitle="Não há como voltar"
        />
        <div className="px-5 pb-5 flex flex-col gap-3.5">
          <p className="text-cream-muted text-sm leading-snug">
            Você sai agora e acompanha o resto da partida como espectador. Seu assento entra na
            classificação final na posição em que saiu.
          </p>

          <ul className="concede-dialog__facts">
            <li>
              <span>Propriedades</span>
              <strong className="currency">{view.properties}</strong>
            </li>
            <li>
              <span>Caixa</span>
              <strong className="currency">{fmt(view.cash)}</strong>
            </li>
            <li>
              <span>Fica com</span>
              <strong className="concede-dialog__heir">
                {view.heirId ? <PlayerName playerId={view.heirId} dot /> : 'Banco'}
              </strong>
            </li>
          </ul>

          <p className="text-cream-muted text-xs leading-snug">
            {view.heirId ? (
              // §9.6: desistir não apaga empréstimo. Dizer isso ANTES evita a descoberta cara.
              <>
                Você tem empréstimo ativo, então o credor herda tudo (propriedades, construções e
                caixa), como numa falência.
              </>
            ) : (
              <>
                Suas propriedades voltam livres ao banco, sem construções e sem hipoteca, e
                qualquer um pode comprá-las ao cair nelas. Seu caixa some da partida.
              </>
            )}
          </p>

          <div className="flex gap-2 justify-end pt-1">
            {/* Primeiro no DOM de propósito: `useDialogA11y` foca o primeiro controle, e o
                primeiro tem de ser o de FICAR. Quem abriu por engano sai com um Enter. */}
            <Button variant="secondary" onClick={onCancel}>
              Continuar jogando
            </Button>
            <Button variant="danger" onClick={onConfirm}>
              Desistir
            </Button>
          </div>
        </div>
      </ModalShell>
    </Overlay>,
    document.body,
  )
}
