-- Contrato executável da spec 054 contra Postgres/Supabase real.
\set ON_ERROR_STOP on

\set host_uid '11111111-1111-1111-1111-111111111111'
\set host2_uid '12111111-1111-1111-1111-111111111111'
\set guest_uid '22222222-2222-2222-2222-222222222222'
\set guest2_uid '23222222-2222-2222-2222-222222222222'
\set attacker_uid '33333333-3333-3333-3333-333333333333'

create or replace function pg_temp.act_as(uid text) returns void
language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text,
    false
  );
end $$;

create or replace function pg_temp.host_seat(uid text, color text default '#d9a650')
returns jsonb
language sql
as $$
  select jsonb_build_array(jsonb_build_object(
    'playerId', 'p1',
    'uid', uid,
    'historyId', 'hosthistory000001',
    'name', 'Host',
    'color', color,
    'avatar', 'classic-alive',
    'skin', 'careca',
    'isHost', true,
    'connected', true,
    'openingBid', null,
    'bidLocked', false,
    'openingRoll', null,
    'openingRollStartedAt', null,
    'openingRollResolvesAt', null,
    'reentryCode', 'HOST01'
  ));
$$;

delete from public.rooms where id like 'PUB054%';
delete from public.public_room_rate_events where actor_uid in (
  :'host_uid'::uuid, :'host2_uid'::uuid, :'guest_uid'::uuid,
  :'guest2_uid'::uuid, :'attacker_uid'::uuid
);

insert into public.rooms(id, status, seats, opening_mode, created_at)
values
  ('PUB054A', 'lobby', pg_temp.host_seat(:'host_uid'), 'sealed-bid', now() - interval '2 minutes'),
  ('PUB054B', 'lobby', pg_temp.host_seat(:'host_uid'), 'dice-roll', now() - interval '3 minutes'),
  ('PUB054C', 'lobby', pg_temp.host_seat(:'host_uid'), 'sealed-bid', now() - interval '4 minutes'),
  ('PUB054D', 'lobby', pg_temp.host_seat(:'host_uid'), 'dice-roll', now() - interval '5 minutes'),
  ('PUB054X', 'lobby', pg_temp.host_seat(:'host2_uid'), 'dice-roll', now() - interval '1 minute');

-- 1. Tabelas internas e rooms continuam não enumeráveis para o frontend.
do $$
begin
  assert not has_table_privilege('authenticated', 'public.public_room_listings', 'SELECT'),
    'authenticated ganhou SELECT em public_room_listings';
  assert not has_table_privilege('authenticated', 'public.public_room_listings', 'INSERT'),
    'authenticated ganhou INSERT em public_room_listings';
  assert not has_table_privilege('authenticated', 'public.public_room_listings', 'UPDATE'),
    'authenticated ganhou UPDATE em public_room_listings';
  assert not has_table_privilege('authenticated', 'public.public_room_listings', 'DELETE'),
    'authenticated ganhou DELETE em public_room_listings';
  assert not has_table_privilege('authenticated', 'public.public_room_rate_events', 'SELECT'),
    'authenticated ganhou SELECT em public_room_rate_events';
  assert not has_table_privilege('authenticated', 'public.public_room_rate_events', 'INSERT'),
    'authenticated ganhou INSERT em public_room_rate_events';
  assert not has_table_privilege('authenticated', 'public.public_room_rate_events', 'UPDATE'),
    'authenticated ganhou UPDATE em public_room_rate_events';
  assert not has_table_privilege('authenticated', 'public.public_room_rate_events', 'DELETE'),
    'authenticated ganhou DELETE em public_room_rate_events';
  assert not has_table_privilege('authenticated', 'public.rooms', 'SELECT'),
    'authenticated voltou a enumerar rooms';
  assert has_function_privilege('authenticated', 'public.list_public_rooms()', 'EXECUTE'),
    'authenticated não executa list_public_rooms';
  assert not has_function_privilege('anon', 'public.list_public_rooms()', 'EXECUTE'),
    'anon sem sessão executa list_public_rooms';
end $$;

-- 2. Sala sem opt-in é privada; segunda atualização é limitada.
select pg_temp.act_as(:'guest_uid');
do $$
declare first_result jsonb;
declare second_result jsonb;
begin
  first_result := public.list_public_rooms();
  assert first_result->>'ok' = 'true', first_result::text;
  assert first_result->'listings' = '[]'::jsonb, 'sala privada apareceu: ' || first_result::text;

  second_result := public.list_public_rooms();
  assert second_result->>'reason' = 'rate-limited', second_result::text;
  assert (second_result->>'retryAfterMs')::integer > 0, second_result::text;
