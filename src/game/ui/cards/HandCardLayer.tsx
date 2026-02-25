// Seletor de alvo ao usar uma carta de mão com alvo (029). Único ponto com efeito:
// dispara playHandCard(cardId, target?, targetPlayer?, target2?). Os alvos vêm de cardTargets
// (puro) — exatamente os que o motor aceita. Diplomacia é interceptada pelo motor.
// Permuta Forçada (D-064) roda em duas etapas: escolhe a própria, depois a do adversário.
import { type ReactNode, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { useGameStore } from '@/game/store'
import { useLocalView } from '@/net/roomStore'
import { PlayerName } from '@/net/ui/PlayerName'
import { cardById } from '@/game/cards/catalog'
import { cardLabel } from './cardMeta'
import { cardTargets } from './handView'
import { sortedTargets, TARGET_EFFECT, type TargetFacts } from './targetView'
import { CountryFlagDisc } from '@/boards/glyphs/flags'
import { SquareIcon } from '@/boards/glyphs/squares'
import { money } from '@/lib/money'
import { useHandCardUI } from './handCardUI'
import { Button } from '@/game/ui/primitives'
import { Overlay, ModalShell, ModalHeader } from '@/game/ui/shell'
import { activeBoard } from '@/game/ui/theme/boardTheme'


function Backdrop({ children }: { children: ReactNode }) {
  return (
    <Overlay z={66} onClick={() => useHandCardUI.getState().close()}>
      {children}
    </Overlay>
  )
}

function TargetBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-2 rounded-[var(--radius-sharp)] text-left text-sm bg-coffee-900 border border-coffee-500 text-cream hover:border-gold hover:bg-coffee-700 transition-colors"
    >
      {children}
    </button>
  )
}

/**
 * CARD 07 — o alvo como ESCRITURA, não como nome numa lista.
 *
 * A ordem de leitura é a da decisão, não a do tabuleiro: primeiro o que dói (o aluguel que a
 * carta vai zerar, em latão e no maior corpo da linha), depois de quem é, e só então cidade,
 * país e bandeira. A stripe de cor do grupo à esquerda é a mesma linguagem do tabuleiro — é como
 * o jogador reconhece "isso é peça do país fechado dele" sem ler texto.
 *
 * Nome longo trunca por `min-w-0` + `truncate` na coluna de identidade; a stripe e a coluna de
 * dinheiro têm largura própria, então nada empurra nada. A `tabular-nums` da fonte de números
 * mantém os valores alinhados entre linhas de alturas iguais.
 */
function TargetDeedRow({ facts, onClick, myId }: { facts: TargetFacts; onClick: () => void; myId: string | null }) {
  const alheia = facts.ownerId && facts.ownerId !== myId
  const paisIncompleto = facts.groupTotal > 0 && facts.groupOwned < facts.groupTotal

  return (
    <button
      type="button"
      onClick={onClick}
      className="target-deed"
      style={{ '--target-accent': facts.accent } as React.CSSProperties}
    >
      <span className="target-deed__stripe" aria-hidden />

      {facts.flagCode ? (
        <CountryFlagDisc code={facts.flagCode} size={30} />
      ) : (
        <span className="target-deed__glyph" aria-hidden><SquareIcon square={activeBoard()[facts.pos]} size={22} /></span>
      )}

      <span className="target-deed__identity">
        <span className="target-deed__name">{facts.name}</span>
        <span className="target-deed__meta">
          {facts.country ?? facts.groupLabel}
          {alheia && <> · de <PlayerName playerId={facts.ownerId!} /></>}
        </span>
      </span>

      <span className="target-deed__money">
        {facts.currentRent === null ? (
          <span className="target-deed__idle">{facts.mortgaged ? 'hipotecada' : 'sem dono'}</span>
        ) : (
          <>
            <span className="target-deed__rent">{money(facts.currentRent)}</span>
            <span className="target-deed__rent-label">aluguel hoje</span>
          </>
        )}
      </span>

      {/* Sinais estruturais, textuais — nunca só por cor (§12.6). */}
      <span className="target-deed__signals">
        {facts.level > 0 && <span className="target-deed__chip" title={`Nível de construção ${facts.level} de 7`}>N{facts.level}</span>}
        {paisIncompleto && (
          <span className="target-deed__chip target-deed__chip--muted" title={`O dono tem ${facts.groupOwned} de ${facts.groupTotal} cidades deste país`}>
            {facts.groupOwned}/{facts.groupTotal}
          </span>
        )}
      </span>
    </button>
  )
}

