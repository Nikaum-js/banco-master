// Skins do avatar (visual do personagem) — camadas SVG desenhadas no MESMO viewBox 32×32
// do `PlayerFace`, pra que o token do tabuleiro e o preview do lobby sejam literalmente a
// mesma arte. Cada skin devolve fragmentos por camada; o `PlayerFace` empilha na ordem:
//
//   sombra → behind → head → brilho → mid → olhos → boca → front → anel do jogador da vez
//
// Duas regras de desenho, pra skin nenhuma quebrar a leitura da mesa:
//  1. A COR DO JOGADOR continua sendo a identidade — adorno tinge, nunca esconde a cabeça.
//     Por isso o robô pinta o corpo com `color` e usa `darker` nos detalhes, em vez de
//     cor própria; chapéus levam a cor na fita.
//  2. Tudo precisa ler a 16px (avatar do log) e a 72px (HUD do jogador da vez): silhueta
//     antes de detalhe.
import type { ReactNode } from 'react'

const INK = 'var(--color-ink-950)'

/** Escurece a cor do jogador mantendo o matiz — detalhes que continuam "dele". */
const darker = (c: string, p = 62) => `color-mix(in srgb, ${c} ${p}%, #100c08)`

export type SkinId =
  | 'careca'
  | 'cavanhaque'
  | 'topete'
  | 'cartola'
  | 'safari'
  | 'aviador'
  | 'robo'
  | 'astronauta'

export const SKINS: { id: SkinId; label: string }[] = [
  { id: 'careca', label: 'Careca' },
  { id: 'cavanhaque', label: 'Cavanhaque' },
  { id: 'topete', label: 'Topete' },
  { id: 'cartola', label: 'Cartola' },
  { id: 'safari', label: 'Safári' },
  { id: 'aviador', label: 'Aviador' },
  { id: 'robo', label: 'Robô' },
  { id: 'astronauta', label: 'Astronauta' },
]

/** Tom dos pelos — o mesmo do cabelo, pra barba e topete lerem como o mesmo material. */
const HAIR = '#33241a'

export type SkinParts = {
  /** Atrás da cabeça — orelhas, crista, antena. */
  behind?: ReactNode
  /** Substitui o círculo padrão da cabeça (formato próprio). */
  head?: ReactNode
  /** Entre a cabeça e os olhos — focinho, máscara facial. */
  mid?: ReactNode
  /** Substitui os olhos (perde a piscada — só use quando o olho não for olho). */
  eyes?: ReactNode
  /** Substitui a boca. */
  mouth?: ReactNode
  /** Sobre tudo — chapéu, cabelo, visor, capacete. */
  front?: ReactNode
  /** Desliga o brilho 3D padrão (quando a skin traz o seu). */
  noHighlight?: boolean
}

