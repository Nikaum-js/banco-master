-- Spec 049 / D-052 — várias partidas sequenciais dentro da mesma sala.
--
-- `match_generation` ordena ciclos; `seq` continua monotônico pela vida inteira da sala.
-- Reabrir é atômico: avança a geração, volta ao lobby e limpa snapshot/segredos sem tocar
-- assentos, códigos ou seq.

alter table public.rooms
  add column if not exists match_generation integer not null default 0
    check (match_generation >= 0);

create or replace function public.reject_stale_snapshot() returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  if new.match_generation < old.match_generation then
    return null;
  end if;
  if new.match_generation = old.match_generation and new.seq < old.seq then
    return null;
  end if;
  return new;
end;
$$;

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

create or replace function public.write_room(
  room_id text,
  status text,
  seats jsonb,
  match_generation integer,
  opening_mode text,
  opening_auction jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_uid text := (select auth.uid())::text;
  current_host text := public.room_host_uid(room_id);
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

  insert into public.rooms (
    id, status, seats, match_generation, opening_mode, opening_auction
  )
  values (
    room_id,
    status,
    public.preserve_seat_codes(room_id, seats),
    match_generation,
    opening_mode,
    opening_auction
  )
  on conflict (id) do update set
    status = excluded.status,
    seats = excluded.seats,
    match_generation = excluded.match_generation,
    opening_mode = excluded.opening_mode,
    opening_auction = excluded.opening_auction;
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
  opening_auction jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_uid text := (select auth.uid())::text;
  current_host text := public.room_host_uid(room_id);
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

  insert into public.rooms (
    id, status, seats, seq, game, secrets, match_generation, opening_mode, opening_auction
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
    opening_auction
  )
  on conflict (id) do update set
    status = excluded.status,
    seats = excluded.seats,
    seq = excluded.seq,
    game = excluded.game,
    secrets = excluded.secrets,
    match_generation = excluded.match_generation,
    opening_mode = excluded.opening_mode,
    opening_auction = excluded.opening_auction;
end;
$$;

create or replace function public.reopen_room(
  room_id text,
  seats jsonb,
  match_generation integer,
  opening_mode text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_uid text := (select auth.uid())::text;
  current_host text := public.room_host_uid(room_id);
  current_generation integer;
  current_status text;
  has_game boolean;
  requested_generation integer := match_generation;
begin
  if current_host is null or current_host is distinct from claimed_uid then
    raise exception 'not the current host of this room';
  end if;

  select r.match_generation, r.status, r.game is not null
    into current_generation, current_status, has_game
  from public.rooms r
  where r.id = room_id
  for update;

  if current_status = 'lobby'
    and current_generation = requested_generation
    and not has_game
  then
    return;
  end if;

  if current_status <> 'ended' or requested_generation <> current_generation + 1 then
    raise exception 'room is not ready for rematch';
  end if;

  update public.rooms
  set
    status = 'lobby',
    seats = public.preserve_seat_codes(room_id, seats),
    match_generation = requested_generation,
    opening_mode = opening_mode,
    opening_auction = null,
    game = null,
    secrets = '{}'::jsonb
  where id = room_id;
end;
$$;
