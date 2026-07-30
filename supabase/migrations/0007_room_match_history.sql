-- Spec 053 / D-067 — retenção leve restrita à sala privada.
--
-- O histórico é um resumo público de até 10 partidas, não um log e não um perfil. A
-- allowlist abaixo impede que uma escrita inclua acidentalmente credenciais, cartas ou
-- outro campo fora do contrato, mesmo se o frontend errar.

alter table public.rooms
  add column if not exists match_history jsonb not null default '[]'::jsonb;

create or replace function public.room_match_history_is_safe(history jsonb) returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  entry jsonb;
  standing jsonb;
  generation_value integer;
  seen_generations integer[] := '{}'::integer[];
begin
  if jsonb_typeof(history) <> 'array'
    or jsonb_array_length(history) > 10
    or octet_length(history::text) > 131072
  then
    return false;
  end if;

  for entry in select value from jsonb_array_elements(history) loop
    if jsonb_typeof(entry) <> 'object'
      or not (entry ?& array['generation', 'endedAt', 'durationMs', 'rounds', 'standings'])
      or entry - array['generation', 'endedAt', 'durationMs', 'rounds', 'standings'] <> '{}'::jsonb
      or jsonb_typeof(entry->'generation') <> 'number'
      or (entry->>'generation') !~ '^[0-9]+$'
      or jsonb_typeof(entry->'endedAt') not in ('number', 'null')
      or jsonb_typeof(entry->'durationMs') not in ('number', 'null')
      or jsonb_typeof(entry->'rounds') <> 'number'
      or (entry->>'rounds') !~ '^[0-9]+$'
      or jsonb_typeof(entry->'standings') <> 'array'
      or jsonb_array_length(entry->'standings') > 8
    then
      return false;
    end if;

    generation_value := (entry->>'generation')::integer;
    if generation_value = any(seen_generations) then
      return false;
    end if;
    seen_generations := array_append(seen_generations, generation_value);

    for standing in select value from jsonb_array_elements(entry->'standings') loop
      if jsonb_typeof(standing) <> 'object'
        or not (standing ?& array[
          'historyId', 'playerId', 'name', 'color', 'avatar', 'skin', 'rank',
          'netWorth', 'properties', 'eliminatedAtRound'
        ])
        or standing - array[
          'historyId', 'playerId', 'name', 'color', 'avatar', 'skin', 'rank',
          'netWorth', 'properties', 'eliminatedAtRound'
        ] <> '{}'::jsonb
        or jsonb_typeof(standing->'historyId') <> 'string'
        or jsonb_typeof(standing->'playerId') <> 'string'
        or jsonb_typeof(standing->'name') <> 'string'
        or jsonb_typeof(standing->'color') <> 'string'
        or jsonb_typeof(standing->'avatar') <> 'string'
        or jsonb_typeof(standing->'skin') <> 'string'
        or jsonb_typeof(standing->'rank') <> 'number'
        or (standing->>'rank') !~ '^[1-9][0-9]*$'
        or jsonb_typeof(standing->'netWorth') <> 'number'
        or jsonb_typeof(standing->'properties') <> 'number'
        or (standing->>'properties') !~ '^[0-9]+$'
        or jsonb_typeof(standing->'eliminatedAtRound') not in ('number', 'null')
      then
        return false;
      end if;
    end loop;
  end loop;

  return true;
end;
$$;

-- Escritas antigas podem chegar depois do snapshot final. O trigger de 0006 barra geração/seq
-- menores, mas um `write_room` não avança `seq`; por isso o histórico também é monotônico por
-- geração. Uma geração nova substitui a janela (e pode podar a 11ª antiga); geração igual ou
-- menor nunca regride nem reescreve uma entrada já consolidada.
create or replace function public.merge_room_match_history(stored jsonb, requested jsonb) returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  stored_last integer;
  requested_last integer;
begin
  if not public.room_match_history_is_safe(stored)
    or not public.room_match_history_is_safe(requested)
  then
    return stored;
  end if;

  select max((entry->>'generation')::integer)
    into stored_last
  from jsonb_array_elements(stored) as entry;

  select max((entry->>'generation')::integer)
    into requested_last
  from jsonb_array_elements(requested) as entry;

  if stored_last is null or (requested_last is not null and requested_last > stored_last) then
    return requested;
  end if;
  return stored;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rooms_match_history_safe'
      and conrelid = 'public.rooms'::regclass
  ) then
    alter table public.rooms
      add constraint rooms_match_history_safe
      check (public.room_match_history_is_safe(match_history));
  end if;
end $$;

