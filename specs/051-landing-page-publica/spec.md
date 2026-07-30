# Feature Specification: Landing page pública e indexável

**Feature Branch**: `051-landing-page-publica`

**Created**: 2026-07-29

**Status**: Aprovada (autorização explícita do brief; implement liberado)

**Input**: User description: "Landing page pública e indexável do Magnata Imobiliário, integrada ao projeto atual, preservando o jogo, o lobby, o design system e os links de convite existentes. Rotas: `/` (landing prerenderizada), `/como-jogar`, `/faq`, `/jogar` (aplicação atual). Bundles separados entre marketing e jogo. SEO técnico completo. Sem commit/push/deploy."

> Conformidade com a constitution: esta spec não toca regra de jogo (Princípio I — nenhum bump de SRS ou ADR é necessário: landing é superfície de apresentação, não comportamento de produto). Todo conteúdo publicado deve ser **comprovável pelo SRS ou pelo código** — afirmação não comprovada é omitida.

## Clarifications

Resolvidas pelo brief + código existente (sem rodada interativa):

| Ambiguidade | Resolução | Fonte |
|---|---|---|
| Framework | Continuar React + Vite + TS + Tailwind; **Vite multi-page build** (HTML autoral = prerender por construção), sem SSG adicional | brief §3 |
| Domínio canônico | `https://magnata-imobiliario.vercel.app` como default do `SITE_URL` (já é o canonical do `index.html` atual), configurável por `VITE_SITE_URL` | `index.html:13` |
| Links antigos | `/?room=<id>` redireciona para `/jogar?room=<id>` na borda (vercel.json `redirects` com `has: query`) + fallback inline no HTML da landing para dev/preview | brief §5 |
| Demais contratos de URL | `?host=1`, `?local=1`, `?players=N` também redirecionam de `/` para `/jogar` (params do app auditados em `App.tsx`, `OnlineGate.tsx`, `session.ts`, `supabaseClient.ts`, `e2eScenario.ts`, `store.ts`); params dev-only (`sons`, `ui-lab`, `multi`, `e2eCrashCasca`, `scenario`) cobertos pelo fallback inline | discovery |
| Tema × marca | "Cidades do Mundo" apresentado como o primeiro universo/tema; a marca é o jogo de negociação. "Metrópole Neon" não é afirmado como jogável (`HOME_MAPS.neon.playable === false`) | `homeShared.ts` |
| Gratuidade | Dizer que jogar não exige conta nem instalação (D-019, app web); **não** prometer "grátis para sempre" | brief §11 |
| Celular | Funciona no navegador do celular; durante a partida a orientação é paisagem (aviso de girar, sessão preservada) | SRS §12.6 |
| Monopoly/Banco Imobiliário | No máximo **uma** FAQ factual declarando projeto independente e não afiliado; nunca em h1/title/slug/logo | brief §12 |

## User Scenarios & Testing *(mandatory)*

### US1 — Visitante orgânico entende e converte (P1)

Como pessoa que chegou por busca ("jogo de tabuleiro online com amigos", "jogo imobiliário online"), quero entender em segundos o que é o Magnata Imobiliário e começar a jogar.

**Acceptance scenarios:**

1. **Given** um acesso a `/` sem JavaScript, **When** o HTML é servido, **Then** o conteúdo real (h1, proposta, passos, FAQ-link, CTA) está presente no HTML estático — não depende de hidratação.
2. **Given** a primeira dobra em 375×812, **When** a página carrega, **Then** nome, proposta e o CTA "Jogar agora" estão visíveis sem rolagem.
3. **Given** um clique em "Jogar agora", **Then** o visitante chega à home real do jogo em `/jogar` (criar sala / entrar por convite).

### US2 — Convite antigo continua funcionando (P1)

Como jogador com um link `/?room=<id>` recebido antes desta feature, quero cair direto na sala.

**Acceptance scenarios:**

1. **Given** `/?room=abc123`, **When** acessado em produção, **Then** o servidor responde redirect (307/308) para `/jogar?room=abc123` **preservando query string** (e o hash sobrevive por comportamento de browser).
2. **Given** `/?host=1`, `/?local=1` ou `/?players=4`, **Then** o mesmo redirecionamento ocorre.
3. **Given** um link novo gerado pelo app (`roomLink`), **Then** ele aponta para `/jogar?room=<id>` e `extractRoomId` continua aceitando o link inteiro colado.
4. **Given** o dev server ou `vite preview`, **Then** os mesmos contratos funcionam (middleware/inline fallback).

### US3 — Conteúdo indexável de regras e dúvidas (P2)

Como visitante avaliando o jogo, quero ler como se joga e as perguntas frequentes sem abrir o app.

**Acceptance scenarios:**

