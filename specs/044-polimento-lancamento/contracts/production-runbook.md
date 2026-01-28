# Contrato — runbook de lançamento e retorno

**Spec**: [../spec.md](../spec.md) · **ADR**: [D-041](../../../docs/adr/D-041-publicacao-em-vercel-com-gate-verde.md)

Este arquivo é a **especificação** do runbook; o runbook executável final vive em `docs/RUNBOOK.md` (FR-049). O que está aqui é o que ele precisa conter e o que precisa ser verdade ao final.

---

## 0. Pré-requisitos (uma vez)

| Item | Onde | Observação |
|---|---|---|
| Projeto Supabase de produção | painel Supabase | já existe (spec 037); as migrations é que nunca subiram |
| Projeto Vercel ligado ao repositório | painel Vercel | previews de PR pela integração nativa |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Vercel → Environment Variables (Production + Preview) | públicas por desenho; a RLS pressupõe isso |
| `VITE_SENTRY_DSN` | Vercel → Production | opcional; ausente = monitoramento desligado (FR-038) |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | GitHub → Secrets | usados só pelo `deploy.yml` |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | uso local do operador | migrations **não** são aplicadas pelo CI (D12 do plan) |

> **Nunca** colocar `service_role` em variável `VITE_*`. Tudo que começa com `VITE_` entra no bundle e é público por construção do Vite.

## 1. Migrations — antes do primeiro deploy

As três, na ordem, com `supabase db push` contra o projeto de produção:

1. `0001_rooms_snapshots.sql` — tabela `rooms`, publicação Realtime, RLS (pendente desde a 037)
2. `0002_snapshot_monotonic.sql` — gatilho que rejeita snapshot obsoleto (pendente desde a 041)
3. `0003_telemetry_events.sql` — tabela de telemetria, insert-only (nova, D-040)

**Verificação obrigatória depois** — o passo que transforma "rodei o comando" em "está aplicado":

| Verificação | Esperado |
|---|---|
| `select * from public.rooms limit 1` com a chave anônima | responde (tabela existe, RLS permite) |
| `update` de `rooms` com `seq` menor que o atual | no-op silencioso (gatilho de monotonia ativo) |
| `insert` em `telemetry_events` com a chave anônima | aceito |
| `select` em `telemetry_events` com a chave anônima | **negado** (não há política de leitura) |

## 2. Primeiro lançamento

1. `main` verde no CI (todos os jobs, inclusive `a11y` e `full-match`).
2. `deploy.yml` dispara por `workflow_run` e promove produção.
3. Abrir a URL de produção e executar o **teste de fumaça manual** (§3).
4. Registrar a versão publicada (o `VITE_COMMIT_SHA` aparece no rodapé — FR-048).

## 3. Teste de fumaça manual (uma vez por lançamento)

Não substitui o gate automatizado; ele cobre o que só existe com infra real.

- [ ] Criar sala na URL de produção; o link abre em outro dispositivo, em outra rede.
- [ ] Entrar com dois jogadores, iniciar, jogar 3 turnos.
- [ ] **Recarregar** um dos clientes: a partida volta do servidor (prova que `rooms` está viva).
- [ ] Fechar um cliente: a mesa pausa nomeando o ausente (§11.3).
- [ ] Reabrir pelo link: a mesa retoma.
- [ ] Conferir no banco: eventos `room_created` e `match_started` chegaram, **sem** id de sala em claro.
- [ ] Conferir no navegador: nenhum segredo além da chave anônima no bundle (FR-044).

## 4. Retorno (rollback)

**Gatilho:** qualquer um destes — tela branca em produção, partida que não persiste, exceção em massa no monitoramento, gate que passou mas o produto não sobe.

1. Painel Vercel → Deployments → o deploy anterior → **Promote to Production**. Sem rebuild, sem CI (FR-043).
2. Confirmar que a URL de produção volta a servir a versão anterior (conferir o `VITE_COMMIT_SHA` do rodapé).
3. Abrir o incidente: qual gate deveria ter pego isso e não pegou.

> **Migration não volta com o deploy.** Reverter código é um passo; reverter schema não é. Por isso as migrations desta spec são **aditivas** (tabela nova, coluna nenhuma removida) — a versão anterior do código continua funcionando com o schema novo. Manter essa propriedade é obrigação de toda migration futura, ou o rollback deixa de ser de um passo.

## 5. Invariantes que o runbook precisa preservar

| # | Invariante |
|---|---|
| R1 | Nenhuma versão com gate vermelho chega a produção (FR-041) |
| R2 | Migration é passo deliberado do operador, nunca efeito colateral do deploy (D12 do plan) |
| R3 | Toda migration é aditiva, ou o rollback deixa de valer |
| R4 | Só chave pública no bundle (FR-044) |
| R5 | Build sem env obrigatória falha em vez de publicar (FR-047) |
| R6 | A versão publicada é identificável pelo commit (FR-048) |
