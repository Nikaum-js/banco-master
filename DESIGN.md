# DESIGN.md — Atlas da Meia-Noite

> Documento do sistema visual **incumbente** (Impeccable document). Fonte canônica dos tokens: `src/index.css` (`@theme`). As páginas de marketing consomem o subset copiado em `src/marketing/tokens.css` — mudou lá, muda aqui.

## Mundo

Carta náutica noturna: tinta azul-profunda, latão de instrumento, luzes de cidade. O produto é uma mesa de jogo premium vista à meia-noite — papel de carta, escritura, régua de graduação, rosa dos ventos. O tema alternativo do app ("Fliperama Neon") é pele do jogo, não da marca.

## Paleta (papéis, não cores soltas)

| Papel | Token | Valor |
|---|---|---|
| Fundo (escala tinta) | `--color-ink-900/-950/-abyss` | `#0d1424` / `#060b17` / `#04070f` |
| Superfície | `--color-ink-600/-700/-800` | `#202942` / `#182136` / `#121a2c` |
| Borda | `--color-ink-500` | `#2c3750` (exceção AA aceita p/ borda decorativa — SRS §12.6) |
| Conteúdo | `--color-starlight` / `-muted` | `#eef2fb` / `#93a1bd` |
| Destaque premium | `--color-brass` / `-soft` / `-glow` | `#d9a650` / `#b58430` / `#ffd98a` |
| Atenção/perigo | `--color-signal` / `-deep` / `-glow` | `#e2574b` / `#a3322a` / `#f0917f` |
| Luzes de cidade | `--color-group-*` | 10 cores de grupo (usar com parcimônia fora do jogo) |

Estratégia: **Restrained-committed** — tinta ocupa a página inteira; latão é o único acento estrutural; signal só para atenção real. Escuro não é estética de categoria: é a cena (jogo noturno entre amigos).

## Tipografia

- Display: **Bebas Neue** (`--font-display`), uppercase, `--tracking-display: 0.04em`, line-height ≤1.
- Corpo: **Inter Variable** (`--font-sans`).
- Números/moeda: **Roboto Slab Variable** (`--font-slab`), `tabular-nums`.
- Caption cerimonial: caps + `--tracking-caps: 0.28em`.

## Matéria

- Raios contidos: `--radius-sharp: 2px` a `--radius-modal: 12px` — nada de pill em superfície (só chips).
- Sombras **de tinta azul**, nunca cinza (`--shadow-card/-lift/-glow`).
- Ornamentos do mundo: marcas de registro nos cantos (ticks de latão), régua de graduação, filete de 1px, graticule de fundo (grade fina `rgb(238 242 251 / 0.05)`), vinheta + aurora de latão no horizonte.
- Wordmark: "Magnata" em starlight + "Imobiliário" em brass, Bebas condensada.

## Movimento

Tokens: `--motion-fast: 120ms`, `--motion-base: 200ms`, `--motion-slow: 420ms`; easings `--ease-standard`, `--ease-emphasis` (0.16,1,0.3,1). `prefers-reduced-motion` zera as durações — o fato permanece, a interpolação some. Um momento autoral por superfície; sem loops decorativos.

## Proibições (do mundo, verificadas contra ele)

- Gradiente roxo/azul genérico, blobs, glassmorphism decorativo, bento grid, cards dentro de cards, ícones-em-quadradinho repetidos, emoji como ícone.
- Gradient text fora dos números-prêmio do jogo (`--gradient-brass-shine` é do jogo; no marketing, ênfase por peso/escala).
- Verde de feltro fora da mesa de jogo (é material do miolo do tabuleiro, nunca terceiro acento).

## Acessibilidade

Contraste ≥4.5:1 texto, ≥3:1 foco/elemento (exceção documentada: borda decorativa ink-500). Focus ring latão 2px + offset. Alvo de toque ≥44px em ponteiro grosso.
