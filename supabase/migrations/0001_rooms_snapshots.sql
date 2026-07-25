-- Spec 037 — fundação multiplayer host-autoritativo. Infra mínima (D-020): UMA tabela por
-- sala, upsertada. O fluxo normal NÃO toca o Postgres — comandos trafegam por Realtime
-- broadcast (dezenas de bytes); o snapshot completo só é lido ao entrar/reconectar (FR-014)
-- e escrito a cada comando aceito (FR-013). Sem log de eventos/histórico (D-020).

create table if not exists public.rooms (
  id          text primary key,                       -- id da sala = credencial de acesso (o link, D-019)
  status      text not null default 'lobby',          -- lobby | playing | ended
  seats       jsonb not null default '[]'::jsonb,      -- assentos: playerId/token/nome/cor/host/connected (associação assento↔token, lado servidor)
  seq         integer not null default -1,             -- nº de sequência do último comando aplicado (FR-010/013); -1 = ainda sem partida
  game        jsonb,                                   -- snapshot completo do GameState (JSON serializável); null até iniciar
  updated_at  timestamptz not null default now()
);

-- Realtime: o tráfego do jogo é broadcast + presence no canal `room:<id>` (não depende de CDC).
-- A publicação abaixo habilita CDC na tabela como rede de segurança/observabilidade. Idempotente.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;

-- RLS: no v1 não há contas (D-019) — a credencial é o próprio id da sala (o link). O Postgres
-- não consegue exigir "conhece o id" além do próprio filtro por id, então as políticas liberam
-- o acesso anônimo à tabela; a obscuridade do id da sala é a barreira do MVP (aceito no free
-- tier; endurecer — ex.: Edge Function validando token — fica para quando houver tração).
alter table public.rooms enable row level security;

drop policy if exists "rooms_anon_select" on public.rooms;
drop policy if exists "rooms_anon_insert" on public.rooms;
drop policy if exists "rooms_anon_update" on public.rooms;

create policy "rooms_anon_select" on public.rooms for select using (true);
create policy "rooms_anon_insert" on public.rooms for insert with check (true);
create policy "rooms_anon_update" on public.rooms for update using (true) with check (true);

-- Toca `updated_at` a cada escrita (útil p/ expirar salas nunca iniciadas — Edge Cases).
create or replace function public.touch_rooms_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_rooms_touch on public.rooms;
create trigger trg_rooms_touch before update on public.rooms
  for each row execute function public.touch_rooms_updated_at();
