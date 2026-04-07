-- Spec 055 / D-069 — segundo mapa jogável selecionado por sala.
--
-- O mapa é escolhido ANTES da criação da sala e nunca muda: a coluna nasce com o insert e
-- os upserts NÃO a tocam no `do update set` — imutabilidade por construção, no mesmo lugar
-- em que `seq`/`match_generation` já têm sua monotonia. Sala anterior a esta migration cai
-- no default 'atlas' (§11.1, SRS v1.30).

alter table public.rooms
  add column if not exists board_id text not null default 'atlas'
    check (board_id in ('atlas', 'fuligem'));

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
    'boardId', r.board_id,
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
    'boardId', r.board_id,
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

-- Overloads aditivos. As assinaturas da 0005/0006/0007 permanecem durante o rollout.
create or replace function public.write_room(
  room_id text,
  status text,
  seats jsonb,
  match_generation integer,
  opening_mode text,
  opening_auction jsonb,
  match_history jsonb,
  board_id text
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
    id, status, seats, match_generation, opening_mode, opening_auction, match_history, board_id
  )
  values (
    room_id,
    status,
    public.preserve_seat_codes(room_id, seats),
    match_generation,
    opening_mode,
    opening_auction,
    requested_history,
    board_id
  )
  on conflict (id) do update set
    status = excluded.status,
    seats = excluded.seats,
    match_generation = excluded.match_generation,
    opening_mode = excluded.opening_mode,
    opening_auction = excluded.opening_auction,
    match_history = public.merge_room_match_history(public.rooms.match_history, excluded.match_history);
    -- board_id de propósito FORA do update: o mapa é imutável depois da criação (D-069).
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
  match_history jsonb,
  board_id text
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
    opening_auction, match_history, board_id
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
    requested_history,
    board_id
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
    -- board_id de propósito FORA do update: o mapa é imutável depois da criação (D-069).
end;
$$;

-- `reopen_room` (0006) reabre a MESMA sala para a revanche — a linha já existe, então o
-- overload novo só valida que o board pedido confere (ou é omitido) e nunca o regrava.
create or replace function public.reopen_room(
  room_id text,
  seats jsonb,
  match_generation integer,
  opening_mode text,
  board_id text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Delegar à assinatura vigente mantém a regra de revanche num lugar só; o board não
  -- participa porque não muda (D-069) — o parâmetro existe para o cliente novo não cair
  -- no fallback de assinatura à toa.
  perform public.reopen_room(room_id, seats, match_generation, opening_mode);
end;
$$;
