-- Spec 054 / D-068 — diretório opt-in de lobbies anônimos.
--
-- A fonte enumerável NÃO é public.rooms. As tabelas abaixo ficam fechadas por RLS e só
-- funções security definer devolvem uma projeção por allowlist. O fluxo privado existente
-- não chama nenhuma destas funções.

create extension if not exists pgcrypto with schema extensions;

alter table public.rooms
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.public_room_listings (
  room_id text primary key references public.rooms(id) on delete cascade,
  listing_id uuid not null unique default gen_random_uuid(),
  publisher_uid uuid not null,
  is_published boolean not null default false,
  published_at timestamptz not null default now(),
  last_host_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists public_room_listings_visible_idx
  on public.public_room_listings (is_published, last_host_seen_at desc)
  where is_published;

create index if not exists public_room_listings_publisher_idx
  on public.public_room_listings (publisher_uid)
  where is_published;

create table if not exists public.public_room_rate_events (
  id bigint generated always as identity primary key,
  actor_uid uuid not null,
  action text not null check (action in ('directory', 'join', 'publish')),
  room_id text,
  created_at timestamptz not null default now()
);

create index if not exists public_room_rate_events_window_idx
  on public.public_room_rate_events (actor_uid, action, created_at desc);

create index if not exists public_room_rate_events_expiry_idx
  on public.public_room_rate_events (created_at);

alter table public.public_room_listings enable row level security;
alter table public.public_room_rate_events enable row level security;

-- Nenhuma policy: até authenticated recebe zero linhas e não escreve diretamente.
revoke all on table public.public_room_listings from public, anon, authenticated;
revoke all on table public.public_room_rate_events from public, anon, authenticated;
revoke all on sequence public.public_room_rate_events_id_seq from public, anon, authenticated;

create or replace function public.public_room_actor_uid() returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'authenticated session required';
  end if;
  return actor;
end;
$$;

create or replace function public.public_room_is_host(p_room_id text, p_actor uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.room_host_uid(p_room_id) = p_actor::text;
$$;

create or replace function public.public_room_rate_limit(
  p_action text,
  p_limit integer,
  p_window interval,
  p_room_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.public_room_actor_uid();
  attempts integer;
  oldest timestamptz;
  retry_ms integer;
begin
  perform pg_advisory_xact_lock(hashtext(actor::text), hashtext(p_action));

  delete from public.public_room_rate_events
  where created_at < statement_timestamp() - interval '10 minutes';

  select count(*), min(created_at)
    into attempts, oldest
  from public.public_room_rate_events
  where actor_uid = actor
    and action = p_action
    and created_at > statement_timestamp() - p_window;

  if attempts >= p_limit then
    retry_ms := greatest(
      1,
      ceil(extract(epoch from (oldest + p_window - statement_timestamp())) * 1000)::integer
    );
    return jsonb_build_object(
      'ok', false,
      'reason', 'rate-limited',
      'retryAfterMs', retry_ms
    );
  end if;

  insert into public.public_room_rate_events(actor_uid, action, room_id)
  values (actor, p_action, p_room_id);

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.public_room_status_json(p_room_id text) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  listing public.public_room_listings%rowtype;
  room_status text;
  seat_count integer;
  visible boolean := false;
  hidden_reason text := null;
begin
  select * into listing
  from public.public_room_listings
  where room_id = p_room_id;

  if not found or not listing.is_published then
    return jsonb_build_object(
      'ok', true,
      'published', false,
      'visible', false,
      'listingId', null,
      'hiddenReason', null
    );
  end if;

  select r.status, jsonb_array_length(r.seats)
    into room_status, seat_count
  from public.rooms r
  where r.id = p_room_id;

  if room_status is distinct from 'lobby' then
    hidden_reason := 'not-lobby';
  elsif seat_count >= 8 then
    hidden_reason := 'full';
  elsif listing.last_host_seen_at is null
    or listing.last_host_seen_at < statement_timestamp() - interval '60 seconds'
  then
    hidden_reason := 'host-absent';
  else
    visible := true;
  end if;

  return jsonb_build_object(
    'ok', true,
    'published', true,
    'visible', visible,
    'listingId', listing.listing_id,
    'hiddenReason', hidden_reason
  );
end;
$$;

create or replace function public.public_room_publication(room_id text) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := public.public_room_actor_uid();
begin
  if not public.public_room_is_host(room_id, actor) then
    return jsonb_build_object('ok', false, 'reason', 'not-host');
  end if;
  return public.public_room_status_json(room_id);
end;
$$;

create or replace function public.publish_public_room(room_id text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.public_room_actor_uid();
  current_status text;
  existing public.public_room_listings%rowtype;
  distinct_rooms integer;
  already_counted boolean;
  oldest timestamptz;
  retry_ms integer;
begin
  perform pg_advisory_xact_lock(hashtext(actor::text), hashtext('publish'));

  select r.status into current_status
  from public.rooms r
  where r.id = room_id
  for update;

  if not found or not public.public_room_is_host(room_id, actor) then
    return jsonb_build_object('ok', false, 'reason', 'not-host');
  end if;
  if current_status <> 'lobby' then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;

  select * into existing
  from public.public_room_listings
  where public_room_listings.room_id = publish_public_room.room_id
  for update;

  if found and existing.is_published then
    -- Reentrada pode trocar o uid do host. A sala atual vence somente na camada do
    -- diretório; nenhuma das salas é alterada.
    update public.public_room_listings
    set is_published = false, updated_at = statement_timestamp()
    where publisher_uid = actor
      and public_room_listings.room_id <> publish_public_room.room_id
      and is_published;

    update public.public_room_listings
    set publisher_uid = actor,
        last_host_seen_at = statement_timestamp(),
        updated_at = statement_timestamp()
    where public_room_listings.room_id = publish_public_room.room_id;
    return public.public_room_status_json(room_id);
  end if;

  if exists (
    select 1
    from public.public_room_listings
    where publisher_uid = actor
      and is_published
      and public_room_listings.room_id <> publish_public_room.room_id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'active-public-room');
  end if;

  delete from public.public_room_rate_events
  where created_at < statement_timestamp() - interval '10 minutes';

  select count(distinct e.room_id),
         bool_or(e.room_id = publish_public_room.room_id),
         min(e.created_at)
    into distinct_rooms, already_counted, oldest
  from public.public_room_rate_events e
  where e.actor_uid = actor
    and e.action = 'publish'
    and e.created_at > statement_timestamp() - interval '10 minutes';

  if coalesce(distinct_rooms, 0) >= 3 and not coalesce(already_counted, false) then
    retry_ms := greatest(
      1,
      ceil(extract(epoch from (
        oldest + interval '10 minutes' - statement_timestamp()
      )) * 1000)::integer
    );
    return jsonb_build_object(
      'ok', false,
      'reason', 'rate-limited',
      'retryAfterMs', retry_ms
    );
  end if;

  insert into public.public_room_rate_events(actor_uid, action, room_id)
  values (actor, 'publish', room_id);

  insert into public.public_room_listings(
    room_id,
    listing_id,
    publisher_uid,
    is_published,
    published_at,
    last_host_seen_at,
    updated_at
  )
  values (
    room_id,
    gen_random_uuid(),
    actor,
    true,
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp()
  )
  on conflict on constraint public_room_listings_pkey do update set
    listing_id = gen_random_uuid(),
    publisher_uid = excluded.publisher_uid,
    is_published = true,
    published_at = excluded.published_at,
    last_host_seen_at = excluded.last_host_seen_at,
    updated_at = excluded.updated_at;

  return public.public_room_status_json(room_id);
end;
$$;

create or replace function public.unpublish_public_room(room_id text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.public_room_actor_uid();
begin
  if not public.public_room_is_host(room_id, actor) then
    return jsonb_build_object('ok', false, 'reason', 'not-host');
  end if;

  update public.public_room_listings
  set is_published = false, updated_at = statement_timestamp()
  where public_room_listings.room_id = unpublish_public_room.room_id;

  return public.public_room_status_json(room_id);
end;
$$;

create or replace function public.heartbeat_public_room(room_id text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.public_room_actor_uid();
  active boolean;
begin
  if not public.public_room_is_host(room_id, actor) then
    return jsonb_build_object('ok', false, 'reason', 'not-host');
  end if;

  select is_published into active
  from public.public_room_listings
  where public_room_listings.room_id = heartbeat_public_room.room_id
  for update;

  if not found or not active then
    return public.public_room_status_json(room_id);
  end if;

  -- Reentrada não pode ser bloqueada por um estado de diretório antigo. A sala em que a
  -- presença foi confirmada vence; a outra apenas deixa de ser publicada.
  update public.public_room_listings
  set is_published = false, updated_at = statement_timestamp()
  where publisher_uid = actor
    and public_room_listings.room_id <> heartbeat_public_room.room_id
    and is_published;

  update public.public_room_listings
  set publisher_uid = actor,
      last_host_seen_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where public_room_listings.room_id = heartbeat_public_room.room_id;

  return public.public_room_status_json(room_id);
end;
$$;

create or replace function public.list_public_rooms() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rate jsonb;
  result jsonb;
begin
  rate := public.public_room_rate_limit(
    'directory',
    1,
    interval '5 seconds',
    null
  );
  if not (rate->>'ok')::boolean then
    return rate;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'listingId', l.listing_id,
        'label', 'Mesa ' || upper(substr(replace(l.listing_id::text, '-', ''), 1, 4)),
        'availableSeats', 8 - jsonb_array_length(r.seats),
        'capacity', 8,
        'openingMode', coalesce(r.opening_mode, 'sealed-bid'),
        'createdMinutesAgo', greatest(
          0,
          floor(extract(epoch from (statement_timestamp() - r.created_at)) / 60)::integer
        )
      )
      order by r.created_at desc, l.listing_id
    ),
    '[]'::jsonb
  )
  into result
  from public.public_room_listings l
  join public.rooms r on r.id = l.room_id
  where l.is_published
    and r.status = 'lobby'
    and jsonb_array_length(r.seats) < 8
    and l.last_host_seen_at >= statement_timestamp() - interval '60 seconds';

  return jsonb_build_object('ok', true, 'listings', result);
end;
$$;

create or replace function public.public_room_random_code() returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select string_agg(
    substr(
      'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
      1 + (
        get_byte(extensions.gen_random_bytes(6), i)
        % char_length('ABCDEFGHJKMNPQRSTUVWXYZ23456789')
      ),
      1
    ),
    ''
  )
  from generate_series(0, 5) as i;
$$;

create or replace function public.join_public_room(
  listing_id uuid,
  name text,
  color text,
  avatar text,
  skin text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.public_room_actor_uid();
  rate jsonb;
  target_room_id text;
  target_status text;
  target_seats jsonb;
  published boolean;
  last_seen timestamptz;
  clean_name text := btrim(name);
  player_id text;
  reentry_code text;
  history_id text;
  new_seat jsonb;
begin
  rate := public.public_room_rate_limit('join', 10, interval '1 minute', null);
  if not (rate->>'ok')::boolean then
    return rate;
  end if;

  select r.id, r.status, r.seats, l.is_published, l.last_host_seen_at
    into target_room_id, target_status, target_seats, published, last_seen
  from public.public_room_listings l
  join public.rooms r on r.id = l.room_id
  where l.listing_id = join_public_room.listing_id
  for update of l, r;

  if not found
    or not published
    or target_status <> 'lobby'
    or last_seen < statement_timestamp() - interval '60 seconds'
    or jsonb_array_length(target_seats) >= 8
  then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;

  if clean_name is null or char_length(clean_name) < 1 or char_length(clean_name) > 16 then
    return jsonb_build_object('ok', false, 'reason', 'invalid-name');
  end if;
  if color is null or color not in (
    '#d9a650', '#3b8bd0', '#36dde7', '#00bca5',
    '#e77376', '#7b9d41', '#b665a2', '#b0a5ff'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'invalid-color');
  end if;
  if avatar is null or avatar not in (
    'classic-alive', 'orbital-eyes', 'single-line', 'prism-face', 'totem-face'
  ) or skin is null or skin not in (
    'careca', 'cavanhaque', 'topete', 'cartola', 'safari', 'aviador', 'astronauta'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'invalid-appearance');
  end if;

  if exists (
    select 1 from jsonb_array_elements(target_seats) as seat
    where seat->>'uid' = actor::text
  ) then
    update public.rooms
    set seats = (
      select jsonb_agg(
        case when seat->>'uid' = actor::text
          then (seat - 'connected') || jsonb_build_object('connected', true)
          else seat
        end
      )
      from jsonb_array_elements(target_seats) as seat
    )
    where id = target_room_id;
    return jsonb_build_object('ok', true, 'roomId', target_room_id);
  end if;

  if exists (
    select 1 from jsonb_array_elements(target_seats) as seat
    where seat->>'color' = color
  ) then
    return jsonb_build_object('ok', false, 'reason', 'color-taken');
  end if;

  for slot in 1..8 loop
    if not exists (
      select 1 from jsonb_array_elements(target_seats) as seat
      where seat->>'playerId' = 'p' || slot::text
    ) then
      player_id := 'p' || slot::text;
      exit;
    end if;
  end loop;

  loop
    reentry_code := public.public_room_random_code();
    exit when not exists (
      select 1 from jsonb_array_elements(target_seats) as seat
      where seat->>'reentryCode' = reentry_code
    );
  end loop;

  loop
    history_id := substr(encode(extensions.gen_random_bytes(12), 'hex'), 1, 16);
    exit when not exists (
      select 1 from jsonb_array_elements(target_seats) as seat
      where seat->>'historyId' = history_id
    );
  end loop;

  new_seat := jsonb_build_object(
    'playerId', player_id,
    'uid', actor::text,
    'historyId', history_id,
    'name', clean_name,
    'color', color,
    'avatar', avatar,
    'skin', skin,
    'isHost', false,
    'connected', true,
    'openingBid', null,
    'bidLocked', false,
    'openingRoll', null,
    'openingRollStartedAt', null,
    'openingRollResolvesAt', null,
    'reentryCode', reentry_code
  );

  update public.rooms
  set seats = target_seats || jsonb_build_array(new_seat)
  where id = target_room_id;

  perform realtime.send(
    jsonb_build_object('playerId', player_id),
    'reattached',
    'room:' || target_room_id || ':lobby',
    true
  );

  return jsonb_build_object('ok', true, 'roomId', target_room_id);
end;
$$;

create or replace function public.unpublish_room_after_lobby() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'lobby' then
    update public.public_room_listings
    set is_published = false, updated_at = statement_timestamp()
    where room_id = new.id and is_published;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_unpublish_room_after_lobby on public.rooms;
create trigger trg_unpublish_room_after_lobby
after insert or update of status on public.rooms
for each row execute function public.unpublish_room_after_lobby();

revoke all on function public.public_room_actor_uid() from public, anon, authenticated;
revoke all on function public.public_room_is_host(text, uuid) from public, anon, authenticated;
revoke all on function public.public_room_rate_limit(text, integer, interval, text) from public, anon, authenticated;
revoke all on function public.public_room_status_json(text) from public, anon, authenticated;
revoke all on function public.public_room_random_code() from public, anon, authenticated;
revoke all on function public.unpublish_room_after_lobby() from public, anon, authenticated;

revoke all on function public.public_room_publication(text) from public, anon;
revoke all on function public.publish_public_room(text) from public, anon;
revoke all on function public.unpublish_public_room(text) from public, anon;
revoke all on function public.heartbeat_public_room(text) from public, anon;
revoke all on function public.list_public_rooms() from public, anon;
revoke all on function public.join_public_room(uuid, text, text, text, text) from public, anon;

grant execute on function public.public_room_publication(text) to authenticated;
grant execute on function public.publish_public_room(text) to authenticated;
grant execute on function public.unpublish_public_room(text) to authenticated;
grant execute on function public.heartbeat_public_room(text) to authenticated;
grant execute on function public.list_public_rooms() to authenticated;
grant execute on function public.join_public_room(uuid, text, text, text, text) to authenticated;
