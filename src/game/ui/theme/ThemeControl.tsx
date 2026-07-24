// Alternador de tema do tabuleiro — botão fixo logo ACIMA do controle de
// áudio (AudioControl, bottom-3). Mostra o glifo do tema atual; clicar
// alterna Atlas da Meia-Noite ⇄ Café Coado.
import { Compass, Coffee } from 'lucide-react'
import { useBoardTheme, BOARD_THEME_LABEL } from './boardTheme'

export function ThemeControl() {
  const theme = useBoardTheme((s) => s.theme)
  const next = theme === 'atlas' ? 'cafe' : 'atlas'

  return (
    <button
      type="button"
      title={`Tema ${BOARD_THEME_LABEL[theme]}. Clique pra trocar pra ${BOARD_THEME_LABEL[next]}`}
      aria-label={`Trocar tema do tabuleiro para ${BOARD_THEME_LABEL[next]}`}
      onClick={() => useBoardTheme.getState().toggle()}
      className="fixed bottom-14 left-3 z-[80] grid h-9 w-9 place-items-center rounded-full bg-coffee-950/70 text-cream shadow-md backdrop-blur transition hover:bg-coffee-950/90 hover:text-gold"
    >
      {theme === 'atlas' ? <Compass size={18} /> : <Coffee size={18} />}
    </button>
  )
}
