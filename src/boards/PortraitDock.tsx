// Gaveta de retrato de celular (D-079). Em retrato estreito os painéis deixam de ser
// LATERAIS — não há largura para eles ao lado de um tabuleiro que precisa da viewport
// inteira — e viram esta gaveta abaixo do tabuleiro.
//
// Duas responsabilidades, e só duas:
//
//  1. **Cockpit** — o caixa e a vez do assento DESTE dispositivo, sem exigir toque nenhum.
//     É o mínimo que a D-079 promete estar sempre à vista; o resto (adversários, cartas,
//     negociações) mora nas abas. A ação principal não está aqui de propósito: ela vive no
//     miolo do tabuleiro (D-066), que em retrato está sempre visível — duplicá-la daria
//     dois botões com o mesmo nome acessível para o mesmo comando.
//
//  2. **Abas** — `tablist` de verdade (`role`/`aria-selected`/`aria-controls` + setas),
//     porque os dois painéis continuam montados e alternam por `hidden`. Quem escolhe
//     QUAL aparece é o React, não o CSS: `display:none` por folha de estilo esconderia do
//     leitor de tela sem que a interface soubesse qual aba está ativa.
//
// O componente só é montado em retrato estreito (`Board01Classic`); em paisagem ele não
// existe e os painéis voltam a ser as duas gavetas laterais de sempre.
import { useRef } from 'react'
import { PlayerFace } from './PlayerFace'
import { money } from '@/lib/money'
import { cn } from '@/lib/utils'
import { DOCK_TABS, type DockTab } from './dockTabs'
import { playersView, type Player } from '@/game/ui/panels/playersView'
import { useGameStore } from '@/game/store'
import { useRoomStore } from '@/net/roomStore'

// A assinatura do estado dos jogadores mora AQUI, e não no `Board01Classic`, de propósito:
// lá em cima ela faria as 48 casas do tabuleiro re-renderizarem a cada mutação de caixa.
// Este componente só existe em retrato, então a subscrição também só existe lá.
function useMe(): Player | undefined {
  const players = playersView(
    useGameStore((s) => s.game),
    useRoomStore((s) => s.room),
    useRoomStore((s) => s.myUid),
  )
  // Sem sala (modo local e andaimes de teste) nenhum assento é `you` — ali o aparelho é de
  // quem está jogando a vez, e é esse caixa que o cockpit deve mostrar.
  return players.find((p) => p.you) ?? players.find((p) => p.active)
}

export function PortraitDock({
  tab,
  onTab,
}: {
  tab: DockTab
  onTab: (next: DockTab) => void
}) {
  const me = useMe()
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Setas percorrem as abas com rolagem circular — padrão de `tablist` horizontal. Sem
  // isso o teclado alcança as abas mas não navega entre elas na ordem que o leitor anuncia.
  function onKeyDown(event: React.KeyboardEvent): void {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (delta === 0) return
    event.preventDefault()
    const index = DOCK_TABS.findIndex((t) => t.id === tab)
    const next = DOCK_TABS[(index + delta + DOCK_TABS.length) % DOCK_TABS.length]
    onTab(next.id)
    tabRefs.current[next.id]?.focus()
  }

  return (
    <div className="portrait-dock">
      {me && <DockCockpit me={me} />}

      <div className="portrait-dock__tabs" role="tablist" aria-label="Painéis da partida" onKeyDown={onKeyDown}>
        {DOCK_TABS.map((item) => (
          <button
            key={item.id}
            ref={(el) => { tabRefs.current[item.id] = el }}
            type="button"
            role="tab"
            id={item.tabId}
            aria-selected={tab === item.id}
            aria-controls={item.panelId}
            tabIndex={tab === item.id ? 0 : -1}
            className={cn('portrait-dock__tab', tab === item.id && 'portrait-dock__tab--active')}
            onClick={() => onTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// O caixa mostrado é o LÍQUIDO (`net` = caixa − obrigação, D-061), não o bruto: durante
// uma dívida, o bruto mente sobre o que dá para gastar. Negativo nunca vai só na cor
// (§12.6) — vem com o rótulo "falta" e o valor que falta pagar.
function DockCockpit({ me }: { me: Player }) {
  const owing = me.owed > 0
  return (
    <div className={cn('portrait-dock__cockpit', me.active && 'portrait-dock__cockpit--active')}>
      <PlayerFace
        color={me.color}
        avatar={me.avatar}
        skin={me.skin}
        size={30}
        active={me.active}
        asleep={me.connected === false}
      />

      <div className="portrait-dock__identity">
        <p className="portrait-dock__name">{me.name}</p>
        <p className="portrait-dock__turn">{me.active ? 'Sua vez' : 'Aguardando'}</p>
      </div>

      <div className="portrait-dock__cash">
        <span className="portrait-dock__cash-label">{owing ? 'Líquido' : 'Caixa'}</span>
        <strong className={cn('portrait-dock__cash-value', me.net < 0 && 'portrait-dock__cash-value--debt')}>
          {money(me.net)}
        </strong>
        {owing && (
          <span className="portrait-dock__owed">falta {money(Math.max(0, me.owed - me.money))}</span>
        )}
      </div>
    </div>
  )
}
