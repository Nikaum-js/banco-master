// Região viva do caminho de jogo (044, T026 — US3/D5 do plan, D-039).
//
// Canal EDUCADO (`aria-live="polite"`): anuncia a ÚLTIMA entrada do log com a MESMA frase
// que a tela mostra — `describeLogEntry` (040/D-032) é a única fronteira que converte fato
// tipado em português, e esta região só a renderiza como texto puro em vez de fragmentos
// coloridos (mesma fonte, duas apresentações, D5). Calculado DIRETO no corpo do componente
// (não num efeito) de propósito: um `kind` desconhecido faz `describeLogEntry` lançar por
// exaustividade, e só um throw durante RENDER é capturado pela `AccessoryErrorBoundary` que
// envolve este módulo — é literalmente o bug que motivou a spec 042 (som/log não podem
// derrubar a mesa), e aqui a mesma fronteira contém o mesmo tipo de falha.
//
// Canal ASSERTIVO (`aria-live="assertive"`): três fatos urgentes, nunca o log inteiro —
// início da minha vez (ou de uma decisão minha: reação/dívida/empréstimo, via
// `waitingForOf`), comando recusado por falha (mesmo fato que `CommandFailureToast` já
// mostra visualmente) e leilão a poucos segundos de fechar (mesmo limiar de urgência que
// `AuctionCard` já usa visualmente, §12.2).
import { useEffect, useRef, useState } from 'react'
import { AccessoryErrorBoundary } from '@/app/AccessoryErrorBoundary'
import { useGameStore } from '@/game/store'
import { useRoomStore, useLocalView } from '@/net/roomStore'
import { describeLogEntry, type LogSentence } from '@/game/ui/log/describeLog'
import { activeModal } from '@/game/ui/modals/activeModal'
import { BOARD } from '@/lib/boardData'
import { money } from '@/lib/money'

// Mesmos fragmentos que `LogSentenceView` (boards/shared.tsx) já usa pra colorir a tela —
// aqui só viram concatenação em texto puro, porque região viva não tem estilo.
function sentenceToText(sentence: LogSentence): string {
  return sentence
    .map((f) => {
      switch (f.t) {
        case 'text':
          return f.text
        case 'money':
          return money(f.amount)
        case 'player':
          return f.identity.name
        case 'place':
          return BOARD[f.pos]?.name ?? `#${f.pos}`
        default:
          return ''
      }
    })
    .join('')
}

// Leilão a ≤3s de fechar — mesmo limiar que `AuctionCard` (ModalLayer.tsx) já usa pro
// timer virar vermelho. Um aviso por leilão (guarda pela `deadline`, que muda a cada novo
// leilão e a cada lance que a reseta), não um por segundo.
function useAuctionUrgentAnnouncement(): string {
  const game = useGameStore((s) => s.game)
  const [text, setText] = useState('')
  const warnedDeadline = useRef<number | null>(null)

  useEffect(() => {
    const view = activeModal(game)
    if (view?.kind !== 'auction') {
      warnedDeadline.current = null
      return
    }
    const { deadline, square } = view
    const check = () => {
      const msLeft = deadline - Date.now()
      if (msLeft > 0 && msLeft <= 3000 && warnedDeadline.current !== deadline) {
        warnedDeadline.current = deadline
        setText(`Leilão de ${square.name} terminando`)
      }
    }
    check()
    const t = setInterval(check, 250)
    return () => clearInterval(t)
  }, [game])

  return text
}

// "É a sua vez" — cobre início do turno E qualquer decisão que passe a esperar por mim
// (reação, dívida, empréstimo): `waitingFor` é a mesma fonte que `LocalView` já usa pra
// decidir quem o HUD aguarda (net/localView.ts). Deriva puro: sem "aviso anterior" pra
// rastrear — o texto só muda (e só então é anunciado) quando a espera passa a ser minha.
function useYourTurnAnnouncement(): string {
  const view = useLocalView()
  if (view.waitingFor && view.isMe(view.waitingFor)) return 'Sua vez'
  return ''
}

// Comando recusado por FALHA (não por regra — recusa por regra continua silenciosa, D-035
// da 042): mesmo `roomStore.commandFailure` que já alimenta o `CommandFailureToast`
// visível, aqui promovido a assertivo porque é uma surpresa ("achei que tinha aplicado").
function useCommandFailureAnnouncement(): string {
  const failure = useRoomStore((s) => s.commandFailure)
  return failure ? 'Sua ação não foi aplicada' : ''
}

function LiveRegionInner() {
  const log = useGameStore((s) => s.game.log)
  const room = useRoomStore((s) => s.room)
  const lastEntry = log[log.length - 1]
  const polite = lastEntry ? sentenceToText(describeLogEntry(lastEntry, room)) : ''

  const turnText = useYourTurnAnnouncement()
  const failureText = useCommandFailureAnnouncement()
  const auctionText = useAuctionUrgentAnnouncement()
  // Prioridade entre os três fatos assertivos, do mais urgente pro menos: comando recusado
  // agora mesmo > leilão fechando > início da minha vez. Concatenar os três confundiria o
  // leitor de tela com uma frase só; mostrar um de cada vez é o que realmente é assertivo.
  const assertive = failureText || auctionText || turnText

  return (
    <>
      <div aria-live="polite" role="status" className="sr-only">
        {polite}
      </div>
      <div aria-live="assertive" role="alert" className="sr-only">
        {assertive}
      </div>
    </>
  )
}

// Anúncio é ACESSÓRIO — ninguém precisa dele pra rolar o dado, comprar ou aceitar uma
// troca (mesmo princípio do som/log, spec 042, D-035). `describeLogEntry` lançando por um
// `kind` desconhecido não pode derrubar a mesa: a fronteira contém, mostra a linha padrão
// de indisponibilidade (invisível — `AccessoryErrorBoundary` não é `aria-hidden`, mas
// também não está no caminho de nenhum controle) e a partida segue.
export function LiveRegion() {
  return (
    <AccessoryErrorBoundary label="Anúncios">
      <LiveRegionInner />
    </AccessoryErrorBoundary>
  )
}