1. **Given** `/como-jogar`, **Then** um guia original baseado no SRS cobre: objetivo, sala, ordem inicial, turno, movimento, compra/desenvolvimento, aluguel, negociação, leilões, cartas, falência/fim, reconexão — com headings semânticos e links internos para `/jogar` e `/faq`.
2. **Given** `/faq`, **Then** as perguntas do brief são respondidas com fatos verificados, e o JSON-LD `FAQPage` espelha exatamente o conteúdo visível.

### US4 — Marketing não paga o peso do jogo (P1)

**Acceptance scenarios:**

1. **Given** o manifest do build, **Then** os chunks referenciados por `/`, `/como-jogar` e `/faq` **não** contêm `@supabase/supabase-js`, motor do jogo (`src/game`), Zustand, `motion` nem componentes de sala/lobby.
2. **Given** `/jogar`, **Then** a aplicação atual carrega intacta (home, lobby, partida) com o mesmo comportamento de `/assets/*`, lazy imports e fallbacks.

## Functional Requirements

- **FR-001** `/` é landing prerenderizada (HTML autoral no build), com header compacto (marca, Como jogar, Perguntas frequentes, CTA Jogar agora), hero com produto real, seção "Como funciona" (3 passos, explicitando sala privada por convite e ausência de matchmaking público), seção de mecânicas comprovadas, seção de screenshots reais, seção de tema ("Cidades do Mundo" como primeiro universo; expansão futura sem promessa), CTA final e footer só com links reais.
- **FR-002** `/como-jogar` e `/faq` são páginas HTML estáticas indexáveis, no mesmo design system.
- **FR-003** `/jogar` serve a aplicação interativa atual (entrypoint próprio, ex-`index.html`), sem regressão de comportamento.
- **FR-004** Redirects de compatibilidade: `/?room|host|local|players` → `/jogar` com query preservada, resolvidos na configuração da Vercel (borda) e com fallback inline mínimo no HTML da landing (dev/preview/outros hosts).
- **FR-005** `roomLink()` passa a gerar `/jogar?room=<id>`; `FailureScreen` navega para `/jogar`/`/jogar?local=1`; specs E2E atualizadas para `/jogar`.
- **FR-006** Bundles separados: entrypoints HTML distintos; páginas de marketing compartilham apenas tokens de design (subset copiado com proveniência), fontes e favicon — nenhum import de `src/game`, `src/net`, stores ou `motion`.
- **FR-007** SEO técnico: `lang="pt-BR"`, title/description únicos por página, canonical absoluto via `SITE_URL` configurável (`VITE_SITE_URL`, default do domínio de produção), Open Graph + Twitter Card com imagem social real, headings semânticos com um único h1, `robots.txt`, `sitemap.xml` gerado no build com o `SITE_URL`, 404 real (`404.html`) com status correto, JSON-LD `VideoGame` (só fatos comprovados) na landing e `FAQPage` no `/faq`, suporte a verificação do Search Console via `VITE_GSC_VERIFICATION` (meta tag opcional) e documentação curta do passo manual.
- **FR-008** Acessibilidade WCAG AA no caminho principal das páginas novas: contraste, teclado, focus-visible, landmarks, alt text, heading order, touch targets, zoom, sem overflow horizontal, `prefers-reduced-motion` com página completa.
- **FR-009** Motion moderado: entradas 150–420 ms com os tokens existentes (`--motion-*`, `--ease-*`), transform/opacity, nada essencial escondido até o JS rodar, sem loops chamativos nem scroll-jacking.
- **FR-010** Performance: JS mínimo na landing (apenas o fallback de redirect inline), imagens WebP/AVIF com dimensões explícitas, lazy abaixo da dobra, preload só do crítico, cache/hashing atuais preservados.
- **FR-011** Screenshots reais capturadas do projeto rodando localmente (lobby, tabuleiro em partida, negociação), com dados fictícios e sem identificadores privados.
- **FR-012** Testes: contratos de URL (formato de `roomLink`, `extractRoomId` com link novo, redirects declarados no `vercel.json`), e auditoria de bundle no build (chunks de marketing sem Supabase/engine).

## Success Criteria

- **SC-001** `curl` do HTML publicado de `/`, `/como-jogar` e `/faq` contém o conteúdo real (não casca vazia) com metas corretas.
- **SC-002** Convite antigo `/?room=x` chega à sala; convite novo nasce em `/jogar?room=x`.
- **SC-003** Manifest do build comprova ausência de Supabase/engine nos chunks de marketing; tamanhos reportados.
- **SC-004** `bun run lint`, `bun run typecheck`, `bunx vitest run` (suites relevantes) e `bun run build` verdes.
- **SC-005** Duas passadas visuais registradas com screenshots nas 6 resoluções do brief.

## Fora do escopo

Matchmaking, login, monetização, mudanças em regra de jogo/lobby/tabuleiro, novo design system, analytics, commit/push/deploy.
