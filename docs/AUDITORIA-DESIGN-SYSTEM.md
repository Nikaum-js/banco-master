# Auditoria de Design System — UI do jogo

> Varredura completa da UI (2026-07-24) contra os tokens de `src/index.css` (`@theme`)
> e os primitivos de `src/game/ui/primitives.tsx`. **Presentation only** — nenhum achado
> toca lógica de jogo. Serve de backlog de padronização e de briefing pro auditor seguinte.

## Padrão canônico (a régua)

- **Tokens** (`src/index.css` `@theme` + tema claro/escuro por `data-board-theme`):
  cores `ink-*`/`coffee-*`, semânticas `brass` (dourado), `signal`/`signal-deep` (perigo/multa),
  `starlight`/`starlight-muted` (texto); fontes `--font-display|sans|slab`; raios
  `--radius-sharp|card|chip|modal|pill`; sombras `--shadow-card|lift|dropdown|glow|press`;
  easing `--ease-paper|snap|press`; tracking `--tracking-display|mono`; classe `.label` (caption dourado 10px).
- **Aliases legados** (`gold`/`coffee`/`cream`/`logo`) compilam pros tokens novos e os próprios
  primitivos os usam — **não são bug**. O bug é o **hex cru** que fura o alias.
- **Primitivos** (`primitives.tsx`): `SectionHeader`, `Chip({tone})`, `EmptyState`. Helper `cn()`.

---

## Os 9 padrões transversais (ordenados por impacto)

### 1. Hex crus do tema Café quebram a troca de skin — **o mais grave, ~45 pontos**
Valores como `#d4af37`/`#b8941f`/`#f4e8d0` e `rgba(217,166,80,…)`/`rgba(255,217,138,…)` estão
cravados em JS e arbitrary-values. Eles são a paleta de **um** tema; sob o outro renderizam a cor
errada e não trocam com `data-board-theme`. Correção canônica: `var(--color-brass*)` ou
`color-mix(in srgb, var(--color-brass) N%, transparent)` para os alphas.

### 2. Vermelho/alerta ad-hoc ignora `signal` — **tom semântico quebrado**
`#e74c3c` (leilão), `#c0392b/#922b21` (takeover), o bloco `COPPER_TEXT` do HUD, `#cf4b3e`, `#ef6a58`.
Tudo que é multa/dívida/perigo → `var(--color-signal)` / `--color-signal-deep`.

### 3. `fontSize` inline solto — **~60 ocorrências**
`style={{ fontSize: '8px'|'9px'|'10px'|'11px' }}` e `text-[11px]/[13px]/[17px]` sobrescrevendo
o `.label`. Adotar `.label` onde é 10px e criar **um** token de micro-tamanho (`--font-size-micro`)
para 8/9px, em vez de px inline repetido.

### 4. Botão reimplementado 5+ vezes sem primitivo comum
`Btn` (Trade), "Usar" (HandPanel), "Cancelar" (HandCard), `ActionBtn`+lance (Modal),
`PrimaryBtn/GhostBtn/DangerBtn` (HUD), `TurnActionBtn/DeedBtn/Quitar/Nova negociação` (shared).
Divergem em padding, hover (`brightness-110` vs `--shadow-glow`) e cor do texto sobre dourado
(`text-coffee-900` vs `-950`). → extrair **`<Button variant>`** único (primary/secondary/ghost/danger)
e migrar todos os call sites.

### 5. Dois shells de modal divergentes + overlays inconsistentes
`--radius-card` (4px, ModalLayer) vs `--radius-modal` (12px, GameHUD `CardFrame`). Backdrops com
opacidade/blur diferentes: `/45 blur-[1px]`, `/55`, `/65 blur-[2px]`, `/70 blur-[2px]`. → **um**
shell `<Modal>` + **um** overlay tokenizado.

### 6. Gradiente dourado do header duplicado (e divergente)
`linear-gradient(180deg,#d4af37,#b8941f)` copiado em Trade L83, HandCard L75, Modal (×6), AuctionCard.
No HUD há **dois** gradientes diferentes (`#d4af37→#9a7d28` no ReactionHead vs `→#b8941f` no Header).
→ **um** `<Header>`/token de gradiente brass compartilhado.

### 7. Sombras pretas hardcoded em vez dos tokens (que têm tinta azul)
`shadow-[0_2px_4px_rgba(0,0,0,0.5)]` etc. → `var(--shadow-card|lift|press|dropdown)`.