/** Camadas da skin já resolvidas na cor do jogador. `careca` devolve o objeto vazio. */
export function skinParts(id: SkinId | undefined, color: string): SkinParts {
  switch (id) {
    // -----------------------------------------------------------------
    // Cavanhaque — bigode + pera fechando em volta da boca, bochecha limpa.
    // -----------------------------------------------------------------
    case 'cavanhaque':
      return {
        mid: (
          <>
            <path
              d="M11.8 19.9 Q10.8 25.8 16 26.7 Q21.2 25.8 20.2 19.9 Q18 23.2 16 23.2 Q14 23.2 11.8 19.9 Z"
              fill={HAIR}
              stroke={INK}
              strokeWidth="0.9"
              strokeLinejoin="round"
            />
            <path
              d="M10.6 18.6 Q13.4 16.6 16 18.2 Q18.6 16.6 21.4 18.6 Q18.4 20.3 16 19.2 Q13.6 20.3 10.6 18.6 Z"
              fill={HAIR}
              stroke={INK}
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
          </>
        ),
        mouth: <path d="M12.4 20.8 Q16 23.6 19.6 20.8" stroke="#f2e3cf" strokeWidth="1.5" fill="none" strokeLinecap="round" />,
      }

    // -----------------------------------------------------------------
    // Topete — cabelo penteado com risca lateral e uma mecha pra cima.
    // -----------------------------------------------------------------
    case 'topete':
      return {
        front: (
          <>
            <path
              d="M3.3 12.2 A13 13 0 0 1 27 8.1 Q23.2 5.6 17.4 7 Q11.2 8.6 8 12.8 Q5.6 14.2 3.3 12.2 Z"
              fill="#33241a"
              stroke={INK}
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <path
              d="M20.5 3.4 Q28.6 1.8 29 9.8 Q26.2 4.8 19.4 5.9 Z"
              fill="#33241a"
              stroke={INK}
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <path
              d="M9.2 9.2 Q12.8 5.8 17.6 5.6"
              stroke="rgba(255,255,255,0.42)"
              strokeWidth="1.3"
              fill="none"
              strokeLinecap="round"
            />
          </>
        ),
      }

    // -----------------------------------------------------------------
    // Cartola — o banqueiro: cartola com fita na cor do jogador, bigode e monóculo.
    // -----------------------------------------------------------------
    case 'cartola':
      return {
        noHighlight: true,
        front: (
          <>
            <path
              d="M10.8 7 L10.2 0.6 Q16 -0.6 21.8 0.6 L21.2 7 Z"
              fill="#17120f"
              stroke={INK}
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <path d="M10.9 4.2 L21.1 4.2 L21.2 6.4 L10.8 6.4 Z" fill={color} />
            <ellipse cx="16" cy="7" rx="12.8" ry="2.4" fill="#17120f" stroke={INK} strokeWidth="1" />
            <path d="M11.6 1.4 Q11.2 2.8 11.1 3.8" stroke="rgba(255,255,255,0.25)" strokeWidth="1.1" fill="none" strokeLinecap="round" />
            <path
              d="M16 19.6 Q13.6 17.4 11.2 18.6 Q12.6 20.8 16 19.6 Z M16 19.6 Q18.4 17.4 20.8 18.6 Q19.4 20.8 16 19.6 Z"
              fill="#33241a"
              stroke={INK}
              strokeWidth="0.5"
              strokeLinejoin="round"
            />
            {/* Aro escuro por baixo do latão: sem ele o monóculo some na cabeça dourada. */}
            <circle cx="21" cy="14.5" r="4.6" fill="rgba(255,255,255,0.12)" stroke={INK} strokeWidth="2.6" />
            <circle cx="21" cy="14.5" r="4.6" fill="none" stroke="var(--color-brass)" strokeWidth="1.2" />
            <path d="M25 17.4 Q27.2 20.8 25.2 23.6" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M25 17.4 Q27.2 20.8 25.2 23.6" stroke="var(--color-brass)" strokeWidth="0.9" fill="none" strokeLinecap="round" />
          </>
        ),
      }

    // -----------------------------------------------------------------
    // Safári — capacete de explorador com fita na cor do jogador e broche de latão.
    // -----------------------------------------------------------------
    case 'safari':
      return {
        noHighlight: true,
        front: (
          <>
            <path d="M6 10 A10.2 9.4 0 0 1 26 10 Z" fill="#c9b58a" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M6.2 8 Q16 5 25.8 8 L25.9 10 Q16 7 6.1 10 Z" fill={color} />
            <ellipse cx="16" cy="10.2" rx="13.4" ry="2.2" fill="#b8a478" stroke={INK} strokeWidth="1" />
            <path d="M10.2 4 Q13.6 1.9 17.8 2.6" stroke="rgba(255,255,255,0.4)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
            <circle cx="22.6" cy="6.6" r="1.2" fill="var(--color-brass)" stroke={INK} strokeWidth="0.6" />
          </>
        ),
      }

    // -----------------------------------------------------------------
    // Aviador — touca de couro com tapa-orelhas e goggles erguidos na testa.
    // -----------------------------------------------------------------
    case 'aviador':
      return {
        noHighlight: true,
        front: (
          <>
            <path d="M4.4 12.2 Q2.6 18.4 6.4 21 Q8.8 17.4 7.6 12 Z" fill="#4a3323" stroke={INK} strokeWidth="0.9" strokeLinejoin="round" />
            <path d="M27.6 12.2 Q29.4 18.4 25.6 21 Q23.2 17.4 24.4 12 Z" fill="#4a3323" stroke={INK} strokeWidth="0.9" strokeLinejoin="round" />
            <path
              d="M3.05 14.4 A13 13 0 0 1 28.95 14.4 Q29.2 11 27.4 9.4 Q16 6 4.6 9.4 Q2.8 11 3.05 14.4 Z"
              fill="#5c4029"
              stroke={INK}
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <path d="M4.4 9.8 Q16 5.6 27.6 9.8" stroke="#2e2016" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <circle cx="10.2" cy="8.2" r="3.7" fill="#7cc3e2" stroke="#2e2016" strokeWidth="1.4" />
            <circle cx="21.8" cy="8.2" r="3.7" fill="#7cc3e2" stroke="#2e2016" strokeWidth="1.4" />
            <path d="M8.6 7 Q9.6 5.9 11 6.2" stroke="#ffffff" strokeWidth="1" fill="none" opacity="0.8" strokeLinecap="round" />
            <path d="M20.2 7 Q21.2 5.9 22.6 6.2" stroke="#ffffff" strokeWidth="1" fill="none" opacity="0.8" strokeLinecap="round" />
          </>
        ),
      }

    // -----------------------------------------------------------------
    // Robô — cabeça chapada, visor com LEDs e antena piscando.
    // -----------------------------------------------------------------
    case 'robo':
      return {
        noHighlight: true,
        behind: (
          <>
            <path d="M16 5 V1.8" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="16" cy="1.6" r="1.9" fill="#ff5f8d" stroke={INK} strokeWidth="0.8">
              <animate attributeName="opacity" values="1;0.35;1" dur="1.9s" repeatCount="indefinite" />
            </circle>
          </>
        ),
        head: (
          <>
            <rect x="4.2" y="4.2" width="23.6" height="21.4" rx="4.8" fill={color} stroke={INK} strokeWidth="1.5" />
            <path d="M4.6 20.2 H27.4" stroke={darker(color, 70)} strokeWidth="0.8" opacity="0.55" />
            <rect x="7.4" y="6.6" width="8.6" height="2.4" rx="1.2" fill="rgba(255,255,255,0.26)" />
          </>
        ),
        eyes: (
          <>
            <rect x="7.2" y="10.6" width="17.6" height="7" rx="3.5" fill="#080d13" stroke={INK} strokeWidth="1.1" />
            <circle cx="11.6" cy="14.1" r="2" fill="#7ef0ff" />
            <circle cx="20.4" cy="14.1" r="2" fill="#7ef0ff" />
            <circle cx="11.6" cy="14.1" r="0.7" fill="#ffffff" />
            <circle cx="20.4" cy="14.1" r="0.7" fill="#ffffff" />
          </>
        ),
        mouth: (
          <>
            <rect x="10.8" y="20" width="10.4" height="3.8" rx="1.4" fill="#080d13" stroke={INK} strokeWidth="0.7" />
            <path d="M13.4 20.8 V23 M16 20.8 V23 M18.6 20.8 V23" stroke="#5d6b78" strokeWidth="0.9" strokeLinecap="round" />
          </>
        ),
        front: (
          <>
            <circle cx="3.2" cy="16.4" r="2.2" fill={darker(color, 72)} stroke={INK} strokeWidth="1" />
            <circle cx="28.8" cy="16.4" r="2.2" fill={darker(color, 72)} stroke={INK} strokeWidth="1" />
          </>
        ),
      }

    // -----------------------------------------------------------------
    // Astronauta — capacete de vidro sobre a carinha, gola de latão e estrelas refletidas.
    // -----------------------------------------------------------------
    case 'astronauta':
      return {
        front: (
          <>
            <circle cx="16" cy="14.6" r="14.4" fill="rgba(150,205,255,0.14)" stroke="rgba(226,240,255,0.6)" strokeWidth="1.1" />
            <path d="M6.2 10 Q8.4 4.8 13.6 3" stroke="rgba(255,255,255,0.62)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <path d="M4.9 13.8 Q5.6 11.2 6.8 9.4" stroke="rgba(255,255,255,0.42)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            <path d="M23.4 5.6 l0.7 1.7 1.7 0.7 -1.7 0.7 -0.7 1.7 -0.7 -1.7 -1.7 -0.7 1.7 -0.7 Z" fill="#ffffff" opacity="0.85" />
            <path d="M26.4 11.4 l0.45 1.1 1.1 0.45 -1.1 0.45 -0.45 1.1 -0.45 -1.1 -1.1 -0.45 1.1 -0.45 Z" fill="#ffffff" opacity="0.6" />
            <path d="M5.2 24.2 Q16 29.8 26.8 24.2" stroke="var(--color-brass)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          </>
        ),
      }

    default:
      return {}
  }
}
