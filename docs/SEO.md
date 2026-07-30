# SEO — landing pública (051)

## Como funciona

As páginas públicas (`/`, `/como-jogar`, `/faq`) são HTML autoral prerenderizado no build
MPA do Vite; o app interativo vive em `/jogar`. Canonical, Open Graph, `robots.txt` e
`sitemap.xml` são gerados pelo plugin `siteMeta()` em `vite.config.ts` a partir de uma
única variável — nada de domínio hardcoded nas páginas (`%SITE_URL%` é substituído no build).

## Variáveis

| Variável | Efeito | Default |
|---|---|---|
| `VITE_SITE_URL` | Base absoluta de canonical/OG/sitemap/robots | `https://magnata-imobiliario.vercel.app` |
| `VITE_GSC_VERIFICATION` | Se presente, injeta `<meta name="google-site-verification">` em todas as páginas | ausente (nenhuma meta) |

Quando o domínio definitivo existir, basta definir `VITE_SITE_URL` no ambiente de build da
Vercel — nenhuma página precisa mudar.

## Passo manual — Google Search Console

1. Em [search.google.com/search-console](https://search.google.com/search-console), adicione a
   propriedade do tipo **Prefixo do URL** com o valor do `SITE_URL` em produção.
2. Escolha a verificação por **meta tag HTML**, copie só o `content="…"` e defina
   `VITE_GSC_VERIFICATION=<esse valor>` nas env vars de produção da Vercel.
3. Faça um novo deploy (a meta entra em todas as páginas) e conclua a verificação.
4. Em **Sitemaps**, envie `sitemap.xml`.

## Imagem social

`public/og.jpg` (1200×630) é um screenshot real do tabuleiro. Para regenerar depois de uma
mudança visual do jogo: `bun run dev` e, noutro terminal,
`bun run scripts/capture-marketing-shots.ts --only og` — depois
`sips -z 630 1200 -s format jpeg -s formatOptions 85 public/og.png --out public/og.jpg && rm public/og.png`.

O mesmo script recaptura as imagens da landing (`--only board,lobby`); as versões WebP em
`src/marketing/assets/` são geradas com `cwebp -q 82 -m 6 raw/<nome>.png -o <nome>.webp`.

## Dados estruturados

- `/` carrega `VideoGame` (JSON-LD) — só fatos comprovados pelo SRS (multiplayer 2–8,
  navegador, pt-BR).
- `/faq` carrega `FAQPage` espelhando exatamente as perguntas e respostas visíveis. Ao
  editar uma resposta na página, atualize o JSON-LD junto.