create or replace function public.room_preview(room_id text) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'status', r.status,
    'matchGeneration', r.match_generation,
    'revision', r.seq,
    'openingMode', r.opening_mode,
    'openingAuction', r.opening_auction,
    'matchHistory', r.match_history,
    'seats', case
      when exists (
        select 1 from jsonb_array_elements(r.seats) as seat
        where (seat->>'isHost')::boolean and seat->>'uid' = (select auth.uid())::text
      )
      then r.seats
      else (
        select coalesce(jsonb_agg(
          case
            when seat->>'uid' = (select auth.uid())::text then seat
            when r.status = 'bidding' then seat - 'reentryCode' - 'openingBid'
            else seat - 'reentryCode'
          end
        ), '[]'::jsonb)
        from jsonb_array_elements(r.seats) as seat
      )
    end
  )
  from public.rooms r
  where r.id = room_id;
$$;

create or replace function public.read_snapshot(room_id text) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'status', r.status,
    'matchGeneration', r.match_generation,
    'revision', r.seq,
    'openingMode', r.opening_mode,
    'openingAuction', r.opening_auction,
    'matchHistory', r.match_history,
    'seats', case
      when exists (
        select 1 from jsonb_array_elements(r.seats) as seat
        where (seat->>'isHost')::boolean and seat->>'uid' = (select auth.uid())::text
      )
      then r.seats
      else (
        select coalesce(jsonb_agg(
          case when seat->>'uid' = (select auth.uid())::text
            then seat
            else seat - 'reentryCode'
          end
        ), '[]'::jsonb)
        from jsonb_array_elements(r.seats) as seat
      )
    end,
    'seq', r.seq,
    'game', r.game,
    'secrets', case
      when exists (
        select 1 from jsonb_array_elements(r.seats) as seat
        where (seat->>'isHost')::boolean and seat->>'uid' = (select auth.uid())::text
      )
      then r.secrets
      else jsonb_build_object(
        'hands', case
          when r.secrets->'hands' ? (select auth.uid())::text
          then jsonb_build_object((select auth.uid())::text, r.secrets->'hands'->(select auth.uid())::text)
          else '{}'::jsonb
        end,
        'decks', '{}'::jsonb
      )
    end
  )
  from public.rooms r
  where r.id = room_id;
$$;

-- Overloads aditivos. As assinaturas da 0005/0006 permanecem durante o rollout.
create or replace function public.write_room(
  room_id text,
  status text,
  seats jsonb,
  match_generation integer,
  opening_mode text,
  opening_auction jsonb,
  match_history jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_uid text := (select auth.uid())::text;
  current_host text := public.room_host_uid(room_id);
  requested_history jsonb := match_history;
begin
  if current_host is not null then
    if current_host is distinct from claimed_uid then
      raise exception 'not the current host of this room';
    end if;
  elsif not exists (
    select 1 from jsonb_array_elements(seats) as seat
    where (seat->>'isHost')::boolean and seat->>'uid' = claimed_uid
  ) then
    raise exception 'not the host of the seats being written';
  end if;

  if not public.room_match_history_is_safe(requested_history) then
    raise exception 'invalid room match history';
  end if;

  insert into public.rooms (
    id, status, seats, match_generation, opening_mode, opening_auction, match_history
  )
  values (
    room_id,
    status,
    public.preserve_seat_codes(room_id, seats),
    match_generation,
    opening_mode,
    opening_auction,
    requested_history
  )
  on conflict (id) do update set
    status = excluded.status,
    seats = excluded.seats,
    match_generation = excluded.match_generation,
    opening_mode = excluded.opening_mode,
    opening_auction = excluded.opening_auction,
    match_history = public.merge_room_match_history(public.rooms.match_history, excluded.match_history);
end;
$$;

create or replace function public.write_snapshot(
  room_id text,
  seq int,
  game jsonb,
  secrets jsonb,
  status text,
  seats jsonb,
  match_generation integer,
  opening_mode text,
  opening_auction jsonb,
  match_history jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_uid text := (select auth.uid())::text;
  current_host text := public.room_host_uid(room_id);
  requested_history jsonb := match_history;
begin
  if current_host is not null then
    if current_host is distinct from claimed_uid then
      raise exception 'not the current host of this room';
    end if;
  elsif not exists (
    select 1 from jsonb_array_elements(seats) as seat
    where (seat->>'isHost')::boolean and seat->>'uid' = claimed_uid
  ) then
    raise exception 'not the host of the seats being written';
  end if;

  if not public.room_match_history_is_safe(requested_history) then
    raise exception 'invalid room match history';
  end if;

  insert into public.rooms (
    id, status, seats, seq, game, secrets, match_generation, opening_mode,
    opening_auction, match_history
  )
  values (
    room_id,
    status,
    public.preserve_seat_codes(room_id, seats),
    seq,
    game,
    secrets,
    match_generation,
    opening_mode,
    opening_auction,
    requested_history
  )
  on conflict (id) do update set
    status = excluded.status,
    seats = excluded.seats,
    seq = excluded.seq,
    game = excluded.game,
    secrets = excluded.secrets,
    match_generation = excluded.match_generation,
    opening_mode = excluded.opening_mode,
    opening_auction = excluded.opening_auction,
    match_history = public.merge_room_match_history(public.rooms.match_history, excluded.match_history);
end;
$$;