### 8. Primitivos não usados onde caberiam
- Chip "Efeito" à mão — `GameHUD.tsx:232` → `<Chip tone="gold">`
- Chip "Hipotecada" à mão — `shared.tsx:3189` → `<Chip tone="alert">`
- `CenterLog` header+vazio à mão — `shared.tsx:2410` → `SectionHeader` + `EmptyState`
- Estados-vazios à mão — `TradeLayer.tsx:251,415` → `EmptyState`

### 9. Tracking avulso
`tracking-wide/[0.2em]/[0.3em]/[0.4em]` → `--tracking-display|mono`.

---

## Achados por arquivo

### `src/game/ui/landAuction/LandAuctionLayer.tsx`
- L77 fallback accent `'#d4af37'` → `var(--color-brass)`
- L129/L130/L133 urgência `text-[#e74c3c]`/`bg-[#e74c3c]` → `text-signal`/`bg-signal` (ícone, número e barra)
- L212 título `bg-[linear-gradient(...#d4af37...#b8941f)]` → gradiente brass tokenizado
- L235-237 animação `#fff1c2`→`#d4af37` → `--color-brass-glow`→`--color-brass`
- L28 `shadow-[0_2px_4px_rgba(0,0,0,0.5)]` → `var(--shadow-card)`
- L231 `shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]` → `var(--shadow-press)`
- L209 `rounded-[var(--radius-card)]` → `--radius-modal`
- L213 `tracking-wide` sobrescreve `--tracking-display` → remover
- L67/L152 `fontSize` inline 8/10px → escala

### `src/game/ui/NoticeLayer.tsx`
- L11 `CONFETTI_COLORS` 6 hexes crus → `var(--color-group-*)`/`--color-brass`/`--color-signal`/`--color-starlight`
- L76-77 título `fontSize:'36px'` + `textShadow` hardcoded → escala + token
- L84-91 valor `fontSize:'68px'` + gradiente/`drop-shadow` de brass cravado → `--color-brass*`
- L118 header takeover `#c0392b→#922b21` → `--color-signal`/`--color-signal-deep`
- L116 `--radius-card` → `--radius-modal`; L35 `rounded-[1px]` → `--radius-sharp`

### `src/game/ui/GameHUD.tsx`
- L120/L286 `CardFrame` (radius-modal, border-1.5) vs shell do ModalLayer → unificar
- L99/L169 overlays `/45 blur-1` e `/65 blur-2` → overlay único
- L25-31 `GOLD_TEXT`, L184/L60/L202/L132/L483 gradientes/sombras dourados cravados → `--color-brass*` + `--shadow-glow`
- L226/L254/L515 `CardFrame accent="#d4af37"` → `var(--color-brass)`
- L476 `ReactionHead` gradiente `#d4af37→#9a7d28` divergente → header/token único
- L35-41 `COPPER_TEXT` + L83/L286-361/L373/L401 paleta cobre de dívida → `signal`/`signal-deep`
- L232 chip "Efeito" à mão → `<Chip tone="gold">`
- L60/71/83/389/537/202 cinco botões à mão → `<Button variant>`
- L186/L292 `tracking-[0.4em]/[0.3em]` → token; `fontSize` inline 64/46/40/30/9px → escala/`currency`

### `src/game/ui/modals/ModalLayer.tsx`
- L53/353/164/474 shells em `--radius-card` → `--radius-modal`
- L109/127 backdrop `/70 blur-2` → overlay único
- L66/135/146/201/221/355 header `#d4af37→#b8941f` → gradiente brass; L477/L434 AuctionCard reusar `<Header>`
- L165 `boxShadow` dropdown à mão → `var(--shadow-dropdown)`; L434 DeedIcon → `var(--shadow-card)`
- L271/314/439/465/531 accent `'#d4af37'` → `var(--color-brass)`; L304 `rgba(212,175,55,.5)` → brass
- L363 cancelar / L512-523 lance → reusar `ActionBtn`; L519-520 vs L35 `coffee-950` vs `900` → padronizar
- L72-438 `fontSize` inline 8/9/11px; L172/478/186 tracking avulso; L536 `text-[13px]` → escala