end $$;

-- 3. Só o host publica; a projeção tem allowlist exata e não contém roomId/dados de assento.
select pg_temp.act_as(:'host_uid');
do $$
declare published jsonb;
begin
  published := public.publish_public_room('PUB054A');
  assert published->>'ok' = 'true', published::text;
  assert published->>'published' = 'true', published::text;
  assert published->>'visible' = 'true', published::text;
end $$;

select pg_temp.act_as(:'attacker_uid');
do $$
declare forged jsonb;
begin
  forged := public.publish_public_room('PUB054A');
  assert forged->>'reason' = 'not-host', forged::text;
  forged := public.unpublish_public_room('PUB054A');
  assert forged->>'reason' = 'not-host', forged::text;
  forged := public.heartbeat_public_room('PUB054A');
  assert forged->>'reason' = 'not-host', forged::text;
end $$;

select pg_temp.act_as(:'guest2_uid');
do $$
declare directory jsonb;
declare item jsonb;
declare keys text[];
begin
  directory := public.list_public_rooms();
  assert jsonb_array_length(directory->'listings') = 1, directory::text;
  item := directory->'listings'->0;

  select array_agg(key order by key) into keys
  from jsonb_object_keys(item) as key;
  assert keys = array[
    'availableSeats', 'capacity', 'createdMinutesAgo',
    'label', 'listingId', 'openingMode'
  ], 'allowlist divergente: ' || item::text;
  assert item->>'label' like 'Mesa ____', item::text;
  assert (item->>'availableSeats')::integer = 7, item::text;
  assert (item->>'capacity')::integer = 8, item::text;
  assert item->>'openingMode' = 'sealed-bid', item::text;
  assert not (directory::text ~* 'PUB054A|roomId|"seats"|"uid"|"name"|snapshot|reentry|history'),
    'payload contém dado privado: ' || directory::text;
end $$;

-- 4. Um lobby publicado por identidade; três salas distintas por 10 minutos.
select pg_temp.act_as(:'host_uid');
do $$
declare result jsonb;
begin
  result := public.publish_public_room('PUB054B');
  assert result->>'reason' = 'active-public-room', result::text;

  perform public.unpublish_public_room('PUB054A');
  result := public.publish_public_room('PUB054B');
  assert result->>'published' = 'true', result::text;
  perform public.unpublish_public_room('PUB054B');

  result := public.publish_public_room('PUB054C');
  assert result->>'published' = 'true', result::text;
  perform public.unpublish_public_room('PUB054C');

  -- Republicar uma das três não cria quarta sala.
  result := public.publish_public_room('PUB054A');
  assert result->>'published' = 'true', result::text;
  perform public.unpublish_public_room('PUB054A');

  result := public.publish_public_room('PUB054D');
  assert result->>'reason' = 'rate-limited', result::text;
end $$;

-- Isola as próximas provas da janela de publicação.
delete from public.public_room_rate_events
where actor_uid = :'host_uid'::uuid and action = 'publish';

-- 5. Lotação e ausência apenas escondem; heartbeat permite reaparecer.
select pg_temp.act_as(:'host_uid');
select public.publish_public_room('PUB054A');

update public.rooms
set seats = seats || (
  select jsonb_agg(jsonb_build_object(
    'playerId', 'p' || n,
    'uid', '00000000-0000-0000-0000-' || lpad(n::text, 12, '0'),
    'historyId', 'history' || lpad(n::text, 9, '0'),
    'name', 'P' || n,
    'color', (array['#3b8bd0','#36dde7','#00bca5','#e77376','#7b9d41','#b665a2','#b0a5ff'])[n - 1],
    'avatar', 'classic-alive',
    'skin', 'careca',
    'isHost', false,
    'connected', true,
    'reentryCode', 'CODE' || lpad(n::text, 2, '0')
  ))
  from generate_series(2, 8) as n
)
where id = 'PUB054A';

do $$
declare status jsonb;
begin
  status := public.public_room_publication('PUB054A');
  assert status->>'published' = 'true', status::text;
  assert status->>'visible' = 'false', status::text;
  assert status->>'hiddenReason' = 'full', status::text;
