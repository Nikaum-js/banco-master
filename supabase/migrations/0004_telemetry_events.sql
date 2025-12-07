-- Spec 044 (D-040) — telemetria mínima anônima: SÓ conta se as partidas terminam, nunca
-- quem jogou. Tabela própria, fora da partida (nenhum reducer, sessão ou snapshot depende
-- dela) — contrato completo em specs/044-polimento-lancamento/contracts/telemetry-port.md.
--
-- `match_key` é o hash SHA-256(roomId + sal público de build), truncado, calculado no
-- cliente (`src/telemetry/matchKey.ts`) — o id de sala NUNCA chega aqui em claro: ele é a
-- credencial de acesso (D-019/D-036), e um id de sala nesta tabela seria a credencial
-- vazando por um canal que ninguém trata como sensível.
create table if not exists public.telemetry_events (
  id          bigint generated always as identity primary key,
  kind        text        not null,   -- room_created | match_started | match_ended | match_paused
  match_key   text,                   -- hash irreversível do id de sala (NUNCA o id em claro)
  players     integer,                -- contagem, só em match_started/match_ended
  rounds      integer,                -- só em match_ended
  duration_ms integer,                -- só em match_ended
  cause       text,                   -- só em match_paused: disconnect | persistence
  version     text,                   -- referência do commit publicado (VITE_COMMIT_SHA)
  created_at  timestamptz not null default now()
);

-- RLS: o cliente ESCREVE e NÃO LÊ — o oposto de `rooms` (que precisa ser lida por quem tem
-- o link). Sem política de SELECT de propósito: mesmo com a chave anônima do bundle, ninguém
-- lista os eventos de volta pelo navegador. Leitura/agregação é trabalho do lado servidor
-- (dashboard, `service_role`), fora do alcance do cliente anônimo.
alter table public.telemetry_events enable row level security;

drop policy if exists "telemetry_events_anon_insert" on public.telemetry_events;
create policy "telemetry_events_anon_insert" on public.telemetry_events for insert with check (true);
