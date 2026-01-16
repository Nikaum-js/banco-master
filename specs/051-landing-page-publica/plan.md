# Plan — 051 Landing page pública e indexável

**Stack**: a mesma do repo — Vite 8 (rolldown) + TypeScript + Tailwind v4 (o jogo) — com as páginas de marketing em **HTML autoral + CSS próprio** (sem Tailwind e sem React nesses entrypoints, para JS ~zero).

## D1 — Arquitetura de páginas: Vite MPA

Cinco entrypoints HTML na raiz, todos no `build.rollupOptions.input`:

| Arquivo | Rota | Conteúdo |
|---|---|---|
| `index.html` | `/` | Landing (HTML completo autoral = prerender por construção) |
| `como-jogar.html` | `/como-jogar` | Guia baseado no SRS |
| `faq.html` | `/faq` | FAQ + JSON-LD `FAQPage` |
| `jogar.html` | `/jogar` | A casca atual do app (`#root` + `/src/main.tsx`) |
| `404.html` | qualquer rota desconhecida | 404 real (convenção Vercel para deploy estático) |

Por que não prerender/SSG plugin: o conteúdo de marketing é editorial e estático; HTML autoral entrega o mesmo resultado com zero dependência nova e bundle mínimo. React continua exclusivo do jogo.

## D2 — Separação de bundles

- Marketing referencia `src/marketing/marketing.css` via `<link>` (o Vite processa, hasheia e resolve os `@import` de fontes do fontsource). Nenhum `<script type="module">` nos entrypoints de marketing — o único JS é o fallback de redirect, inline e não-módulo (passa intacto pelo build).
- `src/marketing/tokens.css` copia o **subset** de tokens do `@theme` de `src/index.css` (ink/starlight/brass/signal, fontes, raios, sombras, motion, tracking) com comentário de proveniência. `src/index.css` não é tocado (tem mudanças não relacionadas em andamento no worktree).
- Fontes: Bebas Neue + Inter Variable + Roboto Slab Variable (os mesmos pacotes fontsource já instalados). Press Start 2P não entra (só existe no tema Neon do jogo).
- Prova: script de auditoria pós-build lê `dist/.vite/manifest.json` (ligar `build.manifest`) e falha se os chunks alcançáveis pelos entrypoints de marketing incluírem `supabase`, `src/game/`, `src/net/`, `zustand` ou `motion`.

## D3 — Compatibilidade de URL

1. **Borda (produção)** — `vercel.json.redirects`, um por param (`room`, `host`, `local`, `players`), `source: "/"` + `has: [{type:"query", key:<param>}]` → `destination: "/jogar"`, `permanent: false`. A Vercel preserva a query em redirects sem query própria no destino.
2. **Rewrites** — o catch-all atual (`/((?!assets/).*)` → `index.html`) morre; entram rewrites explícitos `/jogar|/como-jogar|/faq` → `.html`. Rota desconhecida cai no `404.html` com status 404 (comportamento estático da Vercel).
3. **Dev/preview** — plugin no `vite.config.ts` (`configureServer` + `configurePreviewServer`): redirect 307 de `/?{room,host,local,players,multi,sons,ui-lab,e2eCrashCasca,scenario}` → `/jogar` e rewrite das rotas limpas para os `.html`.
4. **Fallback inline** — script não-módulo de ~5 linhas no `<head>` da landing: se `location.search` tiver param de jogo, `location.replace('/jogar' + search + hash)`. Cobre host estático qualquer.
5. **App** — `roomLink()` → `/jogar?room=`; `FailureScreen` → `/jogar*`; E2E goto `/jogar*`.

## D4 — SEO

- Plugin `siteMeta()` no vite.config: substitui `%SITE_URL%` nos HTML (valor de `VITE_SITE_URL` ?? `https://magnata-imobiliario.vercel.app`), injeta `<meta name="google-site-verification">` quando `VITE_GSC_VERIFICATION` existir, e emite `robots.txt` + `sitemap.xml` no build com o mesmo `SITE_URL`.
- JSON-LD: `VideoGame` (nome, descrição, `playMode: MultiPlayer`, `numberOfPlayers` 2–8, `applicationCategory` browser, pt-BR) na landing; `FAQPage` espelhando o `/faq`.
- Documentação: `docs/SEO.md` curto — variáveis, passo manual do Search Console, como regenerar a imagem social.

## D5 — Direção visual (Impeccable)

Mundo estabelecido ("Atlas da Meia-Noite") — pedido precisamente especificado ⇒ shape direto, sem sorteio de conceito. Contrato de direção (THESIS/OWN-WORLD/STORY/FIRST VIEWPORT/FORM) vai no comentário de abertura do `index.html`. `PRODUCT.md` + `DESIGN.md` registrados na raiz (init/document). Fluxo: document → extract (tokens.css) → shape → craft → critique → audit (detector mecânico + axe) → polish.

## D6 — Screenshots

`scripts/capture-marketing-shots.ts` (Playwright API, dev server local, credenciais Supabase reais do `.env` p/ lobby via `?multi`): lobby com 3–4 assentos fictícios, tabuleiro em partida local (`/jogar?players=4` + algumas rodadas dirigidas), modal de negociação. Saída em `src/marketing/assets/*.png` → convertidas a WebP (relatório de peso no fim). OG image 1200×630 em `public/og.png`.

## D7 — Testes

- `tests/marketing/urlContracts.test.ts`: formato novo de `roomLink`, `extractRoomId` com link `/jogar?room=`, e o shape dos redirects/rewrites do `vercel.json`.
- `e2e/a11y.spec.ts` ganha auditoria axe das três páginas de marketing (projeto `built`).
- E2E existentes atualizados para `/jogar` (mesma cobertura de sempre).