end $$;

update public.rooms
set seats = jsonb_build_array(seats->0)
where id = 'PUB054A';

update public.public_room_listings
set last_host_seen_at = statement_timestamp() - interval '61 seconds'
where room_id = 'PUB054A';

do $$
declare status jsonb;
begin
  status := public.public_room_publication('PUB054A');
  assert status->>'published' = 'true', status::text;
  assert status->>'hiddenReason' = 'host-absent', status::text;
  status := public.heartbeat_public_room('PUB054A');
  assert status->>'visible' = 'true', status::text;
end $$;

-- 6. Entrada pública é atômica e só sucesso revela roomId.
select pg_temp.act_as(:'guest_uid');
do $$
declare listing uuid;
declare joined jsonb;
begin
  select listing_id into listing
  from public.public_room_listings
  where room_id = 'PUB054A';

  joined := public.join_public_room(
    listing, 'Ana', '#3b8bd0', 'orbital-eyes', 'cartola'
  );
  assert joined = jsonb_build_object('ok', true, 'roomId', 'PUB054A'), joined::text;
end $$;

do $$
declare room_row public.rooms%rowtype;
begin
  select * into room_row from public.rooms where id = 'PUB054A';
  assert jsonb_array_length(room_row.seats) = 2, room_row.seats::text;
  assert exists (
    select 1 from jsonb_array_elements(room_row.seats) as seat
    where seat->>'uid' = auth.uid()::text
      and char_length(seat->>'reentryCode') = 6
      and char_length(seat->>'historyId') = 16
  ), 'assento público incompatível: ' || room_row.seats::text;
end $$;

select pg_temp.act_as(:'guest2_uid');
do $$
declare listing uuid;
declare refused jsonb;
begin
  select listing_id into listing
  from public.public_room_listings
  where room_id = 'PUB054A';
  refused := public.join_public_room(
    listing, 'Bia', '#3b8bd0', 'classic-alive', 'careca'
  );
  assert refused->>'reason' = 'color-taken', refused::text;
  assert not (refused ? 'roomId'), 'recusa vazou roomId: ' || refused::text;
end $$;

-- 7. Listing expirado/forjado não revela a sala; toda tentativa entra no limite 10/min.
select pg_temp.act_as(:'host_uid');
select public.unpublish_public_room('PUB054A');

delete from public.public_room_rate_events
where actor_uid = :'attacker_uid'::uuid and action = 'join';
select pg_temp.act_as(:'attacker_uid');
do $$
declare fake uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
declare result jsonb;
declare n integer;
begin
  for n in 1..10 loop
    result := public.join_public_room(fake, 'Spam', '#36dde7', 'classic-alive', 'careca');
    assert result->>'reason' = 'unavailable', result::text;
    assert not (result ? 'roomId'), result::text;
  end loop;
  result := public.join_public_room(fake, 'Spam', '#36dde7', 'classic-alive', 'careca');
  assert result->>'reason' = 'rate-limited', result::text;
  assert not (result ? 'roomId'), result::text;
end $$;

-- 8. Início encerra publicação e lobby de revanche não restaura.
select pg_temp.act_as(:'host2_uid');
select public.publish_public_room('PUB054X');
update public.rooms set status = 'bidding' where id = 'PUB054X';

do $$
declare status jsonb;
begin
  status := public.public_room_publication('PUB054X');
  assert status->>'published' = 'false', status::text;
  update public.rooms set status = 'lobby' where id = 'PUB054X';
  status := public.public_room_publication('PUB054X');
  assert status->>'published' = 'false', 'revanche republicou: ' || status::text;
end $$;

-- 9. Sala privada continua acessível quando o id é conhecido.
select pg_temp.act_as(:'guest_uid');
do $$
declare preview jsonb;
begin
  preview := public.room_preview('PUB054B');
  assert preview->>'id' = 'PUB054B', preview::text;
  assert jsonb_array_length(preview->'seats') = 1, preview::text;
end $$;

delete from public.rooms where id like 'PUB054%';
delete from public.public_room_rate_events where actor_uid in (
  :'host_uid'::uuid, :'host2_uid'::uuid, :'guest_uid'::uuid,
  :'guest2_uid'::uuid, :'attacker_uid'::uuid
);

\echo 'contrato do diretório público: OK'
