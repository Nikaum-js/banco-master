// Painel "Minhas Cartas" (029, §12.4) — a mão do jogador da vez, com botão "Usar"
// gated por timing. Privacidade (VI): só o jogador ativo; demais veem só o contador
// (PlayersPanel). Sem alvo → joga direto; com alvo → abre o HandCardLayer.
import { useGameStore } from '@/game/store'
import { handCardsView } from './handView'
import { useHandCardUI } from './HandCardLayer'

export function HandPanel() {
  const game = useGameStore((s) => s.game)
  const playHandCard = useGameStore((s) => s.playHandCard)
  const activeId = game.players[game.turnOrder[game.activeSeat]]?.id
  const cards = activeId ? handCardsView(game, activeId) : []

  const onUse = (id: string, needsTarget: boolean) => {
    if (needsTarget) useHandCardUI.getState().open(id)
    else playHandCard(id)
  }

  return (
    <div className="side-panel-section">
      <div className="flex items-baseline justify-between mb-3">
        <p className="label text-gold">Minhas Cartas</p>
        <span className="label text-cream-muted tabular-nums px-2 py-0.5 rounded-full bg-coffee-900 border border-coffee-500">
          {cards.length}/3
        </span>
      </div>

      {cards.length === 0 ? (
        <div className="flex items-center justify-center px-3 py-5 rounded-[var(--radius-card)] border border-dashed border-coffee-500 bg-coffee-800/40">
          <p className="label text-cream-muted text-center leading-snug">Nenhuma carta na mão</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {cards.map((c) => (
            <li
              key={c.id}
              className="rounded-[var(--radius-card)] border border-coffee-500 bg-coffee-800 overflow-hidden transition-all hover:border-[rgba(212,175,55,0.6)] hover:shadow-[var(--shadow-dropdown)]"
            >
              {/* faixa de raridade no topo */}
              <div className="h-1" style={{ background: c.rarityColor }} aria-hidden />
              <div
                className="px-3 py-2.5"
                style={{ background: `linear-gradient(180deg, ${c.rarityColor}1f 0%, transparent 58%)` }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: c.rarityColor, boxShadow: `0 0 6px ${c.rarityColor}` }}
                    aria-hidden
                  />
                  <span className="display text-cream text-sm leading-none flex-1 min-w-0 truncate">{c.label}</span>
                </div>
                <p className="text-cream-muted text-xs leading-snug mt-1.5">{c.desc}</p>
                <div className="flex items-center gap-2 mt-2.5">
                  {!c.playable && c.reason && (
                    <span className="text-cream-muted text-[10px] leading-snug flex-1 min-w-0">{c.reason}</span>
                  )}
                  <button
                    type="button"
                    disabled={!c.playable}
                    title={c.reason}
                    onClick={() => onUse(c.id, c.needsTarget)}
                    className="ml-auto shrink-0 px-4 py-1.5 rounded-[var(--radius-sharp)] bg-gold text-coffee-900 font-bold text-xs hover:brightness-110 active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Usar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
