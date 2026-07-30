# Tasks — 051 Landing page pública e indexável

## Fase A — Fundacão (arquitetura)

- [x] T001 Renomear a casca do app: criar `jogar.html` (conteúdo do `index.html` atual, canonical `/jogar`, title de app)
- [x] T002 `vite.config.ts`: `rollupOptions.input` (5 entradas), `build.manifest: true`, plugin `marketingRoutes()` (dev+preview: clean URLs + redirects de `/?param`), plugin `siteMeta()` (%SITE_URL%, GSC meta, robots.txt, sitemap.xml)
- [x] T003 `vercel.json`: redirects `has:query` (room/host/local/players), rewrites explícitos das rotas limpas, headers para os novos HTML, remover catch-all
- [x] T004 `src/net/session.ts`: `roomLink` → `/jogar?room=`; `src/app/FailureScreen.tsx`: navegações → `/jogar*`
- [x] T005 E2E: atualizar `goto` para `/jogar*` em 2players/3players/6players/a11y/avatarSkins/multiplayer/errorBoundary
- [x] T006 `tests/marketing/urlContracts.test.ts`

## Fase B — Design system de marketing

- [x] T007 `src/marketing/tokens.css` (subset com proveniência) + `src/marketing/marketing.css` (layout, componentes, motion, reduced-motion, responsivo)
- [x] T008 `PRODUCT.md` + `DESIGN.md` (Impeccable init/document)

## Fase C — Conteúdo

- [x] T009 `index.html` — landing completa (contrato de direção no comentário de abertura; hero, como funciona, mecânicas, produto real, temas, CTA final, footer; JSON-LD VideoGame; fallback inline de redirect)
- [x] T010 `como-jogar.html` — guia SRS com headings e links internos
- [x] T011 `faq.html` — FAQ + JSON-LD FAQPage espelhado
- [x] T012 `404.html`

## Fase D — Assets reais

- [x] T013 `scripts/capture-marketing-shots.ts` + captura (tabuleiro, lobby, negociação) + WebP + `public/og.png`
- [x] T014 Integrar imagens com dimensões explícitas + lazy abaixo da dobra

## Fase E — Validação

- [x] T015 Auditoria de bundle (manifest) + relatório de tamanhos
- [x] T016 `bun run lint` + `bun run typecheck` + `bunx vitest run` (suites tocadas) + `bun run build`
- [x] T017 axe nas páginas de marketing (a11y.spec) + detector Impeccable
- [x] T018 Passada visual 1 (composição/hierarquia/identidade) nas 6 resoluções
- [x] T019 Passada visual 2 (espaçamento/contraste/responsivo/motion) + polish
- [x] T020 Validar HTML gerado (curl das 4 rotas + robots + sitemap + redirects + entrada real no jogo)
- [x] T021 `docs/SEO.md`
