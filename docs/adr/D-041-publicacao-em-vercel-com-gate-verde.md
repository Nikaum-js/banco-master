# D-041 — Publicação na Vercel: preview por PR, produção só com gate verde

**Data:** 2026-07-26 · **Status:** aceita

**Decisão:** o Banco Master é publicado como aplicação estática na **Vercel**, com três regras:

1. **Todo PR ganha um preview navegável.** A revisão deixa de ser "li o diff" e passa a poder ser "joguei".
2. **A produção só é promovida a partir de `main` e só depois de todos os gates verdes** — lint, tipos, testes, build, simulação seedada, smoke E2E e a auditoria de acessibilidade (D-039). O deploy é disparado **pelo resultado do CI**, não pelo push: um commit vermelho não chega ao ar.
3. **Rollback é um passo.** Voltar à versão anterior é promover o deploy imediatamente anterior, sem rebuild e sem esperar CI.

Duas obrigações de ambiente acompanham:

- **As migrations do Supabase são parte do lançamento.** As duas que existem (`0001_rooms_snapshots.sql`, `0002_snapshot_monotonic.sql`) nunca foram aplicadas em produção — o PRD registra isso como "infra viva pendente" desde a spec 037. Lançar sem elas é publicar um produto que não persiste partida.
- **O que é público é público, o que é secreto nunca entra no bundle.** Só a URL do projeto e a `anon key` (que a RLS já pressupõe expostas) viajam para o cliente. `service_role` e o token de deploy vivem em segredo de CI, nunca em `VITE_*`. Build sem as variáveis obrigatórias **falha** em vez de publicar uma tela branca.

**Por quê:** hoje o repo tem CI de qualidade (`.github/workflows/ci.yml` — lint, tipos, testes, build, simulação, smoke) e **nenhum caminho para produção**. O jogo é multiplayer online: sem estar no ar, ele não pode ser jogado por ninguém que não tenha o repositório clonado — o gate de valor não é técnico, é a ausência de URL.

Vercel entre as opções equivalentes: preview por PR e rollback de um passo são nativos, a integração com GitHub não exige infraestrutura própria, e o alvo é uma SPA estática — não há servidor a operar, porque a autoridade roda no cliente-host (D-020) e a persistência é o Supabase. GitHub Pages custaria menos uma conta e entregaria menos duas coisas que importam aqui: preview por PR (a forma mais barata de revisar um jogo é jogá-lo) e fallback de SPA sem gambiarra.

Disparar o deploy **pelo CI** e não pelo push é o que faz a regra 2 existir de fato. A integração nativa de qualquer plataforma publica no push e roda os testes em paralelo — o que significa que a versão quebrada já está no ar quando o teste fica vermelho. Numa partida em curso, uma versão quebrada publicada é a mesa inteira caindo ao mesmo tempo, e a fronteira de erro da 042 contém a tela, não o deploy ruim.

**Alternativa descartada — integração nativa com proteção de branch:** mais simples de configurar e insuficiente. Proteção de branch impede o merge, não a publicação — e o `main` deste repo recebe merge de worktree local, não só PR.

**Alternativa descartada — projeto Supabase separado para os previews:** isolaria dado de teste do dado real, ao custo de um segundo projeto para manter, um segundo conjunto de migrations para sincronizar e um segundo lugar onde a migration pode estar desatualizada. Como não há contas nem dado pessoal (D-019) e sala é efêmera, previews apontam para o mesmo projeto. Se o dado de produção passar a ter valor, a separação vira decisão própria.

**Como aplicar:** a spec 044 operacionaliza. `vercel.json` cobre o fallback de SPA e o cache (index sem cache, assets com hash imutáveis); o workflow de deploy roda encadeado ao CI existente e usa o token de deploy como segredo; a aplicação das migrations é passo explícito e verificável do runbook de lançamento, não um efeito colateral do deploy. Esta decisão é técnica: não altera nenhuma regra de negócio do SRS.
