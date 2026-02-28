-- Spec 045 / D-046 — Ritual de Largada.
--
-- A fase pré-partida vive na mesma linha da sala. Os lances ficam em `seats` porque pertencem
-- ao assento; só prazo/metadado público ganha coluna. Durante `bidding`, `room_preview`
-- entrega `openingBid` apenas ao próprio assento (e a sala íntegra à autoridade). Depois de
-- `playing`, os valores são públicos: a revelação já aconteceu.

alter table public.rooms
  add column if not exists opening_mode text not null default 'sealed-bid'
    check (opening_mode in ('sealed-bid', 'dice-roll')),
  add column if not exists opening_auction jsonb;

create or replace function public.room_preview(room_id text) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'status', r.status,
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

-- Overload aditivo: mantém o contrato antigo disponível durante rollout, e o cliente novo
-- escolhe esta assinatura pela chave `opening_auction`.
create or replace function public.write_room(
  room_id text,
  status text,
  seats jsonb,
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

  insert into public.rooms (id, status, seats, opening_mode, opening_auction)
  values (
    room_id,
    status,
    public.preserve_seat_codes(room_id, seats),
    opening_mode,
    opening_auction
  )
  on conflict (id) do update set
    status = excluded.status,
    seats = excluded.seats,
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

  insert into public.rooms (id, status, seats, seq, game, secrets, opening_mode, opening_auction)
  values (
    room_id,
    status,
    public.preserve_seat_codes(room_id, seats),
    seq,
    game,
    secrets,
    opening_mode,
    opening_auction
  )
  on conflict (id) do update set
    status = excluded.status,
    seats = excluded.seats,
    seq = excluded.seq,
    game = excluded.game,
    secrets = excluded.secrets,
    opening_mode = excluded.opening_mode,
    opening_auction = excluded.opening_auction;
end;
$$;
