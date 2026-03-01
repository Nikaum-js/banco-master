// Alternador de TEMA — botão fixo no canto inferior esquerdo, logo acima do controle de
// áudio. Um clique alterna entre os dois mundos (Atlas ⇄ Fliperama), e o que muda não é só
// a cor: paleta, tipografia, fundo, cromo das casas, o miolo do tabuleiro e a própria tela
// de entrada.
//
// Mostra o glifo do tema ATUAL e diz no rótulo qual vem em seguida — botão que só mostra o
// estado presente deixa a pessoa clicando pra descobrir o que vem.
import { Compass, Gamepad2 } from 'lucide-react'
import { useBoardTheme, BOARD_THEMES, BOARD_THEME_LABEL, BOARD_THEME_HINT, type BoardTheme } from './boardTheme'

const GLYPH: Record<BoardTheme, typeof Compass> = {
  atlas: Compass,
  neon: Gamepad2,
}

export function ThemeControl() {
  const theme = useBoardTheme((s) => s.theme)
  const next = BOARD_THEMES[(BOARD_THEMES.indexOf(theme) + 1) % BOARD_THEMES.length]
  const Glyph = GLYPH[theme]

  return (
    <button
      type="button"
      title={`Tema ${BOARD_THEME_LABEL[theme]} (${BOARD_THEME_HINT[theme]}). Clique pra trocar pra ${BOARD_THEME_LABEL[next]}`}
      aria-label={`Trocar tema para ${BOARD_THEME_LABEL[next]}`}
      onClick={() => useBoardTheme.getState().cycle()}
      className="theme-control"
    >
      <Glyph size={18} aria-hidden="true" />
      {/* O nome só aparece no hover/foco em tela larga: em repouso é um ícone, e quem quiser
          saber onde está passa o mouse (ou tabula até ele). O <span> interno não é enfeite:
          o item do grid precisa ser ELEMENTO pra `min-width: 0` valer — com o texto solto, a
          coluna de 0fr ainda reservava a largura do nome e o botão nascia como uma placa
          larga e vazia (medido em print). */}
      <span className="theme-control__name">
        <span>{BOARD_THEME_LABEL[theme]}</span>
      </span>
    </button>
  )
}