export function HandCardLayer() {
  const cardId = useHandCardUI((s) => s.cardId)
  const close = useHandCardUI((s) => s.close)
  const game = useGameStore((s) => s.game)
  const dispatch = useGameStore((s) => s.dispatch)
  const view = useLocalView()
  // Permuta Forçada (D-064): posição PRÓPRIA já escolhida na 1ª etapa; null = ainda na 1ª.
  const [ownPick, setOwnPick] = useState<number | null>(null)
  // Alvos da carta do DONO DESTA TELA (spec 038, FR-005); sem sala, é o jogador da vez.
  const myId = view.seatId ?? game.players[game.turnOrder[game.activeSeat]]?.id

  // O backdrop fecha direto no store (sem passar por closeAll): zera a etapa da Permuta
  // aqui para a próxima carta aberta não herdar uma escolha velha.
  if (!cardId && ownPick !== null) setOwnPick(null)

  const targets = cardId && myId ? cardTargets(game, myId, cardId) : null
  const effect = cardId ? cardById(cardId).effect : ''
  const rules = TARGET_EFFECT[effect] ?? null
  const closeAll = () => {
    setOwnPick(null)
    close()
  }
  const play = (target?: number, targetPlayer?: string, target2?: number) => {
    if (cardId) dispatch({ kind: 'play-hand-card', cardId, target, targetPlayer, target2 })
    closeAll()
  }

  // Permuta Forçada (D-064) — duas etapas: com `positionsOwn` presente e nada escolhido,
  // a lista é a das PRÓPRIAS; depois, a das adversárias.
  const twoStep = (targets?.positionsOwn?.length ?? 0) > 0
  const pickingOwn = twoStep && ownPick === null
  const positions = pickingOwn ? (targets?.positionsOwn ?? []) : (targets?.positions ?? [])
  const subtitle = pickingOwn ? 'Escolha a SUA propriedade entregue' : twoStep ? 'Escolha a propriedade que vai tomar' : 'Escolha o alvo'

  return (
    <AnimatePresence>
      {cardId && targets ? (
        <Backdrop key="hand-target">
          <ModalShell className="w-[440px] max-w-[94vw] max-h-[90vh] flex flex-col">
            <ModalHeader title={`Usar ${cardLabel(effect)}`} subtitle={subtitle} />

            {/* O que a carta FAZ, antes de pedir a escolha (CARD 07). A duração é um chip, e não
                mais uma palavra na frase, porque é o fato que o jogador esquece primeiro. */}
            {rules && (
              <div className="target-brief">
                <p className="target-brief__effect">
                  {rules.effect}
                  <span className="target-brief__duration">{rules.duration}</span>
                </p>
                <p className="target-brief__consequence">{rules.consequence}</p>
              </div>
            )}

            <div className="flex-1 overflow-auto p-2.5 flex flex-col gap-1.5">
              {/* Ordenados pelo aluguel que a carta vai atingir — quem escolhe alvo quer saber
                  onde dói, não em que ordem as casas aparecem andando pelo tabuleiro. */}
              {sortedTargets(game, positions).map((facts) => (
                <TargetDeedRow
                  key={`p${facts.pos}`}
                  facts={facts}
                  myId={myId}
                  onClick={() => {
                    if (pickingOwn) setOwnPick(facts.pos)
                    else if (twoStep) play(facts.pos, undefined, ownPick ?? undefined)
                    else play(facts.pos)
                  }}
                />
              ))}
              {(targets.players ?? []).map((pid) => (
                <TargetBtn key={`j${pid}`} onClick={() => play(undefined, pid)}>
                  <PlayerName playerId={pid} dot className="flex-1 min-w-0" />
                </TargetBtn>
              ))}
            </div>

            <div className="px-4 py-3 border-t-2 border-coffee-950 shrink-0">
              <Button
                variant="secondary"
                onClick={() => (twoStep && ownPick !== null ? setOwnPick(null) : closeAll())}
                className="w-full"
              >
                {twoStep && ownPick !== null ? 'Voltar' : 'Cancelar'}
              </Button>
            </div>
          </ModalShell>
        </Backdrop>
      ) : null}
    </AnimatePresence>
  )
}