### `src/game/ui/trade/TradeLayer.tsx`
- L28/L129 fallback `'#d4af37'` → `var(--color-brass)`; L43 `stroke="#1a1410"` → `currentColor`
- L83 gradiente dourado cravado (dup HandCard L75) → tokenizar e compartilhar
- L92-106 `Btn` 3ª impl de botão → `<Button>`; L99 `transition-all` default → `--ease-*`
- L115 `shadow-[0_1px_2px_rgba(0,0,0,.5)]` → `var(--shadow-card)`; L138 `rounded-l-[1px]` → `--radius-sharp`
- L251/L415 estado-vazio `italic` à mão → `EmptyState`; L348/L383 `'#a89683'` → `--color-starlight-muted`
- L86…L354 ~14 `fontSize` inline → `.label` + micro-token

### `src/game/ui/cards/HandCardLayer.tsx` + `HandPanel.tsx` + `cardMeta.ts`
- HandCard L75 gradiente cravado (dup); L38-47/L98-104 botões à mão → `<Button>`; L77 `fontSize:'9px'`
- HandPanel L49 `rounded-[2px]` → `--radius-sharp`; L88-93 `<article>` reimplementa `.property-card` (sem `--ease-paper`) → aplicar a classe; L103 `text-[15px]`, L106/L130 `fontSize`/`text-[11px]` → escala; L114-118 botão "Usar" divergente → `<Button>`
- cardMeta L7-11 `RARITY_COLOR` hex (`#fb923c/#3b82f6/#22c55e` do tema Café) → `var(--color-group-*)` ou tokens `--color-rarity-*`

### `src/boards/shared.tsx` (miolo, popovers, SVGs)
- **Latão hardcoded (~20×):** L428, 590, 1285, 1429, 1814-1816, 1834, 1922, 2365, 2448, 2471-2474, 2700, 2765, 2775, 2808 (+ `Board01Classic.tsx:54`) → `color-mix(var(--color-brass[-glow]) …)` ou `--shadow-glow/card/lift`
- **Status como hex:** L2386 ganho/perda/neutro → `group-green`/`signal`/`brass`; L2405/2407 Banco `#cf4b3e` → `signal`; L1444 `text-green-400` → `text-group-green`; L1926/1929 fallback `'#888'` → `--color-ink-400`
- **Duplicação por tema:** L594-597 e L1189-1190 ramos `cafe` com hex → um bloco `var(--color-*)` + `--radius-sharp`
- **Botões:** L1502 `TurnActionBtn` (canônico, `coffee-950`) vs L1731/L3015 (`coffee-900`, hover diferente) + L1899 ghost bespoke → `<Button variant>`
- **Primitivos:** L2410 `CenterLog` → `SectionHeader`+`EmptyState`; L3189 "Hipotecada" → `<Chip tone="alert">`; sub-labels `label text-gold` repetidos ~8× (3058/3162/3268/3357)
- **Tipografia:** ~30 tamanhos soltos (`fontSize` inline, `text-[11px/13px/17px]`, `text-[0.7em]`)
- **Sombras pretas cruas** ~10× (600/637/1064/1158/1177/1222/1259/1446/1856/2367) → tokens; L3118/3343 `#000` em `color-mix` → `--color-ink-950`
- **SVG decorativo (baixa sev.):** quepe `#34549c`, olhos `#fff`, mancha `#8c5a2b`; `PLAYER_COLORS`/`MOCK_PLAYERS` = paleta de assento (legítima, mas assentos colidem com brass/starlight)

### `src/game/ui/theme/ThemeControl.tsx`
- L17 `shadow-md` (Tailwind default) → `var(--shadow-lift)`

### Limpos (seletores puros, sem apresentação)
`busTicketUI.ts`, `trade/tradesView.ts`, `modals/activeModal.ts`, `deed/deedView.ts`, `cards/handView.ts`.

---

## Ordem de execução sugerida

1. **Tokenizar cor** (padrões 1, 2, 6): eliminar todo hex/rgba de brass e vermelho → `var(--color-brass*)`/`--color-signal*`/`color-mix`. Maior impacto, destrava a troca de tema.
2. **Extrair `<Button variant>`** (padrão 4) e migrar os ~10 call sites.
3. **Unificar shell de modal + overlay** (padrão 5) e o `<Header>` dourado (padrão 6).
4. **Sombras → tokens** (padrão 7) e **tracking → tokens** (padrão 9).
5. **Adotar primitivos** onde faltam (padrão 8).
6. **Token de micro-tipografia** e varrer os ~60 `fontSize` inline (padrão 3).

Cada item = commit pequeno e atômico por padrão/superfície. Ao final: `bun run build` + lint.
