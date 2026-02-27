# Runbook — lançamento e retorno

> Como o Banco Master vai ao ar, e como voltar atrás. Decisão de origem: [D-041](adr/D-041-publicacao-em-vercel-com-gate-verde.md) · SRS §12.8 · spec [044](../specs/044-polimento-lancamento/spec.md).
>
> **A regra que governa tudo aqui:** produção é promovida pelo **resultado do CI**, nunca pelo push. Um commit vermelho não chega ao ar.

---

## 0. Pré-requisitos (uma vez)

| Item | Onde | Observação |
|---|---|---|
| Projeto Supabase de produção | painel Supabase | já existe desde a spec 037; confira em §1 **quais** migrations já subiram — o repo tem quatro |
| Projeto Vercel ligado ao repositório | painel Vercel | a integração nativa cuida dos **previews de PR**; produção é do workflow |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Vercel → Environment Variables (**Production** e **Preview**) | públicas por desenho: a RLS pressupõe que a anon key está no bundle |
| `VITE_SENTRY_DSN` | Vercel → Production | opcional. Ausente = nenhum código de monitoramento roda |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | GitHub → Settings → Secrets → Actions | usados só pelo `deploy.yml` |
| `SUPABASE_ACCESS_TOKEN`, senha do banco | máquina do operador | migrations **não** passam pelo CI (§1) |

> ⚠️ **Nunca** colocar `service_role` ou `sb_secret_*` em variável `VITE_*`. Tudo que começa com `VITE_` entra no bundle e é público por construção do Vite. O único segredo do frontend é não ter segredo.
>
> Na Vercel, `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` precisam ser do tipo **Non-sensitive**. O deploy de produção compila no GitHub após `vercel pull`; uma variável marcada como **Sensitive** não pode ser recuperada e chega ao build como o marcador `[Sensitive]`, que não é uma URL nem uma chave válida.

---

## 1. Migrations — antes do primeiro deploy

As **quatro**, nesta ordem, contra o projeto de produção:

```sh
supabase link --project-ref <project-ref>
supabase db push
```

1. `0001_rooms_snapshots.sql` — tabela `rooms`, publicação Realtime, RLS · *spec 037*
2. `0002_snapshot_monotonic.sql` — gatilho que rejeita snapshot obsoleto · *spec 041*
3. `0003_attested_identity.sql` — identidade atestada pelo servidor: políticas por tópico, funções de leitura, código de reentrada imutável · *spec 043, D-042/D-036/D-037/D-043*
4. `0004_telemetry_events.sql` — telemetria, insert-only · *spec 044, D-040*

> ⚠️ **A de telemetria nasceu como `0003` e foi renumerada para `0004`** quando a 043 entrou na linha principal com um `0003` próprio. Duas migrations com o mesmo prefixo têm a **mesma versão** para o CLI do Supabase — `db push` falharia ou aplicaria só uma. Se você chegou a aplicar a telemetria enquanto ela ainda era `0003`, não há problema: ela é idempotente (`create table if not exists`, `drop policy if exists`), então reaplicar como `0004` não muda nada no banco.

### Verificação — o passo que separa "rodei o comando" de "está aplicado"

| Verificar | Esperado |
|---|---|
| `select * from public.rooms limit 1` com a **anon key** | responde (tabela existe, RLS permite) |
| `update rooms set seq = <menor que o atual>` | **no-op silencioso** (gatilho de monotonia ativo) |
| `insert into telemetry_events (kind) values ('room_created')` com anon key | aceito |
| `select * from telemetry_events` com anon key | **negado** (não há política de leitura, por desenho) |
| As políticas e funções da 043 | ver `specs/043-identidade-de-transporte/contracts/policies.md` — a identidade atestada tem verificação própria, e `scripts/attack.ts` exercita seis vetores contra o projeto real |

Sem os quatro, **não prossiga**: um jogo publicado sem `rooms` perde a partida no primeiro reload, e sem o gatilho de monotonia uma escrita atrasada regride o estado — o cenário que a 041 caçou.

---

## 2. Primeiro lançamento

1. `main` verde no CI — **todos** os jobs: `gates`, `simulation`, `e2e`, `a11y`, `full-match`.
2. `deploy.yml` dispara por `workflow_run` e promove produção sozinho.
3. Abrir a URL e rodar o teste de fumaça manual (§3).
4. Conferir a versão publicada: o rodapé da home mostra os 7 primeiros caracteres do commit.

---

## 3. Teste de fumaça manual (uma vez por lançamento)

Não substitui o gate automatizado — cobre o que só existe com infra real.

- [ ] Criar sala na URL de produção; o link abre em **outro dispositivo, em outra rede**
- [ ] Entrar com dois jogadores, iniciar, jogar 3 turnos
- [ ] **Recarregar** um dos clientes → a partida volta do servidor (prova que `rooms` está viva)
- [ ] Fechar um cliente → a mesa pausa nomeando o ausente (§11.3)
- [ ] Reabrir pelo link → a mesa retoma
- [ ] Conferir no banco: `room_created` e `match_started` chegaram, **sem** id de sala em claro
- [ ] Conferir no navegador (DevTools → Sources): nenhum segredo além da anon key

---

## 4. Retorno (rollback)

**Gatilho** — qualquer um destes: tela branca em produção, partida que não persiste, exceção em massa no monitoramento, ou gate verde com produto que não sobe.

1. Painel Vercel → **Deployments** → o deploy anterior → **Promote to Production**. Sem rebuild, sem CI.
2. Confirmar pelo rodapé da home que a versão anterior voltou.
3. Abrir o incidente com a pergunta certa: **qual gate deveria ter pegado isso e não pegou?**

> **Migration não volta com o deploy.** Reverter código é um passo; reverter schema não é. Por isso as migrations desta spec são **aditivas** (tabela nova, nenhuma coluna removida) — a versão anterior do código continua funcionando com o schema novo. **Manter essa propriedade é obrigação de toda migration futura**, ou o rollback deixa de ser de um passo.

---

## 5. Invariantes que este runbook preserva

| # | Invariante | Onde é garantido |
|---|---|---|
| R1 | Nenhuma versão com gate vermelho chega a produção | `deploy.yml` (`workflow_run` + `conclusion == success`) |
| R2 | Migration é passo deliberado do operador, nunca efeito colateral do deploy | §1; `deploy.yml` não toca no banco |
| R3 | Toda migration é aditiva, ou o rollback deixa de valer | revisão de cada migration nova |
| R4 | Só chave pública no bundle | `.env.example`; §3 |
| R5 | Build sem env obrigatória falha em vez de publicar | `vite.config.ts` (`requireEnv`, ligado por `VERCEL=1`) |
| R6 | A versão publicada é identificável pelo commit | `VITE_COMMIT_SHA` → rodapé da home + `release` do Sentry |
